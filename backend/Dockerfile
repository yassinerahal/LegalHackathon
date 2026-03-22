# 1. Wir nehmen ein extrem schlankes Linux mit vorinstalliertem Node.js
FROM node:20-alpine

# 2. Wir erstellen einen Arbeitsordner im Container
WORKDIR /usr/src/app

# 3. Wir kopieren erst nur die Paket-Infos (für schnelleres Bauen)
COPY package*.json ./

# 4. Wir installieren alle nötigen Node-Pakete (wie express, aws-sdk)
RUN npm install

# 5. Jetzt kopieren wir euren gesamten restlichen Code in den Container
COPY . .

# 6. Wir geben den Port frei, auf dem euer Backend läuft (z.B. 3000)
EXPOSE 3000

# 7. Der Befehl, um euren Server zu starten
CMD ["node", "server.js"]