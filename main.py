from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import list_articles, get_article, create_article, edit_article

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.get("/list")(list_articles)
app.get("/article/{article_url}")(get_article)
app.post("/create")(create_article)
app.post("/article/{article_url}/edit")(edit_article)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
