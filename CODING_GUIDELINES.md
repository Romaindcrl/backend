# Course coding guidelines

Source: `Programmation_createch_1.pdf`, supplied for the programming workshop.
These are the practices from the course, applied to this application's code.

| Course pages | Practice | Application |
| --- | --- | --- |
| 15 | Use uv for the Python project. | Dependencies and the environment remain managed by `pyproject.toml` and `uv.lock`. |
| 24, 26 | Use type hints to remove ambiguity. | Backend parameters, return values and relevant local values are annotated. Pydantic still checks runtime input. |
| 33 | Keep conditions simple and understandable. | Path and data validation use small, explicit checks. |
| 34, 37 | Avoid deep nesting and handle special cases early. | Missing files and invalid inputs return or raise before normal processing. |
| 35 | Use elif for mutually exclusive branches. | Exclusive outcomes use branches or early-return guards; independent checks remain independent. |
| 36 | Avoid comparing conditions to True or False. | Boolean conditions are used directly. |
| 40 | Use while only when the number of iterations is unknown, with a clear termination condition. | The backend iterates over finite collections with for loops. No polling or unbounded while loop is needed. |
| 42 | Give each function one clear responsibility and a descriptive name. | Comment parsing, ID calculation, file writing, HTTP errors and article rendering are separate functions. |
| 42 | Type function parameters and return values. | All backend function signatures are annotated. Browser audio/weather methods document their inputs and results with JSDoc. |
| 42 | Prefer returning values to changing external variables. | Parsing and ID calculation return results. File writes and UI updates are explicit side effects. Configuration paths are not mutated by request handlers. |
| 42 | Keep functions short and avoid duplicated logic. | Article response rendering and HTTP not-found handling are shared helpers. |
| 56, 64 | Separate frontend, backend, retrieval and route definitions. | `main.py` registers paths, `routes.py` handles HTTP, and storage modules have no FastAPI dependency. Browser weather, audio and controls are separate modules. |
| 60, 61 | Use pathlib and handle missing or invalid article paths. | Paths are resolved inside the active directory; missing articles return 404. |
| 65 | Validate API data with Pydantic. | Request models check input types, bounds and blank content; response models describe returned data. |

## Existing project decisions

- Keep code, comments and error messages in English.
- Keep the implementation simple and use the existing dependencies.
- The first line of an article is its author; all following lines are Markdown.
- Comments belong to the whole site and use `comments.json`.
- Audio is opt-in, uses local original sounds and the native Web Audio API,
  and has explicit stop/cleanup controls. Weather timers stop when the page is hidden.
- Reduced-motion preferences disable rain movement and lightning visuals.

Do not turn unrelated slide exercises or example commands into additional
application features. Changes should preserve the chosen API and storage format.
