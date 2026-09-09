from pydantic import BaseModel, Field, field_validator

class ArticleInput(BaseModel):
    @field_validator("content", check_fields=False)
    @classmethod
    def meaningful_content(cls, value):
        if not value.strip():
            raise ValueError("Le contenu ne peut pas être vide ou composé uniquement d'espaces.")
        if "\x00" in value:
            raise ValueError("Le contenu contient un caractère interdit.")
        return value


class ArticleCreate(ArticleInput):
    author: str = Field(default="", max_length=100, pattern=r"^[^\r\n\x00]*$")
    name: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z0-9 _.-]+$"
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    content: str = Field(
        min_length=1,
        max_length=100_000
    )


class ArticleEdit(ArticleInput):
    author: str | None = Field(default=None, max_length=100, pattern=r"^[^\r\n\x00]*$")
    content: str = Field(
        min_length=1,
        max_length=100_000
    )


# Response models: rendered HTML and existing articles can exceed input limits.
class Article(BaseModel):
    author: str
    name: str
    content: str
    articleUrl: str
    source: str


class ArticleInfo(BaseModel):
    name: str
    author: str
    articleUrl: str

class NewComment(BaseModel):
    author: str = Field(min_length=1, max_length=100, pattern=r"^[^\r\n\x00]*$")
    content: str = Field(min_length=1, max_length=100)

    @field_validator("author", "content", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class Comment(NewComment):
    id: int
