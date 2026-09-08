from pydantic import BaseModel, Field, field_validator

class ArticleCreate(BaseModel):
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


class ArticleEdit(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=100_000
    )


# Response models: rendered HTML and existing articles can exceed input limits.
class Article(BaseModel):
    name: str
    content: str
    articleUrl: str
    source: str


class ArticleInfo(BaseModel):
    name: str
    articleUrl: str
