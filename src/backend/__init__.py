"""Provide the backend console command for this local, editable checkout."""

from pathlib import Path

import uvicorn


def main() -> None:
    """Start the local application regardless of the current working directory."""
    # This file is in src/backend; main.py is two parent directories above.
    app_dir: Path = Path(__file__).resolve().parents[2]
    uvicorn.run("main:app", app_dir=str(app_dir), host="0.0.0.0", port=8000)
