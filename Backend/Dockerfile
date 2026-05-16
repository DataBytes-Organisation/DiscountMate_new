FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY src ./src

EXPOSE 8080

CMD ["node", "server.js"]
