FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Default upstreams for local Docker Compose. Override in Render env vars.
ENV PUZZLE_UPSTREAM=http://puzzle-generator:8080
ENV VOICE_UPSTREAM=http://voice-to-move:8001

# Copy template config; nginx entrypoint will envsubst it into /etc/nginx/conf.d/
COPY nginx.conf /etc/nginx/templates/gateway.conf.template

# Health check
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

EXPOSE 80
