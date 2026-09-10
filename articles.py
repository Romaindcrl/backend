"""Store articles as an author line followed by the Markdown body."""

from pathlib import Path

from schemas import ArticleInfo

wiki_dir: Path = Path(__file__).resolve().parent.parent / "wiki"


def _article_file_path(article_url: str) -> Path | None:
    """Accept only files from the active article directory."""
    if not article_url or any(char in article_url for char in ("/", "\\", "\x00")):
        return None

    articles_dir: Path = (wiki_dir / "articles").resolve()
    article_path: Path = articles_dir / f"{article_url}.md"
    if article_path.resolve().parent != articles_dir:
        return None
    return article_path


def list_articles() -> list[ArticleInfo]:
    """List active articles only, excluding the trash directory."""
    articles: list[ArticleInfo] = []
    article: Path
    for article in (wiki_dir / "articles").glob("*.md"):
        source: tuple[str, str] | None = read_source(article.stem)
        if source is None:
            continue
        author: str = source[1]
        articles.append(ArticleInfo(
            name=article.stem.replace("_", " "),
            articleUrl=article.stem,
            author=author,
        ))
    return articles


def exists(article_url: str) -> bool:
    """Return whether the URL identifies an existing, allowed article file."""
    article_path: Path | None = _article_file_path(article_url)
    return article_path is not None and article_path.is_file()


def read_source(article_url: str) -> tuple[str, str] | None:
    """Return (Markdown body, author), or None for a missing or invalid path.

    The first line is always the author, including when it is empty.
    All following lines belong to the Markdown body; no JSON is parsed.
    """
    article_path: Path | None = _article_file_path(article_url)
    if article_path is None or not article_path.is_file():
        return None

    with article_path.open("r", encoding="utf-8") as file:
        author: str = file.readline().rstrip("\r\n")
        content: str = file.read()

    return content, author


def write_source(
    article_url: str,
    source: str,
    author: str = "",
    *,
    overwrite: bool = False,
) -> None:
    """Write the author on the first line, followed by the Markdown body."""
    article_path: Path | None = _article_file_path(article_url)
    if article_path is None:
        raise ValueError("Invalid article path")

    article_path.parent.mkdir(parents=True, exist_ok=True)
    # Mode x prevents overwriting an existing article; w is used for editing.
    with article_path.open("w" if overwrite else "x", encoding="utf-8") as file:
        file.write(author)
        file.write("\n")
        file.write(source)


def delete_article_file(article_url: str) -> None:
    """Move the author line and content to the existing trash directory.

    Replace an older trash copy with the same filename. Invalid paths raise
    ValueError; a missing source raises FileNotFoundError.
    """
    article_path: Path | None = _article_file_path(article_url)
    if article_path is None:
        raise ValueError("Invalid article path.")
    if not article_path.is_file():
        raise FileNotFoundError("Article not found.")

    destination: Path = wiki_dir / "trash" / article_path.name
    if destination.exists() or destination.is_symlink():
        destination.unlink()
    article_path.rename(destination)
