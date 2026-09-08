FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

ENV NODE_ENV=production

EXPOSE 5000

USER node

CMD ["node", "server.js"]