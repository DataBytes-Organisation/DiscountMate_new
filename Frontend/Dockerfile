FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG EXPO_PUBLIC_API_URL=http://localhost:3000/api
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

RUN npm run build:web

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY server.js ./server.js
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "server.js"]
