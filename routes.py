from fastapi import HTTPException
import markdown2

from articles import exists, list_articles as load_article_index, read_source, write_source
from schemas import Article, ArticleCreate, ArticleEdit, ArticleInfo


def list_articles() -> list[ArticleInfo]:
    return load_article_index()


def get_article(article_url: str) -> Article:
    article_content = read_source(article_url)
    if article_content is None:
        raise HTTPException(status_code=404, detail="Article non trouvé")

    return Article(
        name=article_url.replace("_", " "),
        articleUrl=article_url,
        content=markdown2.markdown(article_content, extras=["latex"]),
        source=article_content,
    )


def create_article(body: ArticleCreate) -> Article:
    article_url = body.name.replace(" ", "_")
    write_source(article_url, body.content)
    return get_article(article_url)


def edit_article(body: ArticleEdit, article_url: str) -> Article:
    if not exists(article_url):
        raise HTTPException(status_code=404, detail="Article not found")

    write_source(article_url, body.content)
    return get_article(article_url)
