"""Translate HTTP requests into storage operations and API responses."""

import logging

import markdown2
from fastapi import HTTPException

from articles import delete_article_file, list_articles as load_article_index, read_source, write_source
from comments import max_comment_id, read_comments, write_comments
from schemas import Article, ArticleCreate, ArticleEdit, ArticleInfo, Comment, NewComment


def _read_article_or_404(article_url: str) -> tuple[str, str]:
    """Translate a missing storage result into an HTTP 404 response."""
    source: tuple[str, str] | None = read_source(article_url)
    if source is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return source


def _render_article(article_url: str, content: str, author: str) -> Article:
    """Build an article response without reading or writing files."""
    return Article(
        name=article_url.replace("_", " "),
        articleUrl=article_url,
        author=author,
        source=content,
        content=markdown2.markdown(content, extras=["latex", "fenced-code-blocks"]),
    )


def list_articles() -> list[ArticleInfo]:
    """Return summaries of active articles."""
    return load_article_index()


def get_article(article_url: str) -> Article:
    """Read the saved article, then render its Markdown body."""
    source: tuple[str, str] = _read_article_or_404(article_url)
    return _render_article(article_url, source[0], source[1])


def create_article(body: ArticleCreate) -> Article:
    """Save a validated article and return its response."""
    article_url: str = body.name.replace(" ", "_")
    article: Article = _render_article(article_url, body.content, body.author)
    try:
        write_source(article_url, body.content, body.author)
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail="An article with this name already exists. Choose another name.") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid article path.") from error
    return article


def edit_article(body: ArticleEdit, article_url: str) -> Article:
    """Update the saved source without rendering the previous version."""
    source: tuple[str, str] = _read_article_or_404(article_url)
    author: str = source[1]
    if "author" in body.model_fields_set:
        author = body.author

    # Finish rendering before replacing the saved file.
    article: Article = _render_article(article_url, body.content, author)
    write_source(article_url, body.content, author, overwrite=True)
    return article


def delete_article(article_url: str) -> dict[str, bool]:
    """Move an article to trash and translate file errors into HTTP errors."""
    try:
        delete_article_file(article_url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid article path.") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Article not found.") from error
    return {"deleted": True}


def _read_comments_or_error() -> list[Comment]:
    """Translate invalid stored comments into an HTTP error at the route boundary."""
    try:
        return read_comments()
    except ValueError as error:
        logging.getLogger(__name__).exception("Invalid comments file")
        raise HTTPException(status_code=500, detail="The comments file is invalid and needs to be repaired.") from error


def get_comments() -> list[Comment]:
    """Return site-wide comments in publication order."""
    return _read_comments_or_error()


def create_comment(new_comment: NewComment) -> Comment:
    """Append one validated comment with the next persisted ID."""
    comments: list[Comment] = _read_comments_or_error()
    comment: Comment = Comment(
        id=max_comment_id(comments) + 1,
        author=new_comment.author,
        content=new_comment.content,
    )
    comments.append(comment)
    write_comments(comments)
    return comment
