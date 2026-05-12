FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx esbuild src/client.js --bundle --outfile=public/bundle.js

EXPOSE 3000

CMD ["node", "server.js"]
