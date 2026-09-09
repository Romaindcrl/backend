from multiprocessing import Value
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
        source = read_source(article.stem)
        if source is None:
            continue
        articles.append(
            ArticleInfo(
                author=source[1],
                name=article.stem.replace("_", " "),
                articleUrl=article.stem,
            )
        )
    return articles


def exists(article_url: str) -> bool:
    article_path: Path = _article_file_path(article_url)
    return article_path is not None and article_path.is_file()


def read_source(article_url: str) -> tuple[str, str] | None:
    article_path = _article_file_path(article_url)
    if article_path is None or not article_path.is_file():
        return None
    author, _, content = article_path.read_text(encoding="utf-8").partition("\n")
    return content, author


def write_source(article_url: str, source: str, *, overwrite: bool = False) -> None:
    if not article_url:
        raise ValueError("Invalid article path")

    article_path: Path = _article_file_path(article_url)

    article_path.parent.mkdir(parents=True, exist_ok=True)
    with article_path.open("w" if overwrite else "x", encoding="utf-8") as file:
        file.write(source)

def delete_article_file(article_url: str) -> None:
    article_path = _article_file_path(article_url)
    if article_path is None:
        raise ValueError("Invalid article path.")

    if not article_path.is_file():
        raise FileNotFoundError("Article not found.")

    destination = wiki_dir / "trash" / article_path.name
    if destination.exists() or destination.is_symlink():
        destination.unlink()

    article_path.rename(destination)
