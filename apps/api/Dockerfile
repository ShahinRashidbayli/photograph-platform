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

# curl is for the healthcheck.
#
# fontconfig + ttf-dejavu are for java.awt, which the gallery watermark draws
# through: WatermarkRenderer asks for a SANS_SERIF font and calls drawString,
# and on a headless image with no fontconfig that fails at runtime and nowhere
# else. The thumbnail path shares the same AWT initialisation.
#
# The invoice PDF no longer depends on them — it embeds its own font from the
# classpath (see InvoicePdfRenderer), precisely so the rendered document
# cannot vary with the base image's font set.
RUN apk add --no-cache curl fontconfig ttf-dejavu

# Never run the app as root.
RUN addgroup -S fotolio && adduser -S -G fotolio fotolio
WORKDIR /app

COPY --from=build /build/target/*.jar /app/app.jar
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown -R fotolio:fotolio /app

USER fotolio

# ExitOnOutOfMemoryError: an OOM thrown on one thread leaves the rest of the
# JVM running half-broken (health checks can still pass), so exit and let the
# platform restart a clean process instead.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport -XX:+ExitOnOutOfMemoryError -Djava.awt.headless=true"
ENV SERVER_PORT=8080
# One JSON object per log line wherever this image runs, so the setting travels
# with the image instead of living in one platform's dashboard. Local runs
# (`make api`, e2e-stack) do not use the image and stay plain text.
ENV LOGGING_STRUCTURED_FORMAT_CONSOLE=logstash
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${SERVER_PORT}/actuator/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["serve"]
