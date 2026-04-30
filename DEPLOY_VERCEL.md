# Deploy StudyBuddy on Vercel (Frontend + Backend)

This project should be deployed as **two separate Vercel projects** from the same repo:

- Project 1: `frontend` (React app)
- Project 2: `backend` (FastAPI API)

## 1) Deploy Backend (`backend` folder)

1. In Vercel, click **New Project** and import this repo.
2. Set **Root Directory** to `backend`.
3. Vercel will use `backend/vercel.json` and deploy FastAPI from `backend/api/index.py`.
4. Add these Environment Variables in the backend project:
   - `MONGO_URL`
   - `DB_NAME`
   - `CORS_ORIGINS` (include frontend URL)
   - `FRONTEND_URL` (your frontend Vercel URL)
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (recommended: `inclusionai/ling-2.6-1t:free`)
   - `OPENROUTER_BASE_URL` (`https://openrouter.ai/api/v1`)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (recommended: `gemini-2.5-flash`)
   - `FIREBASE_WEB_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY_ID`
   - `FIREBASE_PRIVATE_KEY` (with `\n` newlines escaped)
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_CLIENT_ID`
   - `FIREBASE_CLIENT_X509_CERT_URL`
   - `ADMIN_EMAIL` (optional)
5. Deploy and copy backend URL (example: `https://studybuddy-api.vercel.app`).

## 2) Deploy Frontend (`frontend` folder)

1. Create another **New Project** in Vercel from same repo.
2. Set **Root Directory** to `frontend`.
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `build`
4. Add these frontend env vars:
   - `REACT_APP_BACKEND_URL` = your backend URL from step 1
   - `REACT_APP_FIREBASE_API_KEY`
   - `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `REACT_APP_FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_APP_ID`
5. Deploy.

## 3) Post-deploy checks

1. Open backend URL + `/api/health` and verify `{"status":"healthy"}`.
2. Open frontend URL and test:
   - Email signup/login
   - Google login/signup
   - Chat response generation
   - Quiz generation
3. If auth fails:
   - Verify Firebase Auth providers are enabled.
   - Add both frontend Vercel domains to Firebase authorized domains.
4. If API calls fail from frontend:
   - Confirm backend `CORS_ORIGINS` includes frontend Vercel URL.
   - Confirm `REACT_APP_BACKEND_URL` points to deployed backend.

## 4) Troubleshooting

### Frontend build fails on Vercel with `ERESOLVE`
- This project uses `frontend/vercel.json` with:
  - `installCommand: npm install --legacy-peer-deps`
- Re-deploy after pulling latest changes.

### Backend link shows "Serverless Function has crashed"
- Open backend project -> **Deployments** -> **Functions Logs**.
- Most common cause: missing backend env vars.
- Required at minimum:
  - `MONGO_URL`
  - `DB_NAME`
  - Firebase admin vars (`FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, etc.)
- After updating env vars, trigger **Redeploy**.
