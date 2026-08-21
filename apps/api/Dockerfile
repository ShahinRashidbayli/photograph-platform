# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, not apps/api — keep it that way so the
# same context works for both services:
#   docker build -f apps/api/Dockerfile -t fotolio-api .
#
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the executable jar
# ─────────────────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencies resolve in their own layer, keyed on the pom alone, so a source
# change doesn't re-download the world on every rebuild.
COPY apps/api/pom.xml ./pom.xml
RUN mvn -B -q dependency:go-offline

COPY apps/api/checkstyle.xml apps/api/checkstyle-suppressions.xml ./
COPY apps/api/src ./src

# Tests are deliberately skipped here: the suite needs Docker (Testcontainers
# spins up PostgreSQL and MinIO) and cannot run inside an image build. CI runs
# it as its own job before anything is built or deployed.
RUN mvn -B -q clean package -DskipTests

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

# curl is for the healthcheck; fontconfig + ttf-dejavu are NOT optional — the
# invoice PDF renderer (openhtmltopdf) and the thumbnail pipeline both run
# through java.awt, which aborts on a headless image with no fontconfig.
# Without them, invoice PDFs fail at runtime and nowhere else.
RUN apk add --no-cache curl fontconfig ttf-dejavu

# Never run the app as root.
RUN addgroup -S fotolio && adduser -S -G fotolio fotolio
WORKDIR /app

COPY --from=build /build/target/*.jar /app/app.jar
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown -R fotolio:fotolio /app

USER fotolio

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport -Djava.awt.headless=true"
ENV SERVER_PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${SERVER_PORT}/actuator/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["serve"]
