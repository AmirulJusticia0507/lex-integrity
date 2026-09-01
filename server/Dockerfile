FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip make g++ cairo-dev pango-dev giflib-dev libc6-compat

# Support build dari root (docker-compose) maupun dari ./server (Railway)
COPY package*.json ./
COPY ./ ./

RUN npm ci --only=production

EXPOSE 3000

CMD ["npm", "start"]