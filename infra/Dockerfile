FROM node:22.21.1-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@9.15.9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/login/package.json apps/login/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY apps apps
COPY packages packages
COPY scripts scripts
RUN pnpm build
RUN pnpm --filter @rouge-one/api deploy --prod /production/api && cd /production/api && pnpm exec prisma generate

FROM node:22.21.1-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /production/api /app/apps/api
COPY scripts/prisma.mjs /app/scripts/prisma.mjs
COPY LICENSE NOTICE THIRD_PARTY_NOTICES.txt /app/
ENV HOST=0.0.0.0 PORT=3000
USER node
CMD ["node", "apps/api/build/app.js"]

FROM nginx:1.28.0-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist/rouge-one-app/browser /usr/share/nginx/html
COPY --from=build /app/apps/login/dist /usr/share/nginx/html/login
COPY examples/web /usr/share/nginx/html/example
COPY LICENSE NOTICE THIRD_PARTY_NOTICES.txt /usr/share/nginx/html/licenses/
