"""Read and write site-wide comments without depending on HTTP routes."""

import json
from pathlib import Path

from schemas import Comment

comments_path: Path = Path(__file__).resolve().parent.parent / "wiki" / "comments.json"


def parse_comments(text: str) -> list[Comment]:
    """Validate decoded JSON and return comment objects."""
    # JSON decoding is dynamic, so its container still needs a runtime check.
    data: list[object] = json.loads(text)
    if type(data) is not list:
        raise ValueError("The file must contain a list of comments.")

    comments: list[Comment] = []
    for item in data:
        comments.append(Comment.model_validate(item))
    return comments


def read_comments() -> list[Comment]:
    """Return saved comments in publication order, or an empty list."""
    if not comments_path.is_file():
        return []
    return parse_comments(comments_path.read_text(encoding="utf-8"))


def max_comment_id(comments: list[Comment]) -> int:
    """Return the highest ID from the supplied list without reading any files."""
    maximum: int = 0
    for comment in comments:
        if comment.id > maximum:
            maximum = comment.id
    return maximum


def write_comments(comments: list[Comment]) -> None:
    """Persist the supplied list without allocating IDs or changing its items."""
    data: list[dict[str, object]] = []
    for comment in comments:
        data.append(comment.model_dump())

    comments_path.parent.mkdir(parents=True, exist_ok=True)
    comments_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
