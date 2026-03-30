FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npm install && npm run dev -- --hostname 0.0.0.0 --port 3001"]
