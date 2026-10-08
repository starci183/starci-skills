# ecommerce-app/landing - the landing Next app (standalone output). The build context is the APP ROOT (the folder holding the one
# package.json and package-lock.json), not this folder:
#
#   docker build -f fe/apps/landing/Dockerfile -t ecommerce-app/landing:<tag> .
#
# NEXT_PUBLIC_* values are published to every browser by design, so they are the one kind of build argument:
# add `ARG NEXT_PUBLIC_<NAME>` here and pass it with `--build-arg`. It follows the image canon (knowledge/hfs/docker.md) and
# diverges from it nowhere. No secret is built in: credentials are mounted at run time and .dockerignore keeps them out of the
# build context.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

COPY turbo.json ./
COPY scripts scripts
COPY fe/tsconfig.json fe/tsconfig.json
COPY fe/packages fe/packages
COPY fe/apps/landing fe/apps/landing
RUN mkdir -p fe/apps/landing/public
RUN npm run codegen --silent
RUN node_modules/.bin/turbo run build --filter=@ecommerce-app/landing

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3069
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/fe/apps/landing/.next/standalone ./
COPY --from=build --chown=node:node /app/fe/apps/landing/.next/static ./fe/apps/landing/.next/static
COPY --from=build --chown=node:node /app/fe/apps/landing/public ./fe/apps/landing/public

USER node
EXPOSE 3069
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "fe/apps/landing/server.js"]
