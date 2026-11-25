# CodeWear Architecture

## 1. C4 diagrams

### C1 — System context

![C1 System Context](diagramas/c1-contexto.png)

### C2 — Containers

![C2 Containers](diagramas/c2-containers.png)

> **Portas e dados:** Nginx publica `8080:8080`; Service Catalog escuta `3000`
> e Service Orders `3001`. MySQL e Redis não publicam portas no host. O Compose
> executa instâncias MySQL isoladas para `codewear_catalog` e `codewear_orders`,
> cada uma com seu volume persistente. O banco legado `codewear` e seu volume
> permanecem como backup/fallback; a restauração dos dumps separados é descrita
> no runbook.

## 2. ADRs

### ADR 001 — Architectural style

### Adoção de Arquitetura de Microsserviços Desacoplados com NestJS e Redis Pub/Sub

- **Status:** Aceito
- **Contexto e problema:** É necessário isolar os domínios de Catálogo e Pedidos
  para reduzir o acoplamento entre responsabilidades e permitir escalabilidade
  independente dos serviços.
- **Decisão:** Separar a aplicação em `service-catalog` e `service-orders`,
  ambos implementados com NestJS. Usar Redis Pub/Sub para comunicação assíncrona
  por eventos entre os serviços, incluindo `order_created`.
- **Consequências:** Os serviços usam schemas MySQL separados; Orders acessa
  usuários, produtos e estoque somente por endpoints internos autenticados do
  Catalog. O Nginx bloqueia o prefixo `/internal/`, e a rede do Compose não
  publica portas dos serviços ou do banco no host.

### ADR 002 — Escolha de Armazenamento e Persistência de Dados

- **Status:** Aceito
- **Contexto e problema:** A aplicação precisa armazenar dados relacionais
  estruturados — como produtos, pedidos e usuários — com suporte a transações
  ACID, além de um mecanismo de alta velocidade para cache e eventos assíncronos.
- **Decisão:** Adotar instâncias isoladas de **MySQL 8.0** para
  `codewear_catalog` e `codewear_orders`, com volumes persistentes separados, e
  **Redis 7** para cache-aside das listagens de catálogo e Pub/Sub do evento
  `order_created`.
- **Consequências:** Checkout reserva estoque no Catalog e cria o pedido no
  Orders; em caso de falha de persistência, Orders solicita o estorno da
  reserva. `order_items` conserva snapshots de nome, imagem, tamanho e preço,
  sem depender de joins com o catálogo para consultar o histórico. Como a
  reserva e a gravação do pedido usam bancos distintos, o fluxo é uma saga
  compensatória, não uma transação ACID distribuída.

## Cache Redis atual

- Apenas `GET /products` usa cache Redis, no formato
  `catalog:products:page:{page}:limit:{limit}`.
- O valor é JSON da resposta paginada: produtos visíveis com tamanhos e
  promoções, além de `totalPages` e `total`.
- O TTL é `max(1, Number(CACHE_TTL_SECONDS) || 60)` segundos: por padrão, 60
  segundos; valor inválido ou zero usa 60, e valores negativos resultam em 1.
- Criação, edição, exclusão lógica e reserva/estorno de estoque invalidam as
  chaves `catalog:products:*`.
- Usuários, perfis, endereços, carrinhos e pedidos não são armazenados em cache.
  `order_created` é uma mensagem Redis Pub/Sub, não uma chave com TTL.

## 3. Quality scenarios

| Atributo | Estímulo e ambiente | Resposta esperada | Medida / critério |
|---|---|---|---|
| Desempenho | Um cliente consulta produtos enquanto o serviço está operando normalmente e as páginas do catálogo estão aquecidas no cache. | O Service Catalog atende a consulta pelo cache-aside Redis, sem precisar consultar o MySQL para a página em cache. | Latência da busca inferior a 100 ms. Este é um objetivo de qualidade; não há benchmark documentado que comprove o limite em todos os ambientes. |
| Disponibilidade | Redis fica temporariamente indisponível durante a publicação de `order_created`. | O pedido permanece persistido; a aplicação registra a falha e responde com erro. Este comportamento reflete o código atual, que não possui fallback durável para o evento. | Objetivo de evolução: recuperar a publicação sem perda e sem retorno ambíguo ao cliente; ainda não garantido pela implementação atual. |

**Estado atual do cenário de disponibilidade:** o cliente Redis utiliza o
comportamento padrão de reconexão da biblioteca, mas não há fallback durável
(como outbox/fila persistente) implementado. Atualmente, a falha ao publicar
`order_created` é registrada e a API retorna erro mesmo após o pedido já ter
sido persistido. Portanto, o cenário de disponibilidade acima é um requisito
alvo, não uma garantia já atendida integralmente. Redis Pub/Sub também não
reproduz mensagens publicadas enquanto o assinante está desconectado.

## 4. Estilos Arquiteturais e Domain-Driven Design (DDD)

### 4.1 Context Map

![Context Map](diagramas/context-map.png)

### 4.2 Mapeamento de Domínios e Bounded Contexts

#### 1. Orders Context (Core Domain)

- **Tipo de domínio:** Core Domain, conforme a classificação adotada no
  Context Map.
- **Responsabilidades:** gerenciar linhas do carrinho, processar checkout e
  criar/consultar pedidos.
- **Linguagem encontrada no código:** `Cart`, `CheckoutDto`, `Order`,
  `OrderItem` e o evento `order_created` (payload com `event` e `orderId`).
  Não existe classe `CartItem` nem evento/classe `OrderCreated` no código.

#### 2. Catalog Context (Supporting Domain)

- **Tipo de domínio:** Supporting Domain, conforme a classificação adotada no
  Context Map.
- **Responsabilidades:** cadastrar e listar produtos, manter estoque, tamanhos
  e promoções, além de autenticação e perfis.
- **Linguagem encontrada no código:** `Product`, `ProductSize`, `Promotion` e
  `User`. `category` é um atributo textual de `Product`, não uma entidade
  `Category`. Não foram encontrados modelos ou tipos `SKU`, `AuthToken` ou
  `StockCache`; o JWT é tratado como token de autenticação, o cache usa chaves
  Redis e os produtos não têm um atributo `SKU` declarado nos models.

### 4.3 Elementos táticos do contexto Orders

O backend usa models Sequelize para persistência. Esta seção distingue os
conceitos de modelagem DDD da implementação atual: não foram adicionadas classes
de domínio ou alterações ao código.

#### Aggregates (Agregados)

- **Agregado de Pedidos — conceitual:** `Order` funciona conceitualmente como a
  raiz do agregado e `OrderItem` como entidade pertencente ao pedido. O model
  declara a relação `HasMany`, e o checkout cria o pedido e seus itens dentro
  de uma transação Sequelize.
- **Limite da implementação:** não existe uma classe `OrderAggregate` ou
  `OrderAggregateRoot`, e as regras de consistência não estão encapsuladas em
  uma camada de agregado DDD. A transação de checkout é a garantia de
  consistência atualmente implementada.
- Cada registro de `Cart` representa um item associado a `userId`, `productId`,
  `quantity` e `size`; não existe entidade/tipo `CartItem` separado nem
  agregado `Cart` contendo uma coleção de itens. Portanto, `Cart` não é
  documentado aqui como um agregado formal.

#### Entities (Entidades)

- **`Order`:** model da tabela `orders`; possui `id`, `totalValue`, `status`,
  `paymentMethod`, `address` e `userId`, além dos timestamps do Sequelize. O
  status tem valor padrão `pendente`; o checkout define `pago`. O campo é uma
  string, sem enum nem regras de transição implementadas no model.
- **`OrderItem`:** model da tabela `order_items`; possui `id`, `quantity`,
  `priceAtPurchase`, `orderId`, `productId`, `size`, `productName` e
  `productImageUrl`. Os campos do produto são snapshots e os IDs não são FKs
  para o schema Catalog.
- **`Cart`:** model da tabela `carts`; possui `id`, `quantity` (padrão `1`),
  `userId`, `productId` e `size`. Cada linha associa um usuário a um produto.
- **`Product`:** entidade do schema Catalog; Orders consulta dados correntes
  pelo endpoint interno e não declara um model Sequelize para produtos.
- **`ProductSize`:** model da tabela `product_sizes`; possui `id`, `productId`,
  `size` e `stock`.
- **`Promotion`:** model da tabela `promotions`; possui `id`, `code`,
  `discountPercentage`, `validFrom`, `validUntil`, `isActive` e `productId`.
- **`User`:** model de autenticação/perfil em `service-catalog`, com `id`,
  `name`, `email`, `cpf`, `password`, `role`, `phone`, `address`, `avatarUrl` e
  `isActive`. Orders valida a situação do usuário por endpoint interno; não
  persiste dados cadastrais em Redis nem declara um model User.

#### Value Objects (Objetos de Valor)

- **Conceitos propostos para evolução da modelagem:** `Money`, para valores
  monetários, e `Address`, para o endereço de entrega, poderiam ser Value
  Objects no contexto Orders. São propostas conceituais, não tipos existentes
  nem comportamento implementado.
- **Implementação atual:** `Order.totalValue` e
  `OrderItem.priceAtPurchase` são persistidos como `DECIMAL(10, 2)`; `Order.address`
  e `Order.paymentMethod` são strings; `Order.status` também é string; e as
  quantidades são inteiros nos models Sequelize. Não existem classes Value
  Object dedicadas para dinheiro, endereço, quantidade ou status. `CheckoutDto`
  apenas valida os campos de entrada e não é um Value Object de domínio.

## 5. Atributos de Qualidade, Resiliência e Observabilidade

### 5.1 Objetivos e Indicadores de Nível de Serviço (SLOs e SLIs)

Os valores abaixo são **objetivos propostos**, não SLOs medidos ou garantidos
pela implementação atual. Não há coleta contínua de métricas ou relatório de
SLO configurado no projeto.

| Indicador (SLI) | Objetivo (SLO) | Critério de medição / estado atual |
| :--- | :--- | :--- |
| **Tempo de resposta (`GET /products`)** | 95% das requisições abaixo de 100 ms | Objetivo a medir pela latência HTTP. NestJS registra duração por requisição; não há agregação de percentis nem benchmark configurado. O cache-aside Redis registra a origem `CACHE` ou `DATABASE`. |
| **Taxa de sucesso de checkout (`POST /checkout`)** | Pelo menos 99% das tentativas concluídas com sucesso | Objetivo a medir pela proporção de respostas HTTP 201. O projeto não agrega atualmente tentativas e sucessos como métrica. |
| **Disponibilidade da API** | 99,5% de uptime mensal | Objetivo a medir externamente. Não foram identificados endpoints de health para os serviços NestJS nem monitoramento mensal de disponibilidade. O Compose tem health checks para MySQL e Redis. |

### 5.2 Estratégias de Resiliência Aplicadas

1. **Redis e cache de produtos:** o cliente Redis usa a configuração padrão da
   biblioteca; o projeto não define explicitamente uma política de retry ou
   backoff exponencial. Se a leitura do cache falhar, `GET /products` registra
   um aviso e consulta o MySQL; falhas ao gravar o cache também são registradas
   sem impedir a resposta da consulta.
2. **Checkout entre serviços:** Catalog valida o usuário e reserva estoque em
   transação no seu schema. Orders grava pedido/itens e limpa o carrinho em
   transação local; se essa gravação falhar, tenta estornar todas as reservas.
   Essa compensação não substitui uma transação distribuída/outbox e depende de
   que o Catalog esteja disponível para executar o estorno.
3. **Timeouts do Nginx:** não há diretivas de timeout de proxy configuradas no
   `nginx.conf` atual. Portanto, timeouts rigorosos de leitura/escrita não são
   uma proteção implementada neste momento.
4. **Degradação do catálogo:** a falha na leitura do Redis permite consultar o
   MySQL como fallback. Essa degradação cobre o cache de produtos; não implica
   que todas as operações que dependem de Redis, em especial a publicação de
   eventos, tenham fallback.

### 5.3 Plano Simples de Observabilidade

#### 1. Logs disponíveis

- **Acesso HTTP no NestJS:** `configureHttp` registra método, caminho, status e
  duração em milissegundos. Não registra tamanho do payload e não foi
  identificada configuração de log de acesso equivalente no Nginx.
- **Cache do catálogo:** `ProductsService` registra `source=CACHE` em cache hit,
  `source=DATABASE` na leitura do banco e avisos quando operações do Redis
  falham.
- **Eventos Pub/Sub:** publicador e assinante registram o evento
  `order_created` e seu payload após publicar ou validar/receber a mensagem.
  Esses logs não constituem uma fila durável nem confirmação transacional.

#### 2. Métricas e saúde

- O código registra logs operacionais, mas não inclui atualmente um exportador
  de métricas ou dashboard para taxas HTTP 5xx, percentis de latência ou taxa de
  sucesso de checkout.
- Docker Compose define health checks para `mysql-catalog`, `mysql-orders` e
  `redis`; não define
  health checks para `service-catalog`, `service-orders` ou `nginx`.
- Consumo de CPU e memória dos contêineres pode ser inspecionado pelas
  ferramentas do Docker, mas não há coleta ou monitoramento contínuo desses
  indicadores configurado no projeto.
