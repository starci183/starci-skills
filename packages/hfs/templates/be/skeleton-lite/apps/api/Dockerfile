# {{project}}/api - the api app. The build context is the APP ROOT (the folder holding the one package.json and
# package-lock.json), not this folder:
#
#   docker build -f be/apps/api/Dockerfile -t {{project}}/api:<tag> .
#
# It follows the image canon and diverges from it nowhere. Credentials are mounted at run time and never enter the image.

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
COPY supabase/types supabase/types
COPY be/apps/api be/apps/api
RUN npm run build:be

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=manifests /app ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/be/dist be/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "be/dist/apps/api/src/main.js"]
