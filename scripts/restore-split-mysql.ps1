param(
  [Parameter(Mandatory = $true)]
  [string]$LegacyMysqlContainer,

  [Parameter(Mandatory = $true)]
  [string]$CatalogDump,

  [Parameter(Mandatory = $true)]
  [string]$OrdersDump
)

$ErrorActionPreference = 'Stop'
$mysqlRootPasswordEntry = Get-Content -LiteralPath (Join-Path (Get-Location) '.env') |
  Where-Object { $_.StartsWith('MYSQL_ROOT_PASSWORD=') } |
  Select-Object -First 1
if (-not $mysqlRootPasswordEntry) {
  throw 'MYSQL_ROOT_PASSWORD não está configurada no arquivo .env.'
}
$mysqlRootPassword = $mysqlRootPasswordEntry.Substring('MYSQL_ROOT_PASSWORD='.Length)

function Invoke-ContainerQuery([string]$Container, [string]$Query) {
  $result = & docker exec --env "MYSQL_PWD=$mysqlRootPassword" $Container mysql -uroot --batch --skip-column-names -e "$Query"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha na consulta ao MySQL do container $Container."
  }
  return @($result | ForEach-Object { "$_".TrimEnd() } | Where-Object { $_ })
}

function Invoke-ComposeQuery([string]$Service, [string]$Query) {
  $result = & docker compose exec -T --env "MYSQL_PWD=$mysqlRootPassword" $Service mysql -uroot --batch --skip-column-names -e "$Query"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha na consulta ao serviço $Service."
  }
  return @($result | ForEach-Object { "$_".TrimEnd() } | Where-Object { $_ })
}

function Quote-MySqlIdentifier([string]$Name) {
  return '`' + $Name.Replace('`', '``') + '`'
}

function Import-Dump(
  [string]$Service,
  [string]$Container,
  [string]$DumpPath,
  [string]$RemotePath
) {
  $copied = $false
  try {
    & docker cp "$DumpPath" "${Container}:$RemotePath"
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível copiar o dump para $Service."
    }
    $copied = $true
    & docker exec $Container sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < "$1"' sh $RemotePath
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao importar o dump no serviço $Service."
    }
  } finally {
    if ($copied) {
      & docker exec $Container rm -f $RemotePath
      if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível limpar o dump temporário de $Service."
      }
    }
  }
}

if (-not (Test-Path -LiteralPath $CatalogDump) -or (Get-Item -LiteralPath $CatalogDump).Length -eq 0) {
  throw 'Dump codewear_catalog ausente ou vazio.'
}
if (-not (Test-Path -LiteralPath $OrdersDump) -or (Get-Item -LiteralPath $OrdersDump).Length -eq 0) {
  throw 'Dump codewear_orders ausente ou vazio.'
}

$catalogContainer = (& docker compose ps -q mysql-catalog).Trim()
$ordersContainer = (& docker compose ps -q mysql-orders).Trim()
if ($LASTEXITCODE -ne 0 -or -not $catalogContainer -or -not $ordersContainer) {
  throw 'Inicie mysql-catalog e mysql-orders antes de restaurar os dumps.'
}

$catalogSourceTables = @(Invoke-ContainerQuery $LegacyMysqlContainer "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'codewear_catalog' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME")
$ordersSourceTables = @(Invoke-ContainerQuery $LegacyMysqlContainer "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'codewear_orders' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME")
if ($catalogSourceTables.Count -eq 0 -or $ordersSourceTables.Count -eq 0) {
  throw 'Os schemas de origem estão vazios; a importação foi cancelada.'
}

foreach ($destination in @(
  @{ Service = 'mysql-catalog'; Schema = 'codewear_catalog' },
  @{ Service = 'mysql-orders'; Schema = 'codewear_orders' }
)) {
  $tableCount = @(Invoke-ComposeQuery $destination.Service "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$($destination.Schema)' AND TABLE_TYPE = 'BASE TABLE'")
  if ([int]$tableCount[0] -ne 0) {
    throw "$($destination.Schema) já contém tabelas. A restauração não sobrescreverá dados."
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
Import-Dump 'mysql-catalog' $catalogContainer ([System.IO.Path]::GetFullPath($CatalogDump)) "/tmp/codewear-catalog-$stamp.sql"
Import-Dump 'mysql-orders' $ordersContainer ([System.IO.Path]::GetFullPath($OrdersDump)) "/tmp/codewear-orders-$stamp.sql"

foreach ($migration in @(
  @{ Service = 'mysql-catalog'; Schema = 'codewear_catalog'; SourceTables = $catalogSourceTables },
  @{ Service = 'mysql-orders'; Schema = 'codewear_orders'; SourceTables = $ordersSourceTables }
)) {
  $targetTables = @(Invoke-ComposeQuery $migration.Service "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$($migration.Schema)' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME")
  if (($targetTables -join "`n") -ne ($migration.SourceTables -join "`n")) {
    throw "As tabelas de $($migration.Schema) diferem entre origem e destino."
  }
  foreach ($table in $migration.SourceTables) {
    $quotedTable = Quote-MySqlIdentifier $table
    $sourceCount = @(Invoke-ContainerQuery $LegacyMysqlContainer "SELECT COUNT(*) FROM $($migration.Schema).$quotedTable")
    $targetCount = @(Invoke-ComposeQuery $migration.Service "SELECT COUNT(*) FROM $($migration.Schema).$quotedTable")
    if ([long]$sourceCount[0] -ne [long]$targetCount[0]) {
      throw "Contagem divergente em $($migration.Schema).${table}: origem=$($sourceCount[0]), destino=$($targetCount[0])."
    }
  }
}

$nullSnapshotNames = @(Invoke-ComposeQuery 'mysql-orders' 'SELECT COUNT(*) FROM codewear_orders.order_items WHERE productName IS NULL')
if ([int]$nullSnapshotNames[0] -ne 0) {
  throw 'Há itens históricos sem snapshot de nome do produto.'
}

Write-Host 'Restauração e validação por tabela concluídas. O container MySQL legado não foi parado nem removido.'
