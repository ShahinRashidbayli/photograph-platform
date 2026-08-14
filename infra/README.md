# infra

Infrastructure configuration for local development and production deployment.

## Structure

```
infra/
├── docker-compose.yml        Local dev stack (PostgreSQL, optional services)
├── railway.toml              Railway deployment configuration
└── env/
    ├── .env.example          Template — copy to .env and fill in values
    └── .env.test.example     Template for test environment variables
```

## Local development

Spin up a local PostgreSQL instance:

```bash
docker compose up -d
```

Then start the API with the `prod` profile pointing at the local container:

```bash
export DB_URL=jdbc:postgresql://localhost:5433/centralidp
export DB_USERNAME=fotolio_app
export DB_PASSWORD=fotolio_app_dev_password
cd apps/api && mvn spring-boot:run
```

### The `fotolio_app` role (tenant isolation)

The app runs every query as `fotolio_app`, a role with no table ownership and
no `BYPASSRLS` — Postgres Row-Level Security (`V11__tenant_rls.sql`) is what
actually keeps one tenant's data from being visible to another's queries, and
RLS only applies to a role like this. Never point `DB_USERNAME` at the
owning/migration role.

- **Local Docker Compose**: `fotolio_app` is created automatically by
  `infra/postgres-init/01-create-app-role.sql` the first time the `postgres`
  container initializes its data volume. If you already have an existing
  local volume from before this role existed, either recreate the volume
  (`docker compose down -v && docker compose up -d`) or run the same SQL file
  manually against the running container.
- **Supabase**: after the first `mvn flyway:migrate` run against a fresh
  project (which creates the role via `V11__tenant_rls.sql`, with no
  password), set its password once via the Supabase SQL editor:
  ```sql
  ALTER ROLE fotolio_app PASSWORD '<a-strong-generated-password>';
  ```
  then put that value in `DB_PASSWORD`.

## Environment variables

Copy the template and fill in real values — never commit `.env`:

```bash
cp infra/env/.env.example .env
```

| Variable               | Description                            |
|------------------------|----------------------------------------|
| `DB_URL`               | JDBC URL for PostgreSQL                |
| `DB_USERNAME`          | Database username                      |
| `DB_PASSWORD`          | Database password                      |
| `NEXT_PUBLIC_API_URL`  | Public base URL of the backend API     |

All secrets are stored in **GitHub Secrets** for CI and in **Railway Variables** for production.
