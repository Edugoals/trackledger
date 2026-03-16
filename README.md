# TrackLedger

Tweerichtingssync met Google Calendar. Events in Google verschijnen in de app, events in de app worden naar Google gepusht.

Stack: Vue 3 • Node.js • MySQL • Prisma • Docker Compose

## Google Cloud Setup

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project of selecteer bestaand
3. **APIs & Services → Library** → zoek "Google Calendar API" → Enable
4. **APIs & Services → Credentials** → Create Credentials → OAuth client ID
5. Application type: **Web application**
6. **Authorized redirect URIs**:
   - `http://localhost:5173/api/auth/google/callback` (voor dev met Docker)
   - Bij productie: `https://jouwdomein.nl/api/auth/google/callback`
7. Kopieer Client ID en Client Secret naar `.env`

## Starten

```bash
cp .env.example .env
# Vul GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in
docker compose up --build
```

- **Client:** http://localhost:5173  
- **Server:** http://localhost:3001  
- **Adminer:** http://localhost:8080  

## Structuur

```
trackledger/
├── client/          # Vue 3 + Vite
├── server/          # Node.js + Express + Prisma + Google Calendar API
├── docker-compose.yml
└── .env.example
```

## Commando's

- `docker compose up --build` – start alles
- `docker compose down` – stop
- `docker compose exec server npx prisma studio` – database GUI
