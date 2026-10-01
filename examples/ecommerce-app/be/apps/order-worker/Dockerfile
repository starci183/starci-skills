# ecommerce-app/order-worker - the order worker, built from this repository. The build context is the APP ROOT (the folder
# holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f be/apps/order-worker/Dockerfile -t ecommerce-app/order-worker:1.0.0 .
#
# The worker has no listener: it consumes the billing events and compensates the orders whose invoice was rejected. The tag in .starcistacks is the exact version
# of this image; compose names it and the stack never uses a moving tag.

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app

# One install from the shared root lockfile; the fe workspace packages are listed by it, so their manifests come along.
COPY package.json package-lock.json ./
COPY fe/packages fe/packages
RUN npm ci --ignore-scripts

COPY be/tsconfig.json be/tsconfig.build.json be/
COPY be/src be/src
COPY be/apps be/apps
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY fe/packages fe/packages
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist

# runs unprivileged
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD pgrep -f "apps/order-worker/src/main.js" > /dev/null || exit 1
CMD ["node", "be/dist/apps/order-worker/src/main.js"]
