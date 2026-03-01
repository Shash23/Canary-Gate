"""
CanaryGate FastAPI application.
Prod: serves POST /analyze and static frontend at /. SPA fallback for unknown GET.
Dev (ENV=dev): API only; no static files. Use Vite dev server for frontend with hot reload.
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.routes import router as analyze_router

ENVIRONMENT = os.getenv("ENV", "dev")

app = FastAPI(title="CanaryGate", description="Behavioral risk analysis for messages")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health")
def health():
    return {"status": "ok"}

# Only serve built frontend in production. In dev, Vite dev server handles the UI.
if ENVIRONMENT == "prod":
    DIST = Path(__file__).resolve().parent / "frontend" / "dist"
    ASSETS = DIST / "assets"
    if DIST.exists():
        if ASSETS.exists():
            app.mount("/assets", StaticFiles(directory=str(ASSETS)), name="assets")

        @app.get("/")
        def index():
            return FileResponse(DIST / "index.html")

        @app.exception_handler(404)
        async def spa_fallback(request: Request, _exc):
            if request.method == "GET" and not request.url.path.startswith("/assets"):
                return FileResponse(DIST / "index.html")
            raise HTTPException(status_code=404)
