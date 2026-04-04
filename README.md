# PetrCollect

A dedicated full stack platform for the UC Irvine petr community to manage, showcase, and trade Petr stickers. 

PetrCollect is designed to solve the logistical challenges of sticker collecting by centralizing collection data and trade requests, effectively eliminating the need for manual wishlist updates, screenshots, and external album links.

<img src="https://github.com/user-attachments/assets/87b0428d-e9b0-4f51-a55e-1b49505e70dc" alt="PetrCollect Screenshot" width="400">

---

## What it does

- **Collections** — Post your sticker collection as a gallery.
- **Looking For / Trading** — Separate post types so people know exactly what you want and what you're willing to trade away.
- **Messaging** — Direct messaging to complete trades.
- **Profiles** — Every user gets a profile page showing all their posts by type, so you can browse someone's collection before reaching out.
- **Search** — Find users or posts to look at their collections or for specific stickers.

---

## Tech Stack

This is a full-stack application split across three services.

**Frontend** — React 19 · TypeScript · Vite · React Router · TanStack Query · Zustand · Tailwind CSS

**Backend** — FastAPI · SQLAlchemy · PostgreSQL · Alembic

**Messaging Service** — Spring Boot 3.3.5 · WebSocket / STOMP · Flyway · Java 17


## Architecture

```
Browser
  ├── HTTP (cookies)   ──► FastAPI :8000
  └── WebSocket/STOMP  ──► Spring Boot :8025

FastAPI     ──► PostgreSQL (public schema)
Spring Boot ──► PostgreSQL (petrcollect_messaging schema)
```

Auth uses httpOnly cookies — access tokens (short-lived) and refresh tokens (30 days). The messaging service validates the same JWT issued by FastAPI, so users authenticate once and both services recognize them.

---

## Running it locally

You'll need: **Python 3.11+**, **Node 20+**, **Java 17**, **Maven**, **PostgreSQL**

### 1. Clone and set up environment

```bash
git clone https://github.com/AngelGalindo7/PetrCollect.git
cd PetrCollect
```

Create a `.env` file at the project root:

```env
DB_USER=antcollect_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=antcollect
DATABASE_URL=postgresql://antcollect_user:your_password@localhost:5432/antcollect
SECRET_KEY=your_jwt_secret_here
```

> `SECRET_KEY` must match what's set in `messaging-service/src/main/resources/application.yml` — both services validate the same JWTs. For full PostgreSQL user and permission setup see `postgresqlsetup.txt`.

### 2. Set up PostgreSQL

Create the database and the two schemas:

```sql
CREATE DATABASE antcollect;
\c antcollect
CREATE SCHEMA petrcollect_messaging;
```

The messaging service also expects a dedicated user — see `messaging-service/src/main/resources/application.yml` for the datasource config.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
alembic upgrade head
uvicorn backend.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`.

### 5. Messaging service

```bash
cd messaging-service
mvn spring-boot:run
```

Flyway runs migrations automatically on startup. The STOMP endpoint is at `/ws`.

---

## Project structure

```
PetrCollect/
├── backend/              FastAPI (Python)
│   ├── models/           ORM models — User, Post, PostImage, PostLike, etc.
│   ├── routers/          auth.py · users.py · posts.py
│   ├── utils/            auth helpers, image processing
│   └── main.py           app entry point
├── frontend/             React SPA (TypeScript)
│   └── src/
│       ├── features/     auth · feed · profile · posts · search · settings · messaging
│       └── shared/       fetchWithAuth(), Zustand UI store, core types
├── messaging-service/    Spring Boot microservice (Java)
│   └── src/main/java/com/petrcollect/messaging/
│       ├── message/      entity, service, WebSocket handler
│       ├── conversation/ entity, service, REST controller
│       ├── auth/         JWT filter + service
│       └── websocket/    handshake interceptor, session registry
├── alembic/              DB migrations for main schema
└── Uploads/              Served as static at /Uploads
```

---

## Status

This is an active build. Core features are functional — auth, post creation with image uploads, profiles, search, and real time messaging all work end to end. Account deletion, moderation tooling, and a few edge cases in the auth refresh flow are still in progress.
