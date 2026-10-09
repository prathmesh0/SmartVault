# SmartVault

> File Upload API with real-time processing status and AI insights.

Users register, upload a **PDF or TXT**, watch it move through a background
processing pipeline **live** over Socket.IO, and get an AI-generated
**summary**, **category** and **tags** for each document.

Built as a focused full-stack-backend learning project: authentication,
multipart uploads, cloud storage, real-time updates and light AI integration —
all on free tiers.

---

## Features

- **Auth** — JWT access tokens (15 min) + rotated, hashed refresh tokens in an
  httpOnly cookie.
- **Uploads** — PDF/TXT only, 5 MB cap, validated by extension, MIME **and
  magic bytes**.
- **Cloud storage** — buffers streamed to Cloudinary (`resource_type: "raw"`).
- **AI insights** — Groq returns a Zod-validated `{ summary, category, tags }`.
- **Real-time status** — Socket.IO per-user rooms, authenticated handshake.
- **Pipeline** — `QUEUED → UPLOADING → EXTRACTING → ANALYZING → COMPLETED`
  (or `FAILED`), each transition persisted then emitted.
- **List & filter** — pagination, status/category/tag filters, case-insensitive
  search, sorting, all owner-scoped.
- **Retry** — re-run AI only when a file failed at `ANALYZING` (its text was
  already stored, so no re-upload needed).
- **Polish** — Helmet, CORS allowlist, per-route rate limits, redacted logs,
  central error envelope, and a small test suite.

---

## Tech stack

| Concern      | Choice                                          |
| ------------ | ----------------------------------------------- |
| Language     | TypeScript + Node.js 20+ (`tsx`, `tsc`)         |
| Framework    | Express 5                                       |
| Database     | MongoDB Atlas M0 + Mongoose                     |
| File storage | Cloudinary (free)                               |
| AI           | Groq (`groq-sdk`)                               |
| Real-time    | Socket.IO                                       |
| Validation   | Zod (requests, AI output, env)                  |
| Auth         | `jsonwebtoken`, `bcryptjs`                      |
| Upload       | Multer (memory), `file-type`                    |
| PDF text     | `pdf-parse`                                     |
| Logging      | `pino` + `pino-http`                            |
| Security     | `helmet`, `cors`, `express-rate-limit`          |
| Testing      | Vitest + Supertest + `mongodb-memory-server`    |

---

## Architecture

```
Client (REST + Socket.IO)
      │
      ▼
 Express API ── auth ──► MongoDB (users, refresh tokens, files)
      │
      │ POST /api/v1/files → validate → create File(status=QUEUED) → 202
      ▼
 File Pipeline (background, same process)
   1. UPLOADING   → Cloudinary
   2. EXTRACTING  → pdf-parse / txt
   3. ANALYZING   → Groq (summary, category, tags)
   4. COMPLETED   (or FAILED)
      │  every step change:
      ▼
 FileEvents (EventEmitter) ──► Socket.IO ──► user's room ──► Client
```

**Layer rule:** `routes → middleware → controller → service → repository → model`.
Controllers are HTTP-only, services hold business logic and never touch
`req`/`res`, repositories are the only place Mongoose is used, and external
SDKs (Cloudinary, Groq, Socket.IO) are wrapped in small integration modules.

### Status state machine

```
QUEUED → UPLOADING → EXTRACTING → ANALYZING → COMPLETED
   └────────┴───────────┴────────────┴──────► FAILED (failedStage + error)

FAILED ──retry──► ANALYZING   (only when it failed at ANALYZING)
```

| Status     | progress % |
| ---------- | ---------- |
| QUEUED     | 5          |
| UPLOADING  | 25         |
| EXTRACTING | 50         |
| ANALYZING  | 75         |
| COMPLETED  | 100        |

---

## Getting started

### 1. Prerequisites

- Node.js 20+
- Free accounts (no credit card required):
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) — create an M0 cluster
    and copy the connection string.
  - [Cloudinary](https://cloudinary.com/) — dashboard → **Cloud name**,
    **API Key**, **API Secret**.
  - [Groq](https://console.groq.com/) — create an API key.

### 2. Install

```bash
git clone https://github.com/prathmesh0/SmartVault.git
cd SmartVault
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Fill in `.env`. Every value is validated with Zod at boot — the process exits
with a clear message if anything is missing or malformed (e.g. JWT secrets
under 32 characters).

### 4. Run

```bash
npm run dev          # tsx watch, http://localhost:5000
```

Open <http://localhost:5000/test-client.html> for a tiny page that logs in,
uploads with a progress bar, and renders live socket events.

### 5. Build & run in production

```bash
npm run build
npm start
```

### Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server with hot reload (`tsx watch`)      |
| `npm run build`     | Compile TypeScript to `dist/`                 |
| `npm start`         | Run the compiled server                       |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm test`          | Run the Vitest suite once                     |
| `npm run test:watch`| Vitest in watch mode                          |
| `npm run try:ai`    | Run the AI service against a local file       |

---

## API reference

Base URL: `/api/v1`. Success responses are `{ success, data, meta? }`; errors
are `{ success: false, error: { code, message, details? } }`.

### Auth (`/auth`)

| Method | Path        | Description                                             |
| ------ | ----------- | ------------------------------------------------------- |
| POST   | `/register` | `{ name, email, password }` → 201                       |
| POST   | `/login`    | → `accessToken`; sets refresh token httpOnly cookie     |
| POST   | `/refresh`  | Rotates refresh token → new access token                |
| POST   | `/logout`   | Revokes refresh token, clears cookie                    |
| GET    | `/me`       | Current user (Bearer token)                             |

### Files (`/files`) — Bearer token required

| Method | Path             | Description                                             |
| ------ | ---------------- | ------------------------------------------------------- |
| POST   | `/`              | multipart field `file` → **202** `{ fileId, status }`   |
| GET    | `/`              | List + filter (see below)                               |
| GET    | `/:id`           | File + AI results                                       |
| DELETE | `/:id`           | Deletes Cloudinary asset + DB record                    |
| POST   | `/:id/retry`     | Re-run AI only; only if `FAILED` at `ANALYZING`, else 409 |

**List query params**

```
GET /files?page=1&limit=10&status=COMPLETED&category=Resume&tag=node&search=invoice&sort=-createdAt
```

- `limit` ≤ 50. Returns `meta { page, limit, total, totalPages }`.
- `search` matches `originalName` and `ai.summary` (escaped regex,
  case-insensitive).
- `sort` ∈ `createdAt | -createdAt | size | -size | originalName`.
- `extractedText` is **never** returned.

### Health

`GET /health` → `{ status: "ok" }`.

### Real-time (Socket.IO)

Connect with `auth: { token: <accessToken> }`. Unauthenticated sockets are
rejected. On connect the socket joins room `user:<userId>`.

| Event            | Payload                                       |
| ---------------- | --------------------------------------------- |
| `file:status`    | `{ fileId, status, progress, message }`       |
| `file:completed` | `{ fileId, ai: { summary, category, tags } }` |
| `file:failed`    | `{ fileId, failedStage, error }`              |

```js
const socket = io('http://localhost:5000', { auth: { token: accessToken } });
socket.on('file:status', (e) => console.log(e.status, e.progress));
socket.on('file:completed', (e) => console.log(e.ai));
```

---

## Testing

```bash
npm test
```

The suite runs against an in-memory MongoDB (`mongodb-memory-server`) and mocks
Cloudinary/Groq for the pipeline tests, so it needs **no** credentials and no
network. It covers:

- the full auth flow (register → login → me → refresh → logout, old token
  rejected);
- upload validation (valid TXT, renamed binary rejected by magic bytes,
  disallowed extension, 5 MB size cap);
- ownership / IDOR protection (another user's file → 404) and owner-scoped
  listings;
- list filters, pagination and query validation;
- the AI output Zod schema;
- the background pipeline end-to-end (state transitions + events) and the
  ANALYZING-failure → retry path — using mocked storage and AI.

---

## Design decisions

- **202 Accepted + fire-and-forget pipeline.** `POST /files` returns as soon as
  the `QUEUED` record exists; processing happens in the background and is
  reported over sockets. The client measures its own upload progress with
  `onUploadProgress` (the server can't see that half).
- **Magic bytes, not just extensions.** A renamed `.exe → .pdf` is caught by
  inspecting the buffer, not the filename.
- **Retry only for `ANALYZING` failures.** After extraction the text is stored,
  so re-running AI needs no re-upload. Earlier failures mean the buffer is
  gone, so the user re-uploads.
- **Event emitter decoupling.** Services emit domain events and know nothing
  about sockets; the realtime gateway is the only subscriber that matters.
- **Update DB *then* emit.** A socket event is never sent for a state the
  database doesn't reflect.
- **Never trust the LLM.** Output is validated with Zod; tags are trimmed,
  lowercased and de-duplicated; invalid JSON gets one repair retry, then the
  file is `FAILED`.
- **Mockable integrations.** Cloudinary and Groq live behind thin wrappers,
  which is what makes the pipeline testable offline.
- **Fail-fast config.** Env is parsed once at boot; a bad value stops the
  process instead of surfacing as a confusing runtime error.

---

## Security checklist

- [x] Passwords hashed (bcrypt, cost 12), never returned or logged.
- [x] Refresh tokens hashed at rest, rotated on use, reuse revokes all sessions.
- [x] Every file query filtered by `owner`; another user's file → 404.
- [x] File type verified by magic bytes; size capped; filename sanitized.
- [x] Cloudinary `public_id` generated by the server (never user-controlled).
- [x] Zod validation on body, query and params.
- [x] Socket connections require a valid JWT.
- [x] Rate limits: auth 10/15 min/IP, uploads 10/hour/user, general 100/15 min/IP.
- [x] `helmet` + strict CORS allowlist.
- [x] Logs redact `authorization`, `cookie`, passwords, tokens and document text.
- [x] LLM output validated; document text in the prompt is treated as untrusted
      data, not instructions.

---

## Known limitations

- **The pipeline is in-process and not durable.** If the server restarts
  mid-processing, any file still in `QUEUED/UPLOADING/EXTRACTING/ANALYZING` is
  marked `FAILED` ("Server restarted before processing finished") at boot —
  there is no worker left to finish it. The natural next step is a persistent
  queue (BullMQ + Redis).
- **Single-process only.** Socket.IO rooms and the event emitter assume one
  instance; horizontal scaling would need a shared adapter (e.g. Redis).
- **In-memory uploads.** Multer keeps the whole file in RAM (fine for 5 MB);
  larger files would need streaming to disk or direct-to-cloud.
- **Groq free tier is rate-limited** (returns `429`); we keep inputs small and
  surface failures as `FAILED` + retry.

---

## Project structure

```
src/
├── config/            env.ts (Zod), db.ts, cloudinary.ts
├── modules/
│   ├── user/          model · types · repository · service
│   ├── auth/          model · types · repository · service · controller · routes · validation
│   ├── file/          model · types · repository · service · pipeline · events · controller · routes · validation
│   ├── storage/       Cloudinary wrapper
│   ├── ai/            prompts · schema · service (Groq)
│   ├── extractor/     PDF/TXT → text
│   └── realtime/      Socket.IO gateway
├── middlewares/       auth · validate · upload · rateLimit · notFound · error
├── utils/             ApiError · apiResponse · asyncHandler · logger · fileSignature · jwt · hash
├── types/             express request augmentation
├── app.ts             builds the Express app
└── server.ts          http server + Socket.IO + DB + startup recovery
public/test-client.html
tests/
```

---

## License

ISC
