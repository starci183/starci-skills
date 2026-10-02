# The cli image: ONE image for every one-off action of the back end, run as `cli <group> <command>` (`cli migrate run`).
# Built from the app root (the monorepo root holds the one package.json and lockfile).
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund && npm run build:be
ENTRYPOINT ["node", "be/dist/apps/cli/src/main.js"]
