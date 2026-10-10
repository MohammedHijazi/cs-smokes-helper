# Development image: Node and the project's dependencies. compose.yaml mounts the source over /app.
FROM node:24-slim

COPY docker/entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod +x /usr/local/bin/dev-entrypoint && mkdir /app && chown node:node /app

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci && sha256sum package-lock.json > node_modules/.lock-hash

ENTRYPOINT ["dev-entrypoint"]
CMD ["npm", "run", "dev"]
