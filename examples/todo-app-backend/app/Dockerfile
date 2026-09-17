FROM node:22.22.0-alpine3.23
WORKDIR /app
COPY app/server.mjs ./server.mjs
RUN mkdir -p /var/lib/app && chown node:node /var/lib/app
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
