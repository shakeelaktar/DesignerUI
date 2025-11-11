## syntax=docker/dockerfile:1
# Dev-mode container running Vite server for Designer UI
FROM node:18-alpine

WORKDIR /app

# 1) Copy only the UI app manifest first (better layer caching)
COPY web/designer-ui/package*.json ./

# 2) Copy only the UI app sources, not the whole repo (deps installed at runtime via entrypoint)
COPY web/designer-ui/. .

# 4) Add a tiny entrypoint that (re)installs only if needed (for bind-mount dev)
COPY web/designer-ui/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# default to internal services on the compose network; can be overridden by env
ENV VITE_TRIGGER_URL=http://triggerservice:8080

EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm","run","dev","--","--host","0.0.0.0"]
