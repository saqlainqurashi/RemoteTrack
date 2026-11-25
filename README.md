# RemoteTrack

RemoteTrack is a full-stack application for managing members and tracking job applications and interviews.

## Features

- JWT-based authentication
- Super admin and member roles
- Member account management
- Job application tracking
- Interview tracking
- Health check endpoint
- React/Vite frontend with a FastAPI backend

## Project Structure

```text
RemoteTrack/
├── backend/          # FastAPI API and SQLAlchemy models
│   ├── app/
│   ├── migrations/   # Alembic database migrations
│   └── requirements.txt
└── frontend/         # React and Vite web application
```

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- A PostgreSQL or other SQLAlchemy-compatible database

## Backend Setup

1. Create the backend environment file:

```env
# backend/.env
DATABASE_URL=postgresql://username:password@localhost:5432/remotetrack
JWT_SECRET_KEY=replace_with_a_secure_random_string_of_at_least_64_characters
ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_ALGORITHM=HS256
```

2. Install dependencies and start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will run at `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`.

### Database Migrations

Run migrations from the backend directory:

```powershell
cd backend
alembic upgrade head
```

### Optional Setup Scripts

Create the first super administrator:

```powershell
python create_superadmin.py
```

Create demo members:

```powershell
python create_demo_members.py
```

## Frontend Setup

1. Install dependencies and start the development server:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

To use a backend URL other than `http://localhost:8000`, create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## Production Build

Build the frontend:

```powershell
cd frontend
npm run build
```

The generated files are written to `frontend/dist`.

## API Health Check

```text
GET /health
```

Example response:

```json
{
  "status": "healthy",
  "application": "RemoteTrack"
}
```
