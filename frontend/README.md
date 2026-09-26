# StockSense Frontend

The StockSense user interface is a React, TypeScript, and Vite application. See the [root README](../README.md) for the full system description and setup instructions.

## Development

From this directory:

```powershell
npm ci
npm run dev
```

Vite serves the app at `http://localhost:5173` and proxies `/api` requests, including WebSocket upgrades, to the FastAPI server at `http://127.0.0.1:8000`.

## Checks

```powershell
npm run build
npm run lint
```

The build runs the TypeScript project check before producing the production bundle in `dist/`.
