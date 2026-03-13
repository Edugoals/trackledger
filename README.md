# TrackLedger

Stack: Vue 3 (client) • Node.js (server) • MySQL (database) • Prisma (ORM) • Docker Compose

## Starten

```bash
cp .env.example .env   # eventueel aanpassen
docker compose up --build
```

- **Client:** http://localhost:5173  
- **Server:** http://localhost:3000  
- **Database:** localhost:3306 (MySQL)

## Structuur

```
trackledger/
├── client/          # Vue 3 + Vite
├── server/          # Node.js + Express + Prisma
├── docker-compose.yml
└── .env.example
```

## Commando's

- `docker compose up --build` – alles bouwen en starten
- `docker compose down` – stoppen
- `docker compose exec server npx prisma studio` – Prisma Studio (db GUI)
