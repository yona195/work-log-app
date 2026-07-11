# Single-service image: builds the React client and serves it from the API.
FROM node:22-alpine

WORKDIR /app

# Install deps first (better layer caching).
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

# Build the client.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]
