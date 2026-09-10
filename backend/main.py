"""Configure the FastAPI application and register its HTTP routes."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from routes import list_articles, get_article, create_article, edit_article, delete_article, get_comments, create_comment

app: FastAPI = FastAPI()


@app.exception_handler(OSError)
async def storage_error(request: Request, error: OSError) -> JSONResponse:
    """Log a filesystem error and return a readable HTTP 500 response."""
    logging.getLogger(__name__).error("Storage operation failed", exc_info=error)
    return JSONResponse(status_code=500, content={
        "detail": "Unable to access files. Check directory permissions and available disk space."
    })


# Simplefront runs on a separate origin during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register HTTP paths here; their implementations remain in routes.py.
app.get("/list")(list_articles)
app.get("/article/{article_url}")(get_article)
app.post("/create")(create_article)
app.post("/article/{article_url}/edit")(edit_article)
app.get("/article/{article_url}/delete")(delete_article)
app.get("/comments")(get_comments)
app.post("/comments")(create_comment)


def main() -> None:
    """Run the API on port 8000 without automatic reloading."""
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
