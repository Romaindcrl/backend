from pathlib import Path

from schemas import ArticleInfo

wiki_dir = Path(__file__).resolve().parent.parent / "wiki"


def _article_file_path(article_url: str) -> Path | None:
    if not article_url or any(char in article_url for char in ("/", "\\", "\x00")):
        return None

    articles_dir = (wiki_dir / "articles").resolve()
    article_path = articles_dir / f"{article_url}.md"

    if article_path.resolve().parent != articles_dir:
        return None
    return article_path


def list_articles() -> list[ArticleInfo]:
    articles: list[ArticleInfo] = []
    for article in (wiki_dir / "articles").glob("*.md"):
        articles.append(
            ArticleInfo(
                name=article.stem.replace("_", " "),
                articleUrl=article.stem,
            )
        )
    return articles


def exists(article_url: str) -> bool:
    article_path = _article_file_path(article_url)
    return article_path is not None and article_path.is_file()


def read_source(article_url: str) -> str | None:
    article_path = _article_file_path(article_url)
    if article_path is None or not article_path.is_file():
        return None
    return article_path.read_text(encoding="utf-8")


def write_source(article_url: str, source: str) -> None:
    article_path = _article_file_path(article_url)
    if article_path is None:
        raise FileNotFoundError(article_url)
    article_path.parent.mkdir(parents=True, exist_ok=True)
    article_path.write_text(source, encoding="utf-8")
