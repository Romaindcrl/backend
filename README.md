# Backend

A local FastAPI application for Markdown articles and site-wide comments.
Requires Python 3.14+ and uv.

## Start the application

Run these commands from the `backend` directory:

```sh
uv sync --locked
mkdir -p ../wiki/trash
uv run fastapi dev
```

The development command reloads the application when Python files change.
Stop it with `Ctrl+C` before starting another server on port 8000.

- Article list: <http://127.0.0.1:8000/list>
- Interactive API documentation: <http://127.0.0.1:8000/docs>
- OpenAPI schema: <http://127.0.0.1:8000/openapi.json>

Simplefront runs as a separate HTTP server. It is not mounted at `/wiki`, and
`/` is not an API route.

For a local launch without automatic reloading, use either:

```sh
uv run main.py
uv run backend
```

Run only one of these commands at a time. Both listen on port 8000 on all local
network interfaces. The `backend` console entry point locates the root
`main.py` relative to its editable checkout, rather than the current shell
directory. It uses Uvicorn's `app_dir` argument to make the root modules importable.

## Code structure

| File | Responsibility |
| --- | --- |
| `main.py` | Create the application, configure CORS and register routes and shared filesystem-error handling. |
| `routes.py` | Coordinate HTTP requests, storage calls, rendering and responses. |
| `schemas.py` | Define Pydantic request validation and response models. |
| `articles.py` | Validate article paths; read, write and move article files. |
| `comments.py` | Read and write the site-wide comments JSON file. |
| `src/backend/__init__.py` | Implement the local `backend` console command. |
| `src/backend/app.py` | Legacy ASGI alias; importing it requires the project root on Python's import path. Use the launch commands above. |

Data is stored alongside the backend, not inside the Python package:

```text
FastAPI/
├── backend/
│   ├── main.py
│   ├── routes.py
│   ├── schemas.py
│   ├── articles.py
│   ├── comments.py
│   └── src/backend/
│       ├── __init__.py
│       └── app.py
└── wiki/
    ├── articles/
    │   └── My_article.md
    ├── trash/
    └── comments.json
```

The file helpers resolve `wiki` from their own location, so storage does not
change when the application is launched from a different working directory.

## Article file format

The first line is always the author's name. Every remaining line is Markdown:

```text
Alex
# My article

Article content.
```

An anonymous article starts with an empty first line. A heading on the first
line would be treated as the author, so place headings after the author line.
Article files do not use JSON metadata or companion JSON files.

`read_source()` returns `(content, author)`, or `None` if the file is missing
or the path is invalid. In an API response:

- `author` is the first line, without its newline.
- `source` is the Markdown body, without the author line.
- `content` is the HTML rendered from that Markdown body.

`markdown2` handles LaTeX and fenced code blocks through the `latex` and
`fenced-code-blocks` extras. Rendered HTML is never written back to the article file.

## HTTP routes

Successful requests currently return HTTP 200 and JSON.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/list` | None | Array of active article summaries: `name`, `articleUrl`, `author`. |
| GET | `/article/{article_url}` | None | Article with `name`, `articleUrl`, `author`, `source` and rendered `content`. |
| POST | `/create` | `name`, `content`, optional `author` | Created article. |
| POST | `/article/{article_url}/edit` | `content`, optional `author` | Updated article. |
| GET | `/article/{article_url}/delete` | None | `{"deleted": true}` after moving the file. |
| GET | `/comments` | None | Comments in saved order, oldest first. |
| POST | `/comments` | `content`, optional `author` | Saved comment with its generated `id`. |

### Create and edit articles

Example creation body:

```json
{
  "name": "My article",
  "author": "Alex",
  "content": "# My article\n\nArticle content."
}
```

The backend replaces each space in the name with an underscore, producing
`My_article.md`. Creation refuses to overwrite an existing article.

Example editing body:

```json
{"content": "# Updated article"}
```

Omitting `author` preserves its saved value. Sending `"author": ""` clears it.
The body is replaced on every edit. Keep `source`, rather than rendered HTML,
in the editor's content field.

### Move an article to trash

The course API uses `GET /article/{article_url}/delete`. The frontend asks for
confirmation before calling it; a direct API call performs the move immediately.
The `wiki/trash` directory must already exist.

If an older trash copy has the same name, it is removed with `unlink()`.
The active file is then moved with `rename()`, preserving both the author line
and the Markdown body. Only `wiki/articles/*.md` is included in `/list`.

### Site-wide comments

Example request:

```json
{"author": "Alex", "content": "Great articles!"}
```

The author is optional. An omitted or empty author is saved as an empty string.
Content is required and cannot contain only whitespace. The backend generates
an integer ID from the highest ID already in `comments.json`.

A missing comments file is read as an empty list. New comments are appended,
then the complete JSON list is written back. Loading IDs from disk preserves
the counter across restarts; the current implementation does not coordinate
simultaneous writes.

## Validation and errors

- Article names: 1–100 characters after trimming; ASCII letters, digits,
  spaces, underscores, dots and hyphens are allowed.
- Article bodies: 1–100,000 characters, not whitespace-only, without null characters.
- Authors: optional, at most 100 characters, without newlines or null characters.
- Comment text: 1–100 characters after trimming.
- Response models do not apply the article input length limit to rendered HTML.

Pydantic validation errors use FastAPI's standard HTTP 422 response. Other
errors use a readable `detail` string:

| Status | Meaning |
| --- | --- |
| 404 | Article not found. |
| 409 | An article with this name already exists. |
| 422 | Invalid request fields or article path. |
| 500 | Filesystem access or invalid stored comments; details are logged server-side. |

Path validation rejects separators and paths that resolve outside the active
article directory, including links pointing outside it.

## Current limitations

This is a local file-based application. Concurrent comment writes can overwrite
one another or allocate duplicate IDs. Article HTML is not sanitized, so only
trusted Markdown should be displayed. Editing currently renders the previous
article to read its author; malformed LaTeX in that version can block an edit.
