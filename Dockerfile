FROM node:25.9.0-alpine AS builder
RUN npm install -g pnpm@10.12.4
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:25.9.0-alpine
WORKDIR /app
COPY --from=builder /app/.output .output
COPY --from=builder /app/server/db/migrations /app/server/db/migrations
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["node", ".output/server/index.mjs"]
