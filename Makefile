.PHONY: dev test migrate clean

dev:
	docker compose -f infra/docker-compose.yml up -d
	@echo "PostgreSQL: localhost:5432 | MailHog UI: http://localhost:8025"

test:
	cd apps/api && mvn test
	cd apps/web && npm test -- --passWithNoTests

migrate:
	cd apps/api && mvn flyway:migrate -Dflyway.url=$${FLYWAY_URL} -Dflyway.user=$${FLYWAY_USER} -Dflyway.password=$${DB_PASSWORD}

clean:
	docker compose -f infra/docker-compose.yml down -v
	cd apps/api && mvn clean
	cd apps/web && rm -rf .next
