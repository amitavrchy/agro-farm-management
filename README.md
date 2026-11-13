# Agro / Farm Management

Bangladesh-focused farm operating system for small, commercial, individual, cooperative, contract, and multi-farm organizations — covering crops, horticulture, livestock, dairy, poultry, and aquaculture — plus a vendor marketplace (vets, input suppliers, equipment rental, labor contractors, buyers, transport).

The full advanced specification for AI coding agents is in [Project_spec.md](./Project_spec.md) (also referenced from [backend/Project_spec.md](./backend/Project_spec.md)).

## Stack
- Frontend: Next.js (App Router, PWA) in `frontend/`
- Backend: NestJS + Prisma + PostgreSQL/PostGIS + Redis/BullMQ in `backend/`

There is no root workspace `package.json`. Install and run each package independently (or use `npm run dev:all` from `backend/` after setup).

## Local setup

Requires Node.js 22+ and Docker.

```bash
cd backend
cp .env.example .env
# copy frontend/.env.example to frontend/.env.local as well
npm install
docker compose up -d --wait
npx prisma generate
# migrations will be added as the schema is implemented
npm run dev
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Default ports: web `http://localhost:3220`, API `http://localhost:4220`.

## Status
Scaffold + `Project_spec.md`. Domain implementation is not started; follow the spec milestones.
