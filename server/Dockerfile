FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip make g++ cairo-dev pango-dev giflib-dev libc6-compat

COPY server/package*.json ./

WORKDIR /app/server
RUN npm ci --only=production

COPY server/ ./

EXPOSE 3000

CMD ["npm", "start"]