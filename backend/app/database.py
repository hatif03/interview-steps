import json

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import settings

_app: firebase_admin.App | None = None
_client: firestore.Client | None = None


def _init_firebase() -> firestore.Client:
    global _app, _client
    if _client is not None:
        return _client

    if not firebase_admin._apps:
        cred_json = settings.firebase_credentials_json
        if cred_json and cred_json.strip().startswith("{"):
            cred = credentials.Certificate(json.loads(cred_json))
        elif settings.firebase_credentials_path:
            cred = credentials.Certificate(settings.firebase_credentials_path)
        else:
            cred = credentials.ApplicationDefault()

        options = {}
        if settings.firebase_project_id:
            options["projectId"] = settings.firebase_project_id
        _app = firebase_admin.initialize_app(cred, options or None)

    _client = firestore.client()
    return _client


def get_firestore_client() -> firestore.Client:
    return _init_firebase()


def verify_firebase_token(id_token: str) -> dict:
    from firebase_admin import auth

    _init_firebase()
    return auth.verify_id_token(id_token)
