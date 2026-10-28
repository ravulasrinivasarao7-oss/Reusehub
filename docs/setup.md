# ReUseHub — Setup Guide (Part 1)

Quick path, assuming Node 20.19+ and PostgreSQL are installed and running.

```bash
# 1. Dependencies
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Environment files
cp backend/.env.example  backend/.env     # then edit DATABASE_URL
cp frontend/.env.example frontend/.env

# 3. Database
createdb -U postgres reusehub

# 4. Prisma (from backend/)
cd backend
npx prisma generate
npx prisma migrate dev --name init

# 5. Start the servers (two terminals)
npm run dev                  # backend  -> http://localhost:5000
cd ../frontend && npm run dev   # frontend -> http://localhost:5173
```

## Verification checklist

1. `curl http://localhost:5000/api/health` returns `"success": true`.
2. `curl http://localhost:5000/api/health/database` returns `"connected": true` and your database name.
3. Open http://localhost:5173 — the Development diagnostics panel shows *Backend connected* and *Database connected*.
4. Stop PostgreSQL and click **Re-check**: the panel should show *Database: Connection failed* while the backend stays connected.
5. Type "paper" in the search box, and click category chips: the card list should filter, with a count announced below the chips.
6. Resize the window (or use browser dev tools device mode) to confirm the layout adapts to mobile, tablet, and desktop.

## Windows notes

- Use `Copy-Item backend\.env.example backend\.env` in PowerShell.
- If `createdb` isn't on PATH, use pgAdmin or the SQL Shell (psql) and run `CREATE DATABASE reusehub;`.

## Resetting the local database

```bash
cd backend
npx prisma migrate reset     # DROPS all data in the dev database, then re-applies migrations
```

## Part 2 additions

```bash
cd backend && npm install
npx prisma generate
npx prisma migrate dev --name add_users_sessions_materials
npm run dev                  # terminal 1
npm run test:api             # terminal 2, optional end-to-end API check
cd ../frontend && npm install && npm run dev
```

Manual browser checks: register, create a listing, edit it, mark it unavailable, filter on /materials, delete it from My Listings, log out and confirm /my-listings redirects to login. Register a second account and confirm it sees no Edit/Delete buttons on the first account's listing.
