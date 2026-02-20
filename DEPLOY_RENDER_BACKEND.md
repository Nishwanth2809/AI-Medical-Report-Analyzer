# Deploy Backend To Render (Docker)

## 1. Push deployment files
```powershell
cd C:\Users\nishw\Projects\Medical
git add backend/Dockerfile render.yaml DEPLOY_RENDER_BACKEND.md
git commit -m "Add Render Docker deployment config for backend"
git push origin main
```

## 2. Create Render backend service
1. Open Render dashboard.
2. New -> Blueprint (or Web Service from repo).
3. Select this GitHub repo.
4. Render reads `render.yaml` and creates `medical-report-backend`.

## 3. Add environment variables in Render
- `UMLS_API_KEY`
- `USDA_API_KEY`

`PORT` is managed by Render automatically.

## 4. Verify backend
Open:
`https://<your-render-backend>.onrender.com/`

Expected:
`Medical Report AI Node Backend Running`

## 5. Point frontend to Render backend
In Vercel frontend env vars set:
`VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`

Then redeploy frontend.

## Notes
- This setup uses Docker to install OCR dependencies (`tesseract-ocr`, `poppler-utils`) needed for JPG/PNG and scanned PDF processing.
