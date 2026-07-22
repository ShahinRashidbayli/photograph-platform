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
export DB_USERNAME=<db-user>
export DB_PASSWORD=<db-password>
cd apps/api && mvn spring-boot:run
```

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
