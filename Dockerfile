# --- Build: compila el frontend (Vite) y revisa tipos -------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime: solo el servidor y el frontend ya compilado ----------------------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4460 \
    DB_PATH=/data/oficina-viva.db \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY src/data ./src/data
COPY --from=build /app/dist ./dist

# La base SQLite vive en un volumen para sobrevivir a reinicios y actualizaciones.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 4460
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4460/api/session > /dev/null || exit 1

CMD ["node", "--import", "tsx", "server/index.ts"]
