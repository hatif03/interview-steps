"""Local dev server with reload settings that avoid noisy CancelledError tracebacks on Windows."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        reload_delay=0.5,
    )
