from fastapi import HTTPException
import markdown2

from articles import delete_article_file, exists, list_articles as load_article_index, read_source, write_source
from comments import max_comment_id, read_comments, write_comment
from schemas import Article, ArticleCreate, ArticleEdit, ArticleInfo, Comment, NewComment


def list_articles() -> list[ArticleInfo]:
    return load_article_index()


def get_article(article_url: str) -> Article:
    source = read_source(article_url)
    if source is None:
        raise HTTPException(status_code=404, detail="Article non trouvé")

    article_content, author = source
    return Article(
        author=author,
        name=article_url.replace("_", " "),
        articleUrl=article_url,
        content=markdown2.markdown(article_content, extras=["latex", "fenced-code-blocks"]),
        source=article_content,
    )


def create_article(body: ArticleCreate) -> Article:
    article_url = body.name.replace(" ", "_")
    try:
        write_source(article_url, f"{body.author}\n{body.content}")
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Le nom de l'article ne permet pas de créer un fichier valide.") from error
    except FileExistsError:
        raise HTTPException(status_code=409, detail="Un article portant ce nom existe déjà. Choisis un autre nom.")
    
    return get_article(article_url)


def edit_article(body: ArticleEdit, article_url: str) -> Article:
    if not exists(article_url):
        raise HTTPException(status_code=404, detail="Article non trouvé")

    author = body.author if body.author is not None else get_article(article_url).author
    write_source(article_url, f"{author}\n{body.content}", overwrite=True)
    return get_article(article_url)

def delete_article(article_url: str) -> dict[str, bool]:
    try:
        delete_article_file(article_url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Chemin d'article invalide.") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Article non trouvé.") from error
    return {"deleted": True}

def get_comments() -> list[Comment]:
    return read_comments()


def create_comment(newComment: NewComment) -> Comment:
    comment = Comment(
        id=max_comment_id() + 1,
        author=newComment.author,
        content=newComment.content,
    )
    return write_comment(comment)
