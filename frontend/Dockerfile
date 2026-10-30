# --- build ---
# The output is static files, so the build runs natively on the builder's
# platform even for an arm64 image, instead of under QEMU emulation.
FROM --platform=$BUILDPLATFORM node:22.23.2-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm generate-routes && pnpm build

# --- serve ---
FROM nginx:1.30.4

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
