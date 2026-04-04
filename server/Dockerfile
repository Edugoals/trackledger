FROM node:20-bookworm-slim

ENV TZ=Europe/Amsterdam
# Chromium + libs (glib, nss, …) — nodig voor Puppeteer/PDF in een minimale image
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl \
    tzdata \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Gebruik systeem-Chromium i.p.v. de door npm gedownloade binary (die mist vaak libs in Docker)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN test -x /usr/bin/chromium || (echo "Chromium binary not found at /usr/bin/chromium" && exit 1)

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --force-reset && npx prisma db seed && node src/index.js"]
