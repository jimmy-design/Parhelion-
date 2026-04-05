# Parhelion-

Desktop POS and ERP clients with a server-hosted Python backend.

## Repo layout

- `src/` React renderer code for POS and ERP
- `electron/` Electron main process, updater wiring, and packaging helpers
- `backend-python/` FastAPI backend intended to run on the server only

## Server setup

- Keep `backend-python` on the server machine
- Run the API with `python -m uvicorn main:app --host 0.0.0.0 --port 8000`
- Point client apps to the server with `EASTMATT_API_BASE_URL`

## Installer updates

This project is wired for installer-based updates from GitHub Releases.

- ERP uses the `erp` updater channel
- POS uses the `pos` updater channel
- Both installers publish into the same GitHub repository without colliding

### Release flow

1. Update `package.json` version.
2. Commit changes.
3. Create a tag like `v1.0.1`.
4. Push the branch and tag to GitHub.
5. GitHub Actions builds and publishes installers plus update metadata.

### Local build commands

```powershell
npm run build:renderer
npm run package:erp
npm run package:pos
```

### Local release commands

```powershell
$env:GH_TOKEN="your_github_token"
npm run release:installers
```
