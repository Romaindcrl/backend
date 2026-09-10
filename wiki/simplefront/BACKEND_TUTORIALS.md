# Backend tutorials

Extend the article API with optional metadata and a site-wide comments page.
The frontend is already prepared for both features. Implement the routes and
storage in FastAPI, then use the interface to check the result.

## Working with JSON in Python

JSON is a text format for structured data. Python's built-in `json` module
converts between JSON text and Python values.

### Convert between text and Python objects

```python
import json

metadata = {
    "author": "Alex",
    "tags": ["Python", "Web"],
    "category": "Programming",
}

text = json.dumps(metadata, ensure_ascii=False)
restored_metadata = json.loads(text)

print(restored_metadata["author"])  # Alex
```

- `json.dumps(value)` returns a string.
- `json.loads(text)` parses a string and returns a Python value.
- JSON objects become dictionaries; arrays become lists.
- `ensure_ascii=False` keeps accented characters readable.

JSON uses double quotes and the values `true`, `false`, and `null`.
Python uses `True`, `False`, and `None`. Let the JSON module handle the
conversion rather than constructing JSON with string concatenation.

### Read and write a complete JSON file

```python
import json
from pathlib import Path

path = Path("comments.json")
comments = [
    {"id": 1, "author": "Alex", "content": "Great articles!"},
]

with path.open("w", encoding="utf-8") as file:
    json.dump(comments, file, ensure_ascii=False, indent=2)

with path.open("r", encoding="utf-8") as file:
    saved_comments = json.load(file)
```

`dump` and `load` work with open files; `dumps` and `loads` work with
strings. Both comments and article metadata use complete JSON files.

## Reading an article and its metadata

Each article uses two files in the same directory, with the same name and
different extensions.

`My_article.md` contains only Markdown:

```markdown
# My article

Article content.
```

`My_article.json` contains its metadata:

```json
{
  "author": "Alex",
  "tags": ["Python", "Web"],
  "category": "Programming"
}
```

Read the Markdown file, then load its companion JSON file if it exists:

```python
import json
from pathlib import Path

path = Path("My_article.md")
metadata_path = path.with_suffix(".json")

markdown_body = path.read_text(encoding="utf-8")
metadata = {"author": "", "tags": [], "category": ""}

if metadata_path.exists():
    with metadata_path.open("r", encoding="utf-8") as file:
        metadata.update(json.load(file))
```

`with_suffix(".json")` changes the extension of the path:
`My_article.md` becomes `My_article.json`. It does not rename any file.

If the JSON file is missing, the default values remain: an empty author, an
empty category and an empty tags list. If it exists but omits a field, that
field also keeps its default value. The file must contain a valid JSON object.

## Writing an article and its metadata

Write the Markdown and JSON separately:

```python
path.write_text(markdown_body, encoding="utf-8")

with metadata_path.open("w", encoding="utf-8") as file:
    json.dump(metadata, file, ensure_ascii=False, indent=2)
```

Both operations create the file if needed or replace its existing contents.
The JSON can span several lines because it is stored in its own file.

To change only the author, update the metadata and write only the JSON file:

```python
metadata["author"] = "Sam"

with metadata_path.open("w", encoding="utf-8") as file:
    json.dump(metadata, file, ensure_ascii=False, indent=2)
```

The Markdown file does not need to be rewritten when only metadata changes.

## Exercise: article metadata

### Define the fields

Add these optional fields to the article request and response models:

- `author`: a string, empty by default.
- `category`: a string, empty by default.
- `tags`: a list of strings, empty by default. In Pydantic, use
  `Field(default_factory=list)` for its default.

The frontend converts comma-separated tags into a JSON array before sending
them. Keep this array format in storage and responses.

### Connect the routes to storage

1. In `POST /create`, accept the name, Markdown content, and optional metadata.
   Generate the filename from the name by replacing spaces with underscores:
   `My article` becomes `My_article.md`.
2. Write the Markdown to `My_article.md` and the metadata to `My_article.json`.
3. In `GET /article/{article_url}`, read both files. Convert only
   the Markdown body to HTML.
4. In `POST /article/{article_url}/edit`, update the body and supplied metadata,
   then save the corresponding files.

An empty author or category string, or an empty tags array, clears that value.
If a field is omitted from an editing request, preserve its saved value.
Pydantic's `model_dump(exclude_unset=True)` helps distinguish omitted fields
from explicitly supplied empty values.

The reading route returns:

```json
{
  "name": "My article",
  "articleUrl": "My_article",
  "author": "Alex",
  "tags": ["Python", "Web"],
  "category": "Programming",
  "content": "<h1>My article</h1><p>Article content.</p>",
  "source": "# My article\n\nArticle content."
}
```

`content` contains rendered HTML; `source` contains the Markdown body used by
the editor. Metadata comes from the companion JSON file.

The creation route returns the created article, including `articleUrl`.
The frontend uses that response to refresh the list and open the new article.
Metadata stays optional: older files must still work.

### Check the result

Create an article with metadata, read it back, edit its author and tags, then
reload it. Also check that clearing a field removes its saved value and that
an article without a JSON file loads with default metadata.

The frontend's metadata exercise disappears for each author or tags field once
that field has a value.

## Exercise: site-wide comments

Comments belong to the whole site, not to individual articles. They have no
article identifier and are displayed as plain text.

### Define the data

Use a Pydantic request model with a required, non-blank `content` string and an
optional `author` string. Reject content containing only whitespace.
Generate a unique `id` on the backend; do not ask the frontend to supply it.

### List comments

`GET /comments` returns an array, oldest first:

```json
[
  {"id": 1, "author": "Alex", "content": "Great articles!"}
]
```

Return `[]` when there are no comments.

### Create a comment

`POST /comments` accepts:

```json
{"author": "Alex", "content": "Great articles!"}
```

Validate the input, store the comment, and return the stored object:

```json
{"id": 1, "author": "Alex", "content": "Great articles!"}
```

The frontend adds this response to the list and clears the form. An empty author
displays as “Anonymous”.

### Add persistence

Start with a Python list to check the routes. It resets when the server restarts.
Then use a `comments.json` file with the `json.load` and `json.dump` operations
shown above:

1. Read the saved list, or use an empty list if the file does not exist yet.
2. Add the new comment with its generated ID.
3. Write the complete list back to the JSON file.
4. Return the newly stored comment.

Keep identifiers unique across restarts. A UUID string is one option.
Simple file storage is sufficient for this exercise; simultaneous writes would
need coordination or database storage.

### Check the complete flow

Use `/docs` to create a comment and check that it appears in the GET response.
Then repeat through the frontend. Once persistence is implemented, restart
FastAPI and verify that previously saved comments are still returned.

## Exercise: move an article to trash

Implement `GET /article/{article_url}/delete`. Instead of permanently deleting
the article, move its Markdown file into `./trash`. Assume this directory
already exists.

Use `pathlib` to build the source and destination paths:

```python
from pathlib import Path

source = Path("./article") / f"{article_url}.md"
destination = Path("./trash") / source.name

if destination.exists():
    destination.unlink()

source.rename(destination)
```

Adapt `./article` to your article directory. `source.name` is the filename,
including its extension. If that filename is already in trash, `unlink()`
deletes the old trash copy. Then `rename()` moves the current article into its
place. Repeat the same operation for `source.with_suffix(".json")` if that
file exists, so the metadata also moves into trash.

After the move, return a JSON confirmation:

```python
return {"deleted": True}
```

The frontend asks for confirmation before sending the request. Once the backend
responds successfully, it opens the article list and refreshes it.

### Check the result

Delete an article through the interface. Verify that its file is now in trash
and no longer appears in `GET /list`. Repeat with another article whose filename
already exists in trash: the previous trash copy should be replaced.
