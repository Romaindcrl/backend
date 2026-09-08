# Backend

API FastAPI, avec Python 3.14+ et uv.

## Installation et lancement

```sh
uv sync --locked
uv run fastapi dev
```

Liste des articles (JSON) : http://127.0.0.1:8000/

Wiki (Simplefront) : http://127.0.0.1:8000/wiki/ — documentation API : http://127.0.0.1:8000/docs

FastAPI sert aussi Simplefront : aucun serveur séparé sur le port 5173.
Pour un accès depuis le réseau local : `uv run fastapi dev --host 0.0.0.0`.

Le rechargement automatique est activé. Les commandes `uv run main.py` et
`uv run backend` lancent le même serveur sans rechargement. Pour utiliser Python
directement, activer l'environnement avec `source .venv/bin/activate`, puis
exécuter `python main.py`.

## Développement avec rechargement automatique

```sh
uv run fastapi dev
```

Arrêter le serveur avec `Ctrl+C`.
