"""Persist site-wide comments in a JSON file, in publication order."""

from pathlib import Path
import json
from schemas import Comment
from fastapi import HTTPException
import logging

commentsPath: Path = Path(__file__).resolve().parent.parent / "wiki" / "comments.json"


def read_comments() -> list[Comment]:
    """Load saved comments in publication order."""
    if not commentsPath.is_file():
        return []
    try:
        data: object = json.loads(commentsPath.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("The file must contain a list of comments.")

        comments: list[Comment] = []
        for item in data:
            comments.append(Comment.model_validate(item))
        return comments
    except ValueError as error:
        logging.getLogger(__name__).exception("Invalid comments file")
        raise HTTPException(
            status_code=500,
            detail="The comments file is invalid. No comment was added; the file needs to be repaired.",
        ) from error


def max_comment_id() -> int:
    """Return the highest saved ID, or zero if there are no comments."""
    maximum: int = 0
    comment: Comment
    for comment in read_comments():
        if comment.id > maximum:
            maximum = comment.id
    return maximum


def write_comment(comment: Comment) -> Comment:
    """Append the comment, then rewrite the complete JSON file."""
    comments: list[Comment] = read_comments()
    comments.append(comment)
    commentsPath.parent.mkdir(parents=True, exist_ok=True)
    data: list[dict[str, object]] = []
    item: Comment
    for item in comments:
        data.append(item.model_dump())

    commentsPath.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return comment
