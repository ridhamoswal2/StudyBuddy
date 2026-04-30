# StudyBuddy Free Deployment Guide

This project is now wired for free-tier services:
- MongoDB Atlas (free M0)
- Firebase Authentication (free Spark plan)
- OpenRouter free models and/or Gemini free API
- Render (backend free web service) + Vercel/Netlify (frontend free static hosting)

## 1) Create Free Services

### MongoDB Atlas
1. Create a free M0 cluster.
2. Create DB user and allow network access from your deployment platform.
3. Copy the SRV connection string for `MONGO_URL`.

### Firebase
1. Create a Firebase project.
2. Enable **Authentication -> Email/Password**.
3. Create a web app and copy:
   - API key
   - Auth domain
   - Project ID
   - App ID
4. Generate a service account key from Firebase Console and extract:
   - `project_id`, `private_key_id`, `private_key`, `client_email`, `client_id`, `client_x509_cert_url`
5. Save Web API key for `FIREBASE_WEB_API_KEY`.

### AI Provider
Use at least one:
- OpenRouter: set `OPENROUTER_API_KEY` (model default is free Gemini route).
- Gemini direct: set `GEMINI_API_KEY`.

## 2) Backend Environment Variables

Use `backend/.env.example` as source and set all values in your host (Render).

Required:
- `MONGO_URL`
- `DB_NAME`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY_ID`
- `FIREBASE_PRIVATE_KEY` (keep newline escaped as `\n`)
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_CLIENT_ID`
- `FIREBASE_CLIENT_X509_CERT_URL`
- At least one AI key: `OPENROUTER_API_KEY` or `GEMINI_API_KEY`

## 3) Frontend Environment Variables

Use `frontend/.env.example` as source and set in Vercel/Netlify:
- `REACT_APP_BACKEND_URL`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_APP_ID`

## 4) Deploy Commands

### Backend (Render)
- Build command:
  - `cd backend && pip install -r requirements.txt`
- Start command:
  - `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel/Netlify)
- Build command:
  - `cd frontend && npm install --legacy-peer-deps && npm run build`
- Publish directory:
  - `frontend/build`

## 5) Local Startup

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

## 6) Notes

- The backend auth endpoints are preserved, but authentication is now Firebase-backed.
- File upload/download is stored in MongoDB (no paid object storage dependency).
- For CRA/CRACO stability, use Node 18 LTS for frontend development.
