# Article Frontend

A small Vue 3 client for the article API built during the course. It provides a
visual interface for listing, reading, creating, and editing articles while the
backend remains the main focus of the project.

Vue is included locally and runs directly in the browser. There is no package
manager, build step, or frontend server to configure.

## Running the project

See [Backend tutorials](BACKEND_TUTORIALS.md) for the metadata and comments
exercises, including Python examples for JSON and file handling.

1. Start the FastAPI backend at `http://127.0.0.1:8000`.
2. Open `index.html` in a browser.

If your browser restricts local files, serve the directory instead:

```bash
python3 -m http.server 5173
```

Then open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Configuration

Edit `config.js` to change the API address or enable features:

```js
window.APP_CONFIG = {
  apiUrl: 'http://127.0.0.1:8000',

  features: {
    create: true,
    edit: true,
  },
}
```

The `create` and `edit` flags can be enabled when the corresponding backend
routes are implemented.

## API contract

Request and response bodies use JSON when present. Article URLs follow the
Wikipedia convention: the URL is the article name with whitespace replaced by
underscores.

```text
My article → My_article
```



### List articles

```http
GET /list
```

```json
[
  {
    "name": "My article",
    "articleUrl": "My_article"
  },
  {
    "name": "Symmetric cryptography",
    "articleUrl": "Symmetric_cryptography"
  }
]
```

The **Refresh list** button calls this endpoint again.

### Read an article

```http
GET /article/{article_url}
```

```json
{
  "name": "My article",
  "articleUrl": "My_article",
  "content": "<h1>My article</h1><p>Rendered HTML.</p>",
  "source": "# My article\n\nMarkdown source."
}
```

- `content` is the HTML rendered by the backend and displayed on the article
page.
- `source` is the original Markdown used by the edit form. It is only required
when editing is enabled.



### Create an article

```http
POST /create
Content-Type: application/json
```

Request body:

```json
{
  "name": "My article",
  "content": "# My article\n\nMarkdown source."
}
```

The backend creates the file, generates the article URL, and returns the created
article:

```json
{
  "name": "My article",
  "articleUrl": "My_article",
  "content": "<h1>My article</h1><p>Markdown source.</p>",
  "source": "# My article\n\nMarkdown source."
}
```

The frontend refreshes the article list and redirects using `articleUrl` from
this response. The creation request does not send a URL.

### Edit an article

```http
POST /article/{article_url}/edit
Content-Type: application/json
```

Request body:

```json
{
  "content": "# Updated title\n\nUpdated Markdown source."
}
```

The frontend derives `article_url` from the article name. Any successful `2xx`
response redirects the user back to the article page.

### Optional metadata

Creation and editing also accept `author` and `category` as strings, and `tags`
as an array of strings:

```json
{
  "author": "Alex",
  "category": "Programming",
  "tags": ["Python", "Web"]
}
```

These fields are optional. Existing articles without them still work. The forms
send empty strings and an empty array when left blank; on editing, these values
clear existing metadata. The backend should store these fields and return them
with the article so they can be displayed and edited. Tags are entered as a
comma-separated list in the interface.

Store metadata as a single JSON object on the first line of each Markdown file:

```text
{"author": "Alex", "tags": ["Python", "Web"], "category": "Programming"}

# My article

Article content.
```

When reading, extract the JSON line and return its fields with the article.
Only the remaining Markdown is converted to HTML (`content`) or returned for
editing (`source`). When saving, write the JSON line followed by a newline and
the Markdown body. For older files whose first line is not a JSON object, treat
the entire file as Markdown with empty metadata.

## Delete an article

The Delete button opens a confirmation dialog. Confirming sends
`GET /article/{article_url}/delete` using the article URL returned by the API.
Canceling sends no request. The backend moves the article file into `./trash` and returns
a JSON confirmation such as `{"deleted": true}`, or an empty successful response.
The frontend then opens the article list and reloads it.

Assume `./trash` already exists. If the destination file exists, delete that
old copy with `Path.unlink()`, then move the article with
`source.rename(destination)`. The whole file moves, including its metadata.
Only active articles belong in `GET /list`.

If the request fails, the confirmation dialog displays a short backend implementation
guide from `delete-article-guide.js`. Retrying requires confirmation again.

## Site comments

If a comments request returns `404` or `405`, the page displays a backend
implementation guide instead of the discussion. “Check backend again” retries
the GET route. Network errors and server failures keep their normal error messages.
The guide lives in `comments-guide.js`, a standalone Vue component.

The `#/comments` page is a site-wide discussion, independent of articles.
Comments load on entry and can be refreshed manually.

`GET /comments` returns an array in display order (oldest first):

```json
[
  { "id": 1, "author": "Alex", "content": "Thanks for the articles!" }
]
```

`POST /comments` receives:

```json
{ "author": "Alex", "content": "Thanks for the articles!" }
```

The backend stores the comment and returns the stored object with a unique
`id` (number or string), preferably with status `201`. The frontend appends
this response and clears the form. Content is required; the author is optional.
An empty, missing or null author displays as “Anonymous”.

Comments are plain text, not HTML or Markdown. The backend must implement both
routes; comments have no article identifier.

## CORS

An HTML file opened directly has a `null` origin. The following FastAPI setup is
suitable for this local project:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For a deployed application, replace `"*"` with the actual frontend origin.

## Project structure

```text
simplefront/
├── index.html      # Interface and Vue directives
├── app.js          # Vue state, actions, and navigation
├── api.js          # Requests to the FastAPI backend
├── config.js       # API address and feature flags
├── style.css       # Interface styles
└── vendor/         # Local Vue 3 distribution
```

`api.js` exposes article operations and the `listComments` and `createComment`
methods. The application uses hash-based URLs such as
`#/article/My_article`, so direct navigation and browser refreshes work without
server-side routing.

## Troubleshooting

Use the **Console** button at the bottom of the page to inspect API traffic.
Expand a request to read the sent and received bodies. The panel keeps the last
50 requests, including failures, until you clear it or reload the browser.
Its display and shared request log live in `api-console.js`.

- Open the browser console to inspect every API request and response status.
- If FastAPI logs `200` but the frontend reports a network error, check the CORS
middleware and reload the page.
- If Markdown appears as plain text, ensure the backend returns rendered HTML in
`content`, not the Markdown source.



## Savanna background

The existing static server also serves the Three.js scene. No build step or CDN
connection is required. Three.js 0.186.0 and its loaders live in `vendor/three/`;
the six downloaded CC0 models and their source checksums live in `assets/models/`.

The scene is split by responsibility:

- `savanna-world.js`: terrain, water, trees, lighting and shared coordinates.
- `savanna-animals.js`: loading static GLB models and procedural poses.
- `savanna-movement.js` / `savanna-collisions.js`: committed detours, clear steps and waiting.
- `savanna-herd.js`: drinking, grazing, leaf browsing, fleeing and population recovery.
- `savanna-hunter.js`: cover, stalking, chasing and contact checks after a pounce.
- `savanna-crocodiles.js`: lurking, shore attacks and underwater retreats.
- `savanna-effects.js`: bounded ripple and splash resources.
- `savanna-simulation.js`: population setup and the update order.
- `savanna-scene.js`: rendering, resizing and document lifecycle.

The animation stops in hidden tabs and follows reduced-motion preferences.
Audio stays opt-in: generated percussion, animal recordings and synthesized
splashes share the existing sound controls. The scene never intercepts clicks.

On localhost only, `live-preview.js` reloads changed scene files every three
seconds. It pauses checks in hidden tabs and defers a reload while a form control
is focused. There is no production polling on other hostnames.
