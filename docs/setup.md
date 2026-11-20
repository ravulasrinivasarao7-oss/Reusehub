# ReUseHub — Setup Guide (Part 1)

Quick path, assuming Node 20.19+ and PostgreSQL are installed and running.

```bash
# 1. Dependencies
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Environment files
cp backend/.env.example  backend/.env     # then edit DATABASE_URL, Cloudinary, and email settings
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
npx prisma migrate dev
npm run dev                  # terminal 1
npm run test:api             # isolated API tests; starts its own local server
cd ../frontend && npm install && npm run dev
```

Manual browser checks: register, create a listing, edit it, mark it unavailable, filter on /materials, delete it from My Listings, log out and confirm /my-listings redirects to login. Register a second account and confirm it sees no Edit/Delete buttons on the first account's listing.

## Isolated API test database

The API test runner reads only `API_TEST_DATABASE_URL` from `backend/.env.test`; it does not fall back to `DATABASE_URL` or `API_BASE_URL`. It requires the dedicated local endpoint `reusehub_test@127.0.0.1:55432/reusehub_api_test`, applies migrations there, and starts its own backend bound to loopback. The existing backend `.env` and any separately running server are not used.

On Windows, create a separate local PostgreSQL cluster (adjust the PostgreSQL install path/version if needed):

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$dataDir = Join-Path $env:LOCALAPPDATA 'ReuseHubApiTestPostgres'
& "$pgBin\initdb.exe" -D $dataDir -U reusehub_test -A trust
& "$pgBin\pg_ctl.exe" -D $dataDir -l (Join-Path $dataDir 'postgresql.log') -o '-h 127.0.0.1 -p 55432' start
& "$pgBin\createdb.exe" --encoding=UTF8 --template=template0 -h 127.0.0.1 -p 55432 -U reusehub_test reusehub_api_test
Copy-Item backend\.env.test.example backend\.env.test
```

This cluster is independent of the installed PostgreSQL service and must remain bound to `127.0.0.1`; do not expose it on a network interface. `backend/.env.test` is ignored by Git. Run `npm run test:api` from `backend/`; it creates test records only in this isolated database. Stop the cluster when not needed with `pg_ctl -D $dataDir stop`. Do not point `API_TEST_DATABASE_URL` at production or another database; the runner rejects any URL outside the exact local endpoint above.

## Persistent image uploads

Configure `CLOUDINARY_URL` in `backend/.env` from the Cloudinary dashboard. Both profile-picture and material uploads are sent to Cloudinary using the backend SDK, and the API saves Cloudinary's secure HTTPS URL. Uploads accept JPG/JPEG, PNG, and WebP files up to 5 MB and check file signatures. No database migration is needed. `MATERIAL_UPLOAD_DIR` is optional and only serves legacy images previously stored under `/uploads`.

## Deploying on Render

- **Backend Web Service:** use `backend` as the root directory, `npm install && npx prisma generate` as the build command, and `npm start` as the start command. Set `DATABASE_URL`, `CLOUDINARY_URL`, `NODE_ENV=production`, and `FRONTEND_URL` to the deployed frontend origin. Set `MATERIAL_UPLOAD_DIR` and attach a persistent disk only if legacy `/uploads` images need to remain available.
- **Frontend Static Site:** use `frontend` as the root directory, `npm install && npm run build` as the build command, and `dist` as the publish directory. Set `VITE_API_BASE_URL` to the backend's public URL ending in `/api`.
- Redeploy both services after setting environment variables. No database migration is needed for these fixes; keep the existing Render PostgreSQL database and migration history intact.

## Password reset email setup

Set `RESEND_API_KEY` and `EMAIL_FROM` in `backend/.env` and in the backend hosting provider. The sender must be on a domain verified with Resend. Set `FRONTEND_URL` to the frontend origin (for example `https://your-site.vercel.app`) so reset links point back to the deployed app. Apply the additive schema migration with `npx prisma migrate dev` against a development database or `npx prisma migrate deploy` in production.

If a production database already has application tables but no Prisma migration history, verify that its schema matches `backend/prisma/migrations/0_init/migration.sql` before baselining. If it matches, run `npx prisma migrate resolve --applied 0_init` once, then `npx prisma migrate deploy`. Do not use `migrate reset` on a database containing user data. Never put Resend credentials in frontend environment variables or commit them.
