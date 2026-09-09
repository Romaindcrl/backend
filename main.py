import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from routes import list_articles, get_article, create_article, edit_article, get_comments, create_comment

app = FastAPI()


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    labels = {"name": "Titre", "author": "Auteur", "content": "Contenu"}
    messages = []
    for item in error.errors():
        field = labels.get(str(item["loc"][-1]), "Requête")
        kind = item["type"]
        context = item.get("ctx", {})
        if kind == "missing":
            message = f"{field} : ce champ est obligatoire."
        elif kind == "string_too_short":
            message = f"{field} : saisis au moins {context['min_length']} caractère(s)."
        elif kind == "string_too_long":
            message = f"{field} : maximum {context['max_length']} caractères."
        elif kind == "string_type":
            message = f"{field} : une chaîne de texte est attendue."
        elif kind == "string_pattern_mismatch":
            message = ("Titre : utilise des lettres sans accents, chiffres, espaces, points, tirets ou underscores."
                       if field == "Titre" else f"{field} : les retours à la ligne et caractères nuls sont interdits.")
        elif kind == "json_invalid":
            message = "Le corps de la requête n'est pas un JSON valide."
        elif kind == "value_error":
            message = str(context.get("error", "Valeur invalide."))
        else:
            message = f"{field} : format invalide."
        if message not in messages:
            messages.append(message)
    return JSONResponse(status_code=422, content={"detail": " ".join(messages)})


@app.exception_handler(OSError)
async def storage_error(request: Request, error: OSError):
    logging.getLogger(__name__).error("Storage operation failed", exc_info=error)
    return JSONResponse(status_code=500, content={
        "detail": "Impossible d'accéder aux fichiers. Vérifie les permissions du dossier et l'espace disque disponible."
    })


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.get("/list")(list_articles)
app.get("/article/{article_url}")(get_article)
app.post("/create")(create_article)
app.post("/article/{article_url}/edit")(edit_article)
app.get("/comments")(get_comments)
app.post("/comments")(create_comment)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
