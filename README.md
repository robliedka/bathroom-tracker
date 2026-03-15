# Bathroom Watch

Crowd-sourced bathroom availability tracker using:
- React + TypeScript frontend (deploy to Azure Static Web Apps)
- .NET Web API + SignalR backend (deploy to Azure Container Apps)
- Azure Database for PostgreSQL

## Features Implemented

- Email/password sign-up and sign-in with JWT auth
- User profile includes name, used in report notifications
- 2x2 dashboard tiles for configured bathrooms (pre-seeded with 4)
- Tile status colors:
  - Red: confirmed unavailable
  - Yellow: may be unavailable
  - Green: likely available
- 24-hour unavailable report graph in each tile
- Create new bathrooms
- Report available/unavailable with optional notes
- Subscribe/unsubscribe per bathroom
- SignalR push updates for:
  - New report status changes
  - Predictive "may go unavailable soon" alerts
- Desktop notification support in browser

## Project Structure

- `/Users/robertliedka/Documents/repos/bathroom-watch/BathroomWatch.Api` - backend API
- `/Users/robertliedka/Documents/repos/bathroom-watch/web` - frontend app

## Run Locally

### 1) Start PostgreSQL + API

```bash
docker compose up -d postgres api
```

API will be available at `http://localhost:5166`.

### 2) Start Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Backend API Overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/bathrooms`
- `POST /api/bathrooms`
- `DELETE /api/bathrooms/{bathroomId}`
- `POST /api/bathrooms/{bathroomId}/reports`
- `GET /api/bathrooms/{bathroomId}/reports?hours=24`
- `POST /api/bathrooms/{bathroomId}/subscribe`
- `DELETE /api/bathrooms/{bathroomId}/subscribe`
- SignalR hub: `/hubs/updates`

## Azure Deployment Notes

### Backend: Azure Container Apps

1. Build and push API image to ACR.
2. Create Container App with ingress enabled.
3. Set environment variables on Container App:
   - `ConnectionStrings__Postgres`
   - `Jwt__Issuer`
   - `Jwt__Audience`
   - `Jwt__SigningKey`
   - `Cors__AllowedOrigins__0` (your Static Web App URL)
4. Point PostgreSQL connection string to Azure Database for PostgreSQL Flexible Server.

### Frontend: Azure Static Web Apps

1. Set build output to `web/dist`.
2. Add frontend env vars:
   - `VITE_API_BASE_URL=https://<your-container-app-url>`
   - `VITE_SIGNALR_HUB_URL=https://<your-container-app-url>/hubs/updates`
3. Ensure backend CORS allows the Static Web App URL.

## Important Next Hardening Steps

- Move from `EnsureCreated` to EF Core migrations for production schema control.
- Use stronger password policy and email verification flow.
- Add refresh tokens and token revocation.
- Persist predictive notification dedupe state in DB/Redis for multi-instance backends.
- Add unit/integration tests for status classification and prediction logic.
