from pathlib import Path
import json
from schemas import Comment
from pydantic import ValidationError
from fastapi import HTTPException
import logging

commentsPath = Path(__file__).resolve().parent.parent / "wiki" / "comments.json"


def read_comments() -> list[Comment]:
    if not commentsPath.is_file():
        return []
    try:
        data = json.loads(commentsPath.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("Expected a list of comments")
        return [Comment.model_validate(comment) for comment in data]
    except (ValueError, ValidationError) as error:
        logging.getLogger(__name__).exception("Invalid comments file")
        raise HTTPException(
            status_code=500,
            detail="Le fichier des commentaires est invalide. Aucun commentaire n'a été ajouté ; le fichier doit être réparé.",
        ) from error


def max_comment_id() -> int:
    return max((comment.id for comment in read_comments()), default=0)


def write_comment(comment: Comment) -> Comment:
    comments = read_comments()
    comments.append(comment)
    commentsPath.parent.mkdir(parents=True, exist_ok=True)
    commentsPath.write_text(
        json.dumps([item.model_dump() for item in comments], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return comment
