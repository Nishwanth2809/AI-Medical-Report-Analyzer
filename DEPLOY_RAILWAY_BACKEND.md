# Deploy Backend To Railway

## 1. Push current code
```powershell
cd C:\Users\nishw\Projects\Medical
git add backend/railway.json backend/nixpacks.toml backend/.gitignore
git commit -m "Add Railway backend deployment config"
git push origin main
```

## 2. Create Railway service from `backend/`
1. Open Railway dashboard and create a new project from this GitHub repo.
2. Set the service **Root Directory** to `backend`.
3. Railway will auto-detect `railway.json` and run `npm start`.

## 3. Add backend environment variables in Railway
- `UMLS_API_KEY`
- `USDA_API_KEY`

`PORT` is not required; Railway injects it automatically.

## 4. Get Railway public URL
After deploy, copy your backend URL, for example:
`https://medical-backend-production.up.railway.app`

## 5. Point frontend to Railway backend
In Vercel frontend project env vars:
- `VITE_API_BASE_URL=https://<your-railway-backend-url>`

Redeploy frontend after updating env var.

## 6. Verify
- Open backend URL `/` and confirm health response.
- Upload PDF/JPG/PNG from frontend and check `/upload` succeeds.
