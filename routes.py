"""Coordinate HTTP requests, article rendering and file storage."""

from fastapi import HTTPException
import markdown2

from articles import delete_article_file, list_articles as load_article_index, read_source, write_source
from comments import max_comment_id, read_comments, write_comment
from schemas import Article, ArticleCreate, ArticleEdit, ArticleInfo, Comment, NewComment


def list_articles() -> list[ArticleInfo]:
    """Return the names, authors and URLs of active articles."""
    return load_article_index()


def get_article(article_url: str) -> Article:
    """Return Markdown for the editor and rendered HTML for the article page."""
    source: tuple[str, str] | None = read_source(article_url)
    if source is None:
        raise HTTPException(status_code=404, detail="Article not found")

    article_content: str = source[0]
    author: str = source[1]
    return Article(
        name=article_url.replace("_", " "),
        articleUrl=article_url,
        content=markdown2.markdown(article_content, extras=["latex", "fenced-code-blocks"]),
        source=article_content,
        author=author,
    )


def create_article(body: ArticleCreate) -> Article:
    """Save a validated article without overwriting an existing file."""
    article_url: str = body.name.replace(" ", "_")
    try:
        write_source(article_url, body.content, body.author)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="The article name cannot be used to create a valid file.") from error
    except FileExistsError:
        raise HTTPException(status_code=409, detail="An article with this name already exists. Choose another name.")
    return get_article(article_url)


def edit_article(body: ArticleEdit, article_url: str) -> Article:
    """Replace the Markdown body and update the author only when supplied."""
    saved_article: Article = get_article(article_url)
    author: str = saved_article.author

    # An omitted author stays unchanged; an empty string clears the name.
    if "author" in body.model_fields_set:
        author = body.author
    write_source(article_url, body.content, author, overwrite=True)
    return get_article(article_url)


def delete_article(article_url: str) -> dict[str, bool]:
    """Move an article to trash and translate file errors into HTTP errors."""
    try:
        delete_article_file(article_url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid article path.") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Article not found.") from error
    return {"deleted": True}


def get_comments() -> list[Comment]:
    """Return site-wide comments in their saved order."""
    return read_comments()


def create_comment(newComment: NewComment) -> Comment:
    # Resume the saved counter after a restart; concurrent writes are not locked.
    """Assign the next saved ID, persist the comment and return it."""
    comment: Comment = Comment(
        id=max_comment_id() + 1,
        author=newComment.author,
        content=newComment.content,
    )
    return write_comment(comment)
