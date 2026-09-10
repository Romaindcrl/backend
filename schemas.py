"""Define request validation and response models for articles and comments."""

from pydantic import BaseModel, Field, field_validator


class ArticleInput(BaseModel):
    """Validation rules shared by article creation and editing."""

    author: str = Field(default="", max_length=100, pattern=r"^[^\r\n\x00]*$")
    content: str = Field(min_length=1, max_length=100_000)

    @field_validator("content")
    @classmethod
    def meaningful_content(cls: type["ArticleInput"], value: str) -> str:
        """Reject blank or null-containing content without changing Markdown spacing."""
        if not value.strip():
            raise ValueError("Content cannot be empty or contain only whitespace.")
        if "\x00" in value:
            raise ValueError("Content contains a forbidden character.")
        # Keep the Markdown unchanged, including its indentation.
        return value


class ArticleCreate(ArticleInput):
    """Article creation data, including a name used to build the filename."""
    name: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9 _.-]+$")

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls: type["ArticleCreate"], value: object) -> object:
        """Trim surrounding whitespace before validating the article name."""
        return value.strip() if isinstance(value, str) else value


class ArticleEdit(ArticleInput):
    """Keep the current author if no author is provided."""

    pass


class Article(BaseModel):
    """Article response: source is Markdown and content is rendered HTML."""
    author: str = ""
    # Responses have no input length limits because rendered HTML may be longer.
    name: str
    content: str
    articleUrl: str
    source: str


class ArticleInfo(BaseModel):
    """Summary of an active article for the listing route."""
    author: str = ""
    name: str
    articleUrl: str


class NewComment(BaseModel):
    """Comment input with required text and an optional author."""
    author: str = Field(default="", max_length=100, pattern=r"^[^\r\n\x00]*$")
    content: str = Field(min_length=1, max_length=100)

    @field_validator("author", "content", mode="before")
    @classmethod
    def strip_text(cls: type["NewComment"], value: object) -> object:
        # Content must not be blank; the author is optional.
        """Trim text before field validation; only the author may remain empty."""
        return value.strip() if isinstance(value, str) else value


class Comment(NewComment):
    """Stored site-wide comment with a backend-assigned identifier."""
    id: int
