FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p data uploads

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV UPLOAD_DIR=/app/uploads

VOLUME ["/app/data", "/app/uploads"]

CMD ["node", "server.js"]
