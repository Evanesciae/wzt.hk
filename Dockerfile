FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends libheif-examples sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DB_PATH=/data/wzt.db MEDIA_DIR=/data/media
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/content/travel ./src/content/travel
COPY --from=build /app/src/content/kb ./src/content/kb
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /data/media /backups
VOLUME ["/data", "/backups"]
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]

