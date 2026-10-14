# lite-app/web - the Next web app (standalone output). The build context is the APP ROOT
# (the folder holding the one package.json and package-lock.json), not this folder:
#
#   docker build -f fe/apps/web/Dockerfile -t lite-app/web:<tag> .
#
# Pass the public browser configuration with --build-arg NEXT_PUBLIC_<NAME>.
# Credentials are mounted at run time; no service-role key enters this image.

FROM node:22.14.0-alpine3.21 AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY fe fe
RUN find fe -type f ! -name package.json -delete

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
COPY --from=manifests /app ./
RUN npm ci --ignore-scripts

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GRAPHQL_URL
ARG NEXT_PUBLIC_REST_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY turbo.json ./
COPY scripts scripts
COPY fe/tsconfig.json fe/tsconfig.json
COPY be/contracts be/contracts
COPY supabase/migrations supabase/migrations
COPY supabase/types supabase/types
COPY fe/apps/web fe/apps/web
RUN mkdir -p fe/apps/web/public
RUN npm run codegen --silent
RUN node_modules/.bin/turbo run build --filter=@lite-app/web

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/fe/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/fe/apps/web/.next/static ./fe/apps/web/.next/static
COPY --from=build --chown=node:node /app/fe/apps/web/public ./fe/apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "fe/apps/web/server.js"]
