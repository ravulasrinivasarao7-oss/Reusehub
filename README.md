# ReUseHub — A Smart Material Reuse Platform

ReUseHub is a web application where businesses, offices, workshops, printing shops, and individuals can list unused materials (cardboard, wood, paper, plastic, metal, fabric, glass, …) so others can reuse them instead of throwing them away.

**Status: Part 1 (setup, homepage, health checks), Part 2 (accounts, sessions, password reset, material listings), and material requests/approvals.**
Inventory, notifications, statistics, and the admin dashboard are not implemented yet.

## Technology stack

| Layer    | Technology                                                        |
|----------|-------------------------------------------------------------------|
| Frontend | React 19, Vite 7, JavaScript, Tailwind CSS 4, React Router 7      |
| Backend  | Node.js, Express 4, dotenv, cors, cookie-parser, bcryptjs         |
| Database | PostgreSQL, Prisma ORM 6 (classic `schema.prisma` configuration)  |

Prisma is pinned to major version 6 because it uses `url = env("DATABASE_URL")` inside `schema.prisma`. Prisma 7 needs a separate `prisma.config.ts` and driver adapters, so do not upgrade without migrating the setup.

## Prerequisites

- Node.js **20.19 or newer** (required by Vite 7) and npm
- PostgreSQL 14+ running locally, with the `psql`/`createdb` tools
- Git

## Folder structure

```
reusehub/
├── frontend/            React + Vite + Tailwind app
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/  Navbar, Hero, MaterialCard, ConnectionStatus, ...
│   │   ├── data/        sampleMaterials.js (TEMPORARY demo data)
│   │   ├── pages/       HomePage, ComingSoonPage
│   │   ├── services/api.js
│   │   ├── App.jsx, App.css, index.css, main.jsx
│   ├── index.html
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── backend/             Express + Prisma API
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── config/      env.js (validation), database.js (Prisma client)
│   │   ├── controllers/ health.controller.js
│   │   ├── middleware/  errorHandlers.js
│   │   ├── routes/      health.routes.js
│   │   ├── services/
│   │   └── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
├── docs/setup.md
├── .gitignore
└── README.md
```

## Installation

```bash
git clone <your-repo-url> reusehub && cd reusehub   # or just cd into the folder

cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

## Environment variables

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

(Windows PowerShell: use `Copy-Item` instead of `cp`.)

**backend/.env**

| Variable       | Purpose                                              | Example                                              |
|----------------|------------------------------------------------------|------------------------------------------------------|
| `PORT`         | Port the API listens on                              | `5000`                                               |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated              | `http://localhost:5173`                              |
| `DATABASE_URL` | PostgreSQL connection string (**set your own**)      | `postgresql://USER:PASSWORD@localhost:5432/reusehub?schema=public` |

**frontend/.env**

| Variable            | Purpose                       | Example                     |
|---------------------|-------------------------------|-----------------------------|
| `VITE_API_BASE_URL` | Backend API base (with `/api`) | `http://localhost:5000/api` |

Keep these consistent: the port in `VITE_API_BASE_URL` must equal the backend `PORT`, and `FRONTEND_URL` must equal the address Vite serves on (`http://localhost:5173`). The backend refuses to start if `DATABASE_URL` is missing, malformed, or still contains the placeholder values. `.env` files are git-ignored.

Password reset uses Resend. Set `RESEND_API_KEY` and `EMAIL_FROM` in the backend environment, using a sender address on a domain verified with Resend. Set `FRONTEND_URL` to the frontend origin; reset links use its first configured origin. Never put email-provider credentials in frontend environment variables or commit them.

## PostgreSQL database setup

Create the database (replace `postgres` with your own PostgreSQL user if different):

```bash
createdb -U postgres reusehub
# or
psql -U postgres -c "CREATE DATABASE reusehub;"
```

Then put your real user and password into `DATABASE_URL` in `backend/.env`. If the password has special characters (`@ : / # ?`), URL-encode them.

## Prisma commands

Run from `backend/`:

```bash
npx prisma generate                    # generate the Prisma client  (npm run prisma:generate)
npx prisma migrate dev --name init     # create + apply the initial migration (npm run prisma:migrate -- --name init)
npx prisma migrate status              # confirm the migration is applied
npx prisma studio                      # optional: browse the database
```

`prisma init` has already been done for you (`prisma/schema.prisma` exists). The only model is a placeholder `SystemCheck` table so the first migration has something to apply. Commit the generated `prisma/migrations/` folder.

## Running the app

Backend (terminal 1):

```bash
cd backend
npm run dev        # http://localhost:5000
```

Frontend (terminal 2):

```bash
cd frontend
npm run dev        # http://localhost:5173
```

Production build of the frontend: `cd frontend && npm run build`.

## Health-check endpoints

| Endpoint                   | Description                                           |
|----------------------------|-------------------------------------------------------|
| `GET /api/health`          | Confirms the Express server is running                |
| `GET /api/health/database` | Runs a real query through Prisma against PostgreSQL   |

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"ReUseHub backend is running"}

curl http://localhost:5000/api/health/database
# {"success":true,"message":"Database connection successful",
#  "database":{"connected":true,"name":"reusehub","serverTime":"2026-..."}}
```

If the database is unreachable the endpoint returns HTTP 503 with `{"success":false,"message":"Unable to connect to the database","database":{"connected":false}}`. No credentials or stack traces are ever returned.

In development the homepage shows a **Development diagnostics** panel (hidden in production builds) with the states *Checking connection…*, *Backend connected*, *Database connected*, and *Connection failed*.

## Part 2: accounts, password reset, and material listings

### Upgrading an existing Part 1 install

```bash
cd backend
npm install                                     # adds bcryptjs and cookie-parser
npx prisma generate
npx prisma migrate dev
cd ../frontend && npm install
```

(On Windows PowerShell with script execution blocked, use `npm.cmd` / `npx.cmd`.)
Password reset also requires `RESEND_API_KEY` and `EMAIL_FROM` in the backend environment.

### Database models

`User`, `Session`, `PasswordResetToken`, `Material`, and `MaterialRequest` (+ enums `MaterialCategory`, `MaterialCondition`, `MaterialRequestStatus`). A material belongs to its owner (`ownerId`, deleted with the user), and requests link a requester to a material; the `(materialId, requesterId)` unique constraint prevents duplicate requests. Request statuses are `PENDING`, `ACCEPTED`, `REJECTED`, and `CANCELLED`. Passwords are stored only as bcrypt hashes; sessions store only a SHA-256 hash of a random token, which the browser keeps in an httpOnly cookie (`reusehub_session`, 7 days). Password reset tokens are SHA-256 hashed in the database, expire after 30 minutes, and are single-use.

### API

All responses are JSON: `{ "success": true, "data": ..., "meta": ... }` or `{ "success": false, "message": "...", "errors": { "field": "..." } }`.

| Method & path | Auth | Description |
|---|---|---|
| `POST /api/auth/register` | no | Create account and log in (201) |
| `POST /api/auth/login` | no | Log in |
| `POST /api/auth/forgot-password` | no | Email a one-time reset link if the account exists |
| `POST /api/auth/reset-password` | no | Set a new password with the emailed token and invalidate sessions |
| `POST /api/auth/logout` | no | End session |
| `GET /api/auth/me` | yes | Current user (401 when logged out) |
| `GET /api/materials` | yes | Available listings. Query: `search`, `category`, `condition`, `location`, `availability` (`available` default, `unavailable`, `all`), `page`, `limit` (max 50) |
| `GET /api/materials/mine` | yes | Your listings (all statuses by default), same query options |
| `GET /api/materials/:id` | yes | One listing |
| `POST /api/materials` | yes | Create (owner = logged-in user, never taken from the body) |
| `PUT /api/materials/:id` | owner | Update |
| `PATCH /api/materials/:id/availability` | owner | Body `{ "isAvailable": true|false }` |
| `DELETE /api/materials/:id` | owner | Delete |
| `POST /api/requests/materials/:materialId` | yes | Request an available material |
| `GET /api/requests/mine` | yes | List your material requests and statuses |
| `GET /api/requests/received` | yes | List requests for your materials |
| `PATCH /api/requests/:id/status` | yes | Owner accepts/rejects, or requester cancels; body `{ "status": "ACCEPTED"|"REJECTED"|"CANCELLED" }` |

Status codes: 400 validation, 401 not logged in, 403 unauthorized action, 404 not found, 409 conflict (for example duplicate request or unavailable material), 429 too many login attempts, 503 database unavailable. Categories: `CARDBOARD WOOD PAPER PLASTIC METAL FABRIC GLASS OTHER`. Conditions: `NEW LIKE_NEW GOOD FAIR USED`. Images are **URLs only** (http/https); there is no file upload.

Per your Part 2 brief, every materials endpoint requires login. To make browsing public later, move `router.use(requireAuth)` in `backend/src/routes/materials.routes.js` onto the write routes only.

### Frontend routes

`/` home, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/materials` (search + filters), `/materials/new`, `/materials/:id`, `/materials/:id/edit`, `/my-listings`, `/my-requests`, `/received-requests`. Pages other than home, login, register, and password reset pages redirect to login when logged out.

### Password reset deployment

Configure `RESEND_API_KEY`, `EMAIL_FROM`, and the frontend origin in `FRONTEND_URL` on the backend host. Review the additive password-reset and material-request migrations, then apply approved migrations with `npx prisma migrate deploy`. The material-request migration adds only the status enum, `material_requests` table, indexes, and foreign keys; it does not recreate or modify existing users, materials, sessions, or request data. For an existing database with tables but no Prisma migration history, first verify its schema matches `backend/prisma/migrations/0_init/migration.sql`; only then baseline that initial migration once with `npx prisma migrate resolve --applied 0_init`, followed by `npx prisma migrate deploy`. Do not run `migrate reset` on a database with user data. Do not apply migrations to production until they have been reviewed and approved.

### Automated API test

With the backend running and the migrations applied to a **development/test database**:

```bash
cd backend
npm run test:api       # npm.cmd run test:api on restricted PowerShell
```

It registers throw-away users and checks accounts, materials, request creation, duplicate and ownership restrictions, accepting/rejecting/cancelling, availability, and logout. It leaves test records in your dev database.

## Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `Invalid environment configuration` on backend start | `backend/.env` missing or `DATABASE_URL` is a placeholder. Copy `.env.example` and edit it. |
| `Cannot find module '.prisma/client'` / `@prisma/client did not initialize yet` | Run `npx prisma generate` in `backend/`. |
| Database panel shows *Connection failed* but backend is connected | PostgreSQL not running, wrong credentials/port/database name, or the database was never created. Check the backend terminal (it logs only the error name/code). |
| Prisma `P1000` | Authentication failed — wrong user or password in `DATABASE_URL`. |
| Prisma `P1001` | Cannot reach the server — PostgreSQL stopped or wrong host/port. |
| Prisma `P1003` | Database does not exist — run `createdb reusehub`. |
| Browser shows a CORS error | `FRONTEND_URL` in `backend/.env` doesn't match the origin in the address bar (e.g. `127.0.0.1` vs `localhost`). Restart the backend after changing it. |
| Frontend can't reach backend | Backend not running, or `VITE_API_BASE_URL` has the wrong port. Restart `npm run dev` after editing `frontend/.env`. |
| `EADDRINUSE` | Port already in use. Change `PORT` (and `VITE_API_BASE_URL`) or stop the other process. |
| Vite fails on Node version | Upgrade to Node 20.19+. |
| `Cannot find package 'bcryptjs'` / `'cookie-parser'` | Run `npm install` in `backend/` after pulling Part 2. |
| `The table public.users does not exist` | Run `npx prisma migrate dev --name add_users_sessions_materials` in `backend/`. |
| Logged out immediately after login | Open the app at the same host as `FRONTEND_URL` (`localhost`, not `127.0.0.1`) and make sure `VITE_API_BASE_URL` uses `localhost` too. |
| 403 "Cross-origin request blocked." | The browser origin is not listed in `FRONTEND_URL`. |
