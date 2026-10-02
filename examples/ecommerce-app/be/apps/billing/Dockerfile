# ecommerce-app/billing - the billing api, built from this repository. The build context is the APP ROOT (the folder
# holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f be/apps/billing/Dockerfile -t ecommerce-app/billing:1.0.0 .
#
# It listens on 7070: the signed webhook door of the bank transfer notifier and the readiness probe; it also consumes the order stream and writes invoices. The tag in .starcistacks is the exact version
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
EXPOSE 7070
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:7070/health/ready > /dev/null || exit 1
CMD ["node", "be/dist/apps/billing/src/main.js"]
