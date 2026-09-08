import html
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import markdown2

class Article(BaseModel):
    name: str
    content: str
    articleUrl: str
    source: str

class ArticleInfo(BaseModel):
    name: str
    articleUrl: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


wiki_dir: Path = Path(__file__).resolve().parent.parent / "wiki"


@app.get("/list")
def list_articles() -> list[ArticleInfo]:
    articles: list[ArticleInfo] = []
    for article in (wiki_dir / "articles").glob("*.md"):
        articles.append(ArticleInfo(
            name=article.stem.replace("_", " "),
            articleUrl=article.stem
        ))

    return articles

@app.get("/article/{article_url}")
def get_article(article_url: str) -> Article:
    article_path: Path = Path(f"{wiki_dir}/articles/{article_url}.md")
    if article_path.is_file():
        with open(article_path, encoding="utf-8") as article_file:
            article_content: str = article_file.read()
            article_content_md: html = markdown2.markdown(article_content, extras=["latex"])
        return Article(
            name=article_path.name,
            articleUrl=article_url,
            content=article_content_md,
            source=article_content,
        )
    raise HTTPException(status_code=404, detail="Article non trouvé")

@app.post("/create")
def create_article(body: dict) -> Article:
    article: Article = Article(
        name=body["name"],
        source=body["content"],
        articleUrl=body["name"].replace(" ", "_"),
        content=markdown2.markdown(body["content"], extras=["latex"]
    ))
    article_path = wiki_dir / "articles" / f"{article.articleUrl}.md"
    article_path.parent.mkdir(parents=True, exist_ok=True)
    

    with open(article_path, "w", encoding="utf-8") as fichier:
        fichier.write(article.content)

    article: dict = {"name": article.name, "articleUrl": article.articleUrl,  "content": article.content, "source": article.source}
    return article


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
