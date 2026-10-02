# lite-app/cli - the cli command app: every one-off action (migrate, seed, sync, backup) is one command of this
# image, run with the command as its arguments, e.g. `docker run --rm lite-app/cli:<tag> migrate run`. The build context is
# the APP ROOT (the folder holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f be/apps/cli/Dockerfile -t lite-app/cli:<tag> .
#
# It follows the image canon (knowledge/hfs/docker.md) and diverges from it nowhere. No secret is built in: credentials are
# mounted at run time and .dockerignore keeps them out of the build context.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY be/tsconfig.json be/tsconfig.build.json be/
COPY be/src be/src
COPY be/apps/cli be/apps/cli
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=manifests /app ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist

USER node
HEALTHCHECK NONE
ENTRYPOINT ["node", "be/dist/apps/cli/src/main.js"]
CMD ["--help"]
