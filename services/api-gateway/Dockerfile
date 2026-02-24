FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our gateway config
COPY nginx.conf /etc/nginx/conf.d/gateway.conf

# Health check
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

EXPOSE 80
