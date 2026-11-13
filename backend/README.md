# Agro Farm API

NestJS + Prisma + PostgreSQL/PostGIS + Redis/BullMQ + Socket.IO. All server source, schema, and verification live here. The web app is `../frontend/`.

See [Project_spec.md](./Project_spec.md) (canonical: [../Project_spec.md](../Project_spec.md)) for modules, RBAC, schema, APIs, jobs, and acceptance criteria.

## Setup

```bash
cp .env.example .env
npm install
docker compose up -d --wait
npx prisma generate
npm run dev
```

API default: http://localhost:4220
