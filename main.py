import html
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

import markdown2
from starlette.responses import Content

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


wiki_dir: Path = Path(__file__).resolve().parent.parent / "wiki"


@app.get("/list")
def list_articles() -> list[dict[str, str]]:
    articles = []
    for article in (wiki_dir / "articles").glob("*.md"):
        articles.append({
            "name": article.stem.replace("_", " "),
            "articleUrl": article.stem
        })

    return articles

@app.get("/article/{article_url}")
def get_article(article_url: str) -> dict[str, str]:
    article_path: Path = Path(f"{wiki_dir}/articles/{article_url}.md")
    if article_path.is_file():
        with open(article_path, encoding="utf-8") as article_file:
            article_content: str = article_file.read()
            article_content_md: html = markdown2.markdown(article_content, extras=["latex"])
        return {
            "name": article_path.name,
            "articleUrl": article_url,
            "content": article_content_md,
            "source": article_content,
        }
    raise HTTPException(status_code=404, detail="Article non trouvé")

@app.post("/create")
def create_article(body: dict) -> dict:
    articleName: str = body["name"]
    articleContent: str = body["content"]
    articleUrl: str = articleName.replace(" ", "_")
    article_path = wiki_dir / "articles" / f"{articleUrl}.md"
    article_path.parent.mkdir(parents=True, exist_ok=True)
    articleHTMLContent: html = markdown2.markdown(articleContent, extras=["latex"])
    

    with open(article_path, "w", encoding="utf-8") as fichier:
        fichier.write(articleContent)

    article: dict = {"name": articleName, "articleUrl": articleUrl,  "content": articleHTMLContent, "source": articleContent}
    return article


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
