# api

Spring Boot 3 REST API backend for photograph-platform.

## Responsibilities

- Expose REST endpoints consumed by the `web` app
- Handle authentication and authorization
- Persist and query data via JPA / PostgreSQL
- Enforce business rules (upload limits, visibility, etc.)

## Package structure

Feature-based layout — each domain owns its full vertical slice:

```
com.photographplatform.api/
├── PhotographPlatformApplication.java   Entry point
├── photo/
│   ├── controller/    HTTP layer — REST endpoints
│   ├── service/       Business logic
│   ├── repository/    Data access (Spring Data JPA)
│   ├── domain/        JPA entities
│   └── dto/           Request / response objects
├── user/
│   └── (same structure as photo/)
└── common/
    ├── config/        Spring beans, CORS, security config
    └── exception/     Global exception handler, custom exceptions
```

> Grouping by feature (not by layer) keeps all code for a domain together.
> When you add a `Comment` feature you create one package — not six scattered files.

## Configuration

| Profile   | Database                | When used              |
|-----------|-------------------------|------------------------|
| (default) | H2 in-memory            | Local dev, CI tests    |
| `prod`    | PostgreSQL via env vars | Production / Railway   |

Required environment variables for production:

```
DB_URL=jdbc:postgresql://host:5432/photographplatform
DB_USERNAME=...
DB_PASSWORD=...
```

## Running locally

```bash
mvn spring-boot:run
# API available at http://localhost:8080
```

## Testing

```bash
mvn test          # runs with H2 — no database setup needed
mvn checkstyle:check   # lint Java sources
```
