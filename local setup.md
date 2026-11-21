# CertiFlow

Training batch approval, certificate issuance, mock WhatsApp delivery, and public certificate verification.

This is the combined setup guide for the backend and frontend. Run commands from the repository root unless a step explicitly changes folders.

## Stack and prerequisites

- Node.js 24 LTS and npm (the project has been tested with Node 24).
- Docker Desktop/Engine with Docker Compose, running before infrastructure commands.
- MongoDB Atlas or the local Docker MongoDB replica set. Transactions require a replica set; standalone MongoDB is insufficient.
- Backend: JavaScript, Express, Mongoose, BullMQ and Redis 7.
- Frontend: React, TypeScript, Vite, Tailwind CSS and TanStack Query. Fixed white theme.

The original hackathon brief specifies PostgreSQL and a TypeScript backend. This project deliberately uses MongoDB and a JavaScript backend at the project owner's request.

## 1. Install dependencies

Open a terminal in the cloned repository:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Alternatively, install from inside each project folder:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

If you want to install strictly from the committed lockfiles, use:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

Use the committed npm lockfiles. The frontend uses esbuild `^0.28.0`, compatible with its Vite version; do not restore the old `^0.25.0` override or use `--force` to bypass dependency conflicts.

## 2. Configure backend environment

Create `backend/.env` using `backend/.env.example` as a reference. Preserve your existing `.env` if already configured. Never paste real database credentials into this README or frontend files.

```env
NODE_ENV=development
PORT=7000
MONGO_URI=mongodb://localhost:27017/AlgoHire?replicaSet=rs0&directConnection=true
JWT_SECRET=replace-with-your-own-random-secret-at-least-32-characters
REDIS_URL=redis://127.0.0.1:6379
PUBLIC_API_URL=http://localhost:7000
CORS_ORIGIN=http://localhost:8080
DEMO_MODE=true
DEMO_PASSWORD=CertiFlowDemo123!
SLA_HOURS=24
MOCK_FAILURES=true
QUEUE_NAME=certiflow
```

Generate your own JWT secret and paste its output into `JWT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Atlas connection string or the local replica-set URI above; database name is `AlgoHire`. |
| `JWT_SECRET` | Private signing secret, at least 32 characters. Keep stable across API/worker restarts. |
| `REDIS_URL` | Redis used by the background queue. |
| `PUBLIC_API_URL` | Backend address embedded in PDF QR codes and signed download links. |
| `CORS_ORIGIN` | Exact permitted frontend origin; use `http://localhost:8080` locally. |
| `NODE_ENV` | `development` locally; `production` hides the printed PDF verification token and disables demo endpoints. |
| `DEMO_MODE` | Enables demo seeding and backend demo-login endpoints outside production. |
| `DEMO_PASSWORD` | Password assigned to demo accounts when first seeded. |
| `SLA_HOURS` | Review-stage deadline before escalation; default 24 hours. |
| `MOCK_FAILURES` | Simulates provider failures and timeouts for retry demonstrations. |
| `QUEUE_NAME` | Optional BullMQ queue name. API and worker must use the same value. |

`npm run setup --prefix backend` is an optional helper that creates/fills missing settings while preserving existing values. Always review the resulting file: explicitly set CORS to port 8080 and supply your own JWT secret.

### Choose a MongoDB option

**Option A: Atlas (your existing hosted database)**

Set `MONGO_URI` to your Atlas URI with `/AlgoHire` as the database. Allow your development IP in Atlas Network Access and use a database user with access to this database. Start only Redis locally:

```powershell
docker compose -f backend/docker-compose.yml up -d --wait redis
```

**Option B: local MongoDB and Redis**

Use the local `MONGO_URI` from the example above:

```powershell
docker compose -f backend/docker-compose.yml up -d --wait
```

The MongoDB health check initializes a single-node replica set. Ports 27017 and 6379 bind to localhost. The Compose configuration supplies infrastructure only; API, worker and frontend run as local Node processes.

Check containers:

```powershell
docker compose -f backend/docker-compose.yml ps
```

Docker Desktop may group these containers under `backend`, because that is the Compose directory name. Check `docker compose ls` to identify the actual configuration path. Changing a project name creates a separate set of containers/volumes; avoid starting another Redis on the same host port.

## 3. Configure frontend environment

Create `frontend/.env.local` with:

```env
VITE_API_BASE_URL=http://localhost:7000
```

The frontend needs only this API setting for CertiFlow. Gemini/API-key placeholders in the generated example are not required for these workflows. Do not put MongoDB credentials, JWT secrets or Redis settings in frontend environment files: Vite frontend variables are public.

Vite is configured for port **8080** with `strictPort: true`. Restart the frontend after changing its environment. Restart the API and worker after changing backend settings.

## 4. Seed demo users and batches

After MongoDB is ready and backend demo mode is enabled:

```powershell
npm run seed --prefix backend
```

The seed creates six demo accounts, a three-candidate draft and a 60-candidate submitted batch. Rerunning it preserves existing accounts/batches; it does not reset passwords.

Use [ROLES_AND_CREDENTIALS.md](./ROLES_AND_CREDENTIALS.md) for login details and responsibilities. Sign in through the normal email/password form. Public login screens intentionally do not display account lists or one-click demo switching. The backend demo endpoints remain available for Postman when demo mode is enabled.

## 5. Start the application

Keep three terminals open, each starting from the repository root.

**Terminal 1: backend API**

```powershell
npm run dev --prefix backend
```

Alternatively, use `npm start --prefix backend` without automatic restart. Do not run both on port 7000.

**Terminal 2: background worker**

```powershell
npm run worker --prefix backend
```

The worker processes certificate issuance, delivery retries and overdue-stage escalations. Final approval alone does not immediately complete delivery.

**Terminal 3: frontend**

```powershell
npm run dev --prefix frontend
```

| Service | Address |
| --- | --- |
| Frontend | http://localhost:8080 |
| Login | http://localhost:8080/login |
| Public verification | http://localhost:8080/verify |
| Backend health | http://localhost:7000/health |
| API base | http://localhost:7000/api |

If you are already inside `backend/` or `frontend/`, omit `--prefix backend` or `--prefix frontend` respectively.

### Stop and start again

Use Ctrl+C in each Node terminal. Stop this project's infrastructure without deleting its data:

```powershell
docker compose -f backend/docker-compose.yml stop
```

Next time, run the appropriate `up -d --wait` command and start the three Node processes. Do not reseed on every start. Do not use `down -v` unless you intend to delete local database/queue volumes.

## Using CertiFlow

| Role | Responsibilities |
| --- | --- |
| Anika: centre | Creates batches, imports candidates, submits, corrects returned rosters, downloads certificates and tracks delivery. |
| Dev, Meera, Kabir: district | Review batches in their district. Two different officers must approve. |
| Neha: quality | Reviews batches with **more than 50** candidates after district approval. |
| Farah: state | Final approval, escalation monitoring, failed-job recovery and certificate revocation. |
| Candidate | Downloads through a signed link; no staff account needed. |
| Public/employer | Verifies current validity without login. |

### Issue a certificate

1. Sign in as Anika, choose **New Batch**, enter title/course and create a draft.
2. Import [the 50-candidate sample CSV](./backend/samples/candidates.csv), or enter your own candidates. Validate before saving, then submit.
3. Sign in as Dev and approve through Review Inbox.
4. Sign in as Meera or Kabir and give the second district approval.
5. For 51 or more candidates, sign in as Neha and approve. Exactly 50 candidates skip quality review.
6. Sign in as Farah and approve through Final Inbox.
7. The worker issues certificates. Open the batch's Certificates and Delivery tabs to follow progress, download PDFs and preview mock messages.

One district approval is insufficient for Farah's inbox. Use Programme Batches to inspect earlier stages. A reviewer may return/reject with a reason; return allows correction, while rejection is terminal. Resubmission creates a new revision, resets all approvals and retains previous decisions and submitted snapshots. Only draft/returned batches are editable.

### Upload rules

- CSV/XLSX, one file per upload, maximum 2 MB and 1–500 candidate rows.
- First worksheet for XLSX; keep phone values as text.
- Exact headers: `candidateId,name,phone,courseCompletedOn`.
- Unique, case-insensitive candidate IDs within the batch; international phone format; valid completion date no later than today.
- Successful import replaces the whole roster atomically. Invalid rows leave the prior roster unchanged and return row/field errors.
- [Invalid sample](./backend/samples/invalid-candidates.csv) demonstrates validation failures.

```csv
candidateId,name,phone,courseCompletedOn
C001,Asha Rao,+919000000001,2026-01-01
```

### Verify and download locally

Use **Verify** beside an issued certificate, or paste its verification token/URL into `/verify`. The current implementation does **not** accept the printed `CF-...` certificate number as lookup input. It displays that number in the verification result.

Locally generated PDFs print the verification token below the QR code. With `NODE_ENV=production`, newly generated PDFs omit that text; older downloaded files remain unchanged. After changing PDF settings, restart the API and download the PDF again.

QR codes currently open the backend verification API and show JSON. On a phone, `localhost` refers to the phone itself. For same-Wi-Fi QR testing:

1. Run `ipconfig` on Windows and find the computer's Wi-Fi IPv4 address.
2. Set `PUBLIC_API_URL=http://YOUR_WIFI_IP:7000` in `backend/.env`.
3. Restart API/worker, then download the PDF again for the new QR code.
4. Confirm the phone can open `http://YOUR_WIFI_IP:7000/health`; allow Node through the private-network firewall if needed.
5. Scan the new QR. Existing stored mock-message links are not rewritten by this setting change.

For the frontend on your phone, also set `VITE_API_BASE_URL` to the computer's API address and `CORS_ORIGIN` to `http://YOUR_WIFI_IP:8080`, restart both servers, and open that frontend address. The backend currently accepts one configured frontend origin.

Public verification returns status, certificate number, masked name, course, centre and dates. Signed PDF download links are separate and expire after seven days. Farah can revoke a certificate with a reason; verification immediately reports revoked and new downloads are blocked. Previously downloaded PDFs cannot be erased. Replacement/reissue of revoked certificates is not implemented.

## Postman

Import [API collection](./backend/postman/CertiFlow.postman_collection.json) and [local environment](./backend/postman/CertiFlow.local.postman_environment.json).

Run folders **01 → 02 → 03** for authentication, a 60-candidate batch and approvals. In folder 04, poll List Certificates until issuance completes; it saves the certificate ID/token for later requests. Optional correction, retry and revocation requests require appropriate states; do not run all folders blindly. Choose upload files manually. Folder 08 opens SSE.

Regenerate the collection with `npm run postman --prefix backend`.

## Architecture and reliability

```text
README.md                    Combined setup and operating guide
ROLES_AND_CREDENTIALS.md      Local demo login guide
backend/
  server.js                  API startup and shutdown
  src/config/                Environment and MongoDB connection
  src/models/                One Mongoose schema per .model.js
  src/routes/                Feature-specific routers
  src/controllers/           exports.handler = asyncHandler(...)
  src/services/              Workflow, PDF, issuance, delivery, access, SLA
  src/middlewares/           Auth, roles, errors, upload and rate limits
  src/jobs/                  BullMQ worker and transactional outbox dispatcher
  scripts/                   Seed, setup, checks and Postman generator
  tests/                     Isolated MongoDB/Redis integration checks
  samples/                   Candidate upload examples
  postman/                   Importable API collection/environment
  docker-compose.yml         Local Redis and MongoDB replica set
frontend/
  src/pages/                 Login, batches, review, certificates, verification
  src/components/            Shared layouts, forms, tables and batch tabs
  src/contexts/              Authentication and white theme
  src/hooks/                 Authenticated SSE updates
  src/lib/api.ts             API client and response mapping
  public/favicon.svg         CertiFlow icon
```

MongoDB transactions save decisions, batch transitions, audits and outbox events together. Updates to the same batch serialize concurrent decisions. Unique indexes enforce one vote per officer/stage/revision, one certificate per candidate enrollment and unique certificate numbers.

The outbox persists issuance/delivery work before enqueueing it. Deterministic BullMQ job IDs and idempotent database operations make replay safe. Redis provides job scheduling and retry state, with AOF persistence and `noeviction`; it does not cache certificate validity. Complete Redis data loss still requires operational recovery/replay of dispatched events.

The mock provider fails before acceptance on attempt one, accepts but simulates a lost response on attempt two, and acknowledges the existing message on attempt three. No real WhatsApp messages are sent. `MOCK_FAILURES=false` disables injected failures. Jobs retry up to five attempts with backoff; failures are visible to the state officer.

SLA escalations appear after `SLA_HOURS` at a review stage; one record is created per stage/revision and resolved when the stage advances. The worker checks periodically. Authenticated SSE delivers refetch notifications, reconnecting as necessary. No external escalation email/SMS is implemented.

JWT sessions expire after eight hours; backend role/ownership checks govern access. The frontend stores sessions in sessionStorage and clears private caches on account changes. Public verification/download responses use `no-store`. Audit history is append-only through APIs, not tamper-proof against database administrators.

## Validation and build commands

From the repository root:

```powershell
npm run check --prefix backend
npm test --prefix backend
docker compose -f backend/docker-compose.yml up -d --wait redis
npm run test:queue --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Backend tests create an isolated MongoDB replica set and never clear your Atlas database. The first run/install may download a MongoDB binary. Queue tests use a process-specific Redis queue. Tests cover permissions, atomic imports, concurrent votes/issuance, revisions, 60 deliveries, revocation, signed links, escalations, audit events, SSE and outbox replay.

Frontend `lint` runs TypeScript checks. The build writes `frontend/dist`. Preview with `npm run preview --prefix frontend -- --port 8080 --strictPort` after stopping the dev server; keep the backend and worker running. `npm run format --prefix backend` formats backend JavaScript.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `EADDRINUSE` on 7000 / port 8080 occupied | An existing server is running. Stop its terminal with Ctrl+C before restarting; do not terminate unrelated Node processes. |
| Backend unreachable | Check `/health`, API process, frontend API URL and exact CORS origin. Hosted previews cannot reach your computer's localhost. |
| MongoDB connection fails | Atlas network access/credentials or local replica-set readiness; standalone MongoDB is unsupported. |
| Approved batch but no certificates | Start Redis and the worker; inspect worker logs and Farah's Queues & Jobs. |
| Delivery shows retrying | Expected during injected mock failures; inspect failed jobs if it does not recover. |
| Farah's inbox is empty | Requires two distinct district approvals and quality approval only for batches over 50 candidates. |
| Neha cannot open a batch | Her scope is batches with more than 50 candidates. |
| Verification says not found | Use the verification token or URL, not the certificate number or signed download token. |
| Changed env/PDF template has no effect | Restart the relevant process and download a fresh PDF. |
| Docker project seems wrong | Use `docker compose ls` and the explicit `-f backend/docker-compose.yml` path; the default project group is named `backend`. |

## Deployment plan and current limits

Deploy API and worker as separate Node services, frontend `dist` as static assets with SPA fallback, MongoDB as a managed replica set, and Redis privately with persistence/backups. Configure HTTPS, `PUBLIC_API_URL`, frontend `VITE_API_BASE_URL`, exact `CORS_ORIGIN`, a stable secret from a secrets manager, `NODE_ENV=production`, and `DEMO_MODE=false`. Provision real users separately; demo seeding is disabled in production. Build the frontend again when its API URL changes.

Monitor queue failures, outbox backlog, overdue batches and worker liveness. Preserve database/Redis backups, create indexes before rollout, configure trusted ingress and SSE proxy buffering, and plan versioned schema migrations (initial indexes currently use Mongoose initialization).

Before public production use, add controlled account provisioning/password reset, a real provider adapter and receipt webhooks, stronger spreadsheet isolation, multilingual PDF fonts, candidate link recovery and any required document signing/audit-retention controls. Candidate uniqueness is per enrollment, not a global cross-batch identity check. No public deployment is included.
