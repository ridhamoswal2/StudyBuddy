import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Make backend module importable when deployed as a Vercel Python function.
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from server import app  # noqa: E402
except Exception as exc:  # pragma: no cover
    # Provide a readable response in Vercel instead of generic crash page.
    app = FastAPI()
    startup_error = str(exc)

    @app.get("/{path:path}")
    async def startup_failure(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Backend failed to start. Check Vercel env vars/logs.",
                "detail": startup_error,
            },
        )
