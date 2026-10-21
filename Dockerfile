# One image for the starter shop. Build:  docker build -t btab-starter .
# The NEXT_PUBLIC_ values are baked into the browser code at build time,
# so pass them as build arguments (docker compose does this from .env.local).
FROM node:20.20.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20.20.2-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_BTAB_API_BASE=https://api.btab.app/api/storefront/v1
ARG NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SHOP_NAME="Starter Shop"
ENV NEXT_PUBLIC_BTAB_API_BASE=$NEXT_PUBLIC_BTAB_API_BASE \
    NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY=$NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SHOP_NAME=$NEXT_PUBLIC_SHOP_NAME \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.20.2-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
