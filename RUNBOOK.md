# CodeWear incident runbook

Run commands from the repository root.

## Restart services

Check container state and restart the affected service:

```powershell
docker compose ps
docker compose restart service-catalog
docker compose restart service-orders
docker compose restart nginx
```

If a container repeatedly exits, rebuild and start the stack:

```powershell
docker compose up -d --build
```

## Deployment strategy

Copy `.env.example` to `.env` and set strong MySQL credentials plus unique
values for `INTERNAL_API_KEY` and `JWT_SECRET`. Do not commit `.env` or database
dumps. The Compose stack uses isolated `mysql-catalog` and `mysql-orders`
containers with independent persistent volumes. MySQL data is not automatically
copied between volumes.

### Split an existing MySQL installation

Keep the legacy MySQL container and `codewear_mysql-data` volume intact as a
fallback. Stop application writes and make individual dumps of both migrated
schemas before changing or stopping the legacy database. The retained dumps for
this migration are:

- `backups\codewear_catalog-20261122-131515-882.sql`
- `backups\codewear_orders-20261122-131515-882.sql`
- Full legacy backup: `backups\codewear-20261122-123845-759.sql`

Start only the new databases and restore into empty schemas. The restore script
refuses to import into non-empty schemas and compares every table and row count
against the still-running legacy MySQL container:

```powershell
docker compose stop service-catalog service-orders nginx
$legacyMysql = docker ps -q --filter "name=codewear-system-refactored-mysql-1"
docker compose up -d mysql-catalog mysql-orders
docker compose ps
.\scripts\restore-split-mysql.ps1 `
  -LegacyMysqlContainer $legacyMysql `
  -CatalogDump '.\backups\codewear_catalog-20261122-131515-882.sql' `
  -OrdersDump '.\backups\codewear_orders-20261122-131515-882.sql'
```

Review the restore output before starting the application. Do not use
`docker compose down -v`, remove `codewear_mysql-data`, or stop/remove the
legacy container until the new databases have been validated.

Start the application only after both imports pass validation:

```powershell
docker compose up -d --build
docker compose ps
```

Once the new application has been verified, the old MySQL container may be
stopped (not removed) to retain its data as a fallback.

## Inspect logs

```powershell
docker compose logs --tail=100 service-catalog
docker compose logs --tail=100 service-orders
docker compose logs --tail=100 nginx
docker compose logs --tail=100 mysql-catalog mysql-orders redis
```

Application logs include request method, path, status, and duration. Catalog logs
identify cache hits and database reads. Order and catalog logs identify published
and received `order_created` events.

## Check MySQL and Redis

```powershell
docker compose exec mysql-catalog mysqladmin ping -h localhost
docker compose exec mysql-catalog sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" codewear_catalog -e "SHOW TABLES;"'
docker compose exec mysql-orders mysqladmin ping -h localhost
docker compose exec mysql-orders sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" codewear_orders -e "SHOW TABLES;"'
docker compose exec redis redis-cli ping
```

Expected health responses are `mysqld is alive` and `PONG`. If either MySQL is
healthy but its tables are missing, restore the corresponding dump before using
the API; the NestJS services do not synchronize or migrate the schema at startup.

The `service-orders` container reaches the catalog's `/internal/` API only over
the private Compose network. Nginx returns `404` for `/internal` and
`/internal/*`; keep the service ports unpublished on the host.

## Check the API and recover

```powershell
curl.exe -i http://localhost:8080/products
docker compose up -d service-catalog service-orders nginx
```

If the database or Redis is unhealthy, inspect its logs, restart that container,
then restart the dependent NestJS services. The Redis Pub/Sub channel is
ephemeral: events published while the subscriber is disconnected are not replayed.
