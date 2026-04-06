FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.output .output
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["node", ".output/server/index.mjs"]
