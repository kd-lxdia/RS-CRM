# SLAR 2.0 Localhost Runbook

## Current Local URLs

- Frontend: http://localhost:3005
- SLAR 2.0 Control Room: http://localhost:3005/admin/slar-2-control-room
- Backend health: http://localhost:4000/health
- Backend API: http://localhost:4000/api

## Demo Login

```text
Email: demo-admin@slarcrm.com
Password: Password@123
```

## Start Everything

From this folder:

```bat
start-slar2-localhost.bat
```

If Windows/Codex sandbox does not keep child processes alive, start both scripts directly in normal terminals:

```bat
start-backend-localhost.bat
start-frontend-localhost.bat
```

## What Was Fixed For Localhost

- SLAR 2.0 uses its own SQLite database at `slar2.db`.
- Backend runs with `DISABLE_REDIS=true`, so Redis is not required locally.
- Frontend uses `frontend/vite.local.config.cjs` to avoid the original TypeScript Vite config/esbuild path issue.
- Frontend Vite server runs from the `frontend` folder on port `3005`.
- Backend runs on port `4000`.

## Verification Commands

```bat
curl http://localhost:4000/health
curl -I http://localhost:3005/admin/slar-2-control-room
```

Expected backend response:

```json
{"status":"ok","usingRole":"ADMIN"}
```

Expected frontend response:

```text
HTTP/1.1 200 OK
```

## Notes

Old `*.log` files may contain earlier failed attempts from setup. The authoritative checks are the current port listeners and the curl verification commands above.
