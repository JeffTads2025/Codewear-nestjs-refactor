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

The project uses a Direct Container Deploy strategy (simple deployment via
Docker Compose). In the demonstration environment, deployment is triggered
after the CI/CD pipeline has passed validation. Update and start the containers
from the repository root with:

```powershell
docker compose up -d --build
```

## Inspect logs

```powershell
docker compose logs --tail=100 service-catalog
docker compose logs --tail=100 service-orders
docker compose logs --tail=100 nginx
docker compose logs --tail=100 mysql redis
```

Application logs include request method, path, status, and duration. Catalog logs
identify cache hits and database reads. Order and catalog logs identify published
and received `order_created` events.

## Check MySQL and Redis

```powershell
docker compose exec mysql mysqladmin ping -h localhost -pcodewear-root-local
docker compose exec mysql mysql -u codewear -pcodewear-local codewear_db -e "SHOW TABLES;"
docker compose exec redis redis-cli ping
```

Expected health responses are `mysqld is alive` and `PONG`. If MySQL is healthy
but the tables are missing, apply the project's database migrations before using
the API; the NestJS services do not synchronize or migrate the schema at startup.

## Check the API and recover

```powershell
curl.exe -i http://localhost:8080/products
docker compose up -d service-catalog service-orders nginx
```

If the database or Redis is unhealthy, inspect its logs, restart that container,
then restart the dependent NestJS services. The Redis Pub/Sub channel is
ephemeral: events published while the subscriber is disconnected are not replayed.
