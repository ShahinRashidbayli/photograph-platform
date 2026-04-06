.PHONY: dev api web test migrate clean stop

# Start infra (postgres + redis) in background
infra:
	docker compose -f infra/docker-compose.yml up -d postgres redis
	@echo "Waiting for postgres..." && sleep 3
	@echo "PostgreSQL: localhost:5433 | Redis: localhost:6379"

# Kill anything on port 8080, then start the Spring Boot API
api:
	@lsof -ti:8080 | xargs kill -9 2>/dev/null || true
	@sleep 1
	cd apps/api && export $$(grep -v '^#' ../../infra/.env | xargs) && /opt/homebrew/bin/mvn spring-boot:run

# Start Next.js dev server
web:
	cd apps/web && npm run dev

# Start everything: infra + api (in background) + web (foreground)
dev: infra
	@lsof -ti:8080 | xargs kill -9 2>/dev/null || true
	@sleep 1
	@cd apps/api && export $$(grep -v '^#' ../../infra/.env | xargs) && /opt/homebrew/bin/mvn spring-boot:run &
	@echo "API starting in background — waiting 15s before frontend..."
	@sleep 15
	cd apps/web && npm run dev

test:
	cd apps/api && export $$(grep -v '^#' infra/.env 2>/dev/null | xargs) || true && /opt/homebrew/bin/mvn test
	cd apps/web && npm test -- --passWithNoTests

migrate:
	cd apps/api && export $$(grep -v '^#' ../../infra/.env | xargs) && \
		/opt/homebrew/bin/mvn flyway:migrate -Dflyway.url=$${FLYWAY_URL} -Dflyway.user=$${FLYWAY_USER} -Dflyway.password=$${DB_PASSWORD}

stop:
	@lsof -ti:8080 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "Stopped API (8080) and web (3000)"

clean:
	docker compose -f infra/docker-compose.yml down -v
	cd apps/api && /opt/homebrew/bin/mvn clean
	cd apps/web && rm -rf .next
