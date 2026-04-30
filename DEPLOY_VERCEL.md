# Deploy StudyBuddy on Vercel (Step-by-Step)

Deploy as **2 separate Vercel projects** from the same GitHub repo:
- Project A: `backend`
- Project B: `frontend`

Do backend first, then frontend.

---

## 1) Backend deployment (first)

1. Open Vercel -> **Add New... -> Project**.
2. Import this repo.
3. Set **Root Directory** to `backend`.
4. Framework preset: keep as **Other** (or default).
5. Do not manually override build command. `backend/vercel.json` handles routing.
6. Add backend Environment Variables (Production + Preview):
   - `MONGO_URL`
   - `DB_NAME`
   - `CORS_ORIGINS`
   - `FRONTEND_URL`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (recommended: `inclusionai/ling-2.6-1t:free`)
   - `OPENROUTER_BASE_URL` (`https://openrouter.ai/api/v1`)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (recommended: `gemini-2.5-flash`)
   - `FIREBASE_WEB_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY_ID`
   - `FIREBASE_PRIVATE_KEY` (must keep `\n` escaped)
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_CLIENT_ID`
   - `FIREBASE_CLIENT_X509_CERT_URL`
   - `ADMIN_EMAIL` (optional)
7. Click **Deploy**.
8. After deploy, open:
   - `https://<your-backend-domain>/api/health`
   - Must return: `{"status":"healthy"}`

If this fails, do not proceed to frontend yet.

---

## 2) Frontend deployment (second)

1. Create another Vercel project from same repo.
2. Set **Root Directory** to `frontend`.
3. Add frontend Environment Variables (Production + Preview):
   - `REACT_APP_BACKEND_URL` = backend domain from step 1
   - `REACT_APP_FIREBASE_API_KEY`
   - `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `REACT_APP_FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_APP_ID`
4. Deploy.

This project already uses `frontend/vercel.json` with:
- `installCommand: npm install --legacy-peer-deps`
- `buildCommand: npm run build`
- `outputDirectory: build`

So the previous `npm ERESOLVE` error should be fixed.

---

## 3) Firebase settings required

In Firebase Console:
1. Authentication -> Sign-in method:
   - Enable **Email/Password**
   - Enable **Google**
2. Authentication -> Settings -> Authorized domains:
   - Add your frontend Vercel domain
   - Add your preview frontend Vercel domain (if used)

---

## 4) Final test checklist

1. Open frontend URL.
2. Test Email signup/login.
3. Test Google signup/login.
4. Test Chat message generation.
5. Test Quiz generation.

---

## 5) Troubleshooting

### A) Error: `Could not find a top-level "app"... in api/index.py`
- Fixed in latest code.
- Pull latest commit and redeploy backend.

### B) Backend shows `Serverless Function has crashed`
1. Open backend project -> Deployments -> latest deployment -> **Function Logs**.
2. Check missing env var or invalid key format.
3. Most common issue: `FIREBASE_PRIVATE_KEY` pasted with real line breaks.
   - It must be one line with `\n` sequences.
4. Redeploy after env correction.

### C) Frontend build fails with `ERESOLVE`
- Ensure latest `frontend/vercel.json` is deployed.
- It forces `npm install --legacy-peer-deps`.

### D) CORS/auth issues after deploy
- `FRONTEND_URL` and `CORS_ORIGINS` in backend must include frontend Vercel URL.
- `REACT_APP_BACKEND_URL` in frontend must point to backend Vercel URL.
