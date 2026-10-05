# node:20-bullseye ya no compila: bullseye llego a EOL y sus paquetes dan 404
# en deb.debian.org. bookworm mantiene el mismo runtime Node 20.
FROM node:20-bookworm

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libexpat1 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  wget \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# whatsapp-web.js#main se resuelve en el lockfile como git+ssh; reescribir a
# https para poder clonar el repo publico sin credenciales SSH en el build.
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

COPY package*.json ./
RUN npm install --omit=dev

# Instalar el Chrome bundled de Puppeteer: el chromium del sistema (v144)
# causa el hang del "ready" en whatsapp-web.js (issue #127084).
RUN npx puppeteer browsers install chrome

COPY . .

CMD ["node", "src/index.js"]