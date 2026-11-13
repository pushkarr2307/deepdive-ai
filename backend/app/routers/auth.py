from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from ..db import db
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, get_current_user, hash_password, verify_password
from ..utils import now

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public(user: dict) -> dict:
    return {"id": str(user["_id"]), "name": user["name"], "email": user["email"]}


@router.post("/register", status_code=201)
def register(body: RegisterIn):
    doc = {"name": body.name.strip(), "email": body.email.lower(),
           "password_hash": hash_password(body.password), "created_at": now()}
    try:
        res = db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists")
    doc["_id"] = res.inserted_id
    from ..db import save_state
    save_state()
    return {"token": create_token(str(res.inserted_id)), "user": _public(doc)}


@router.post("/login")
def login(body: LoginIn):
    user = db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": create_token(str(user["_id"])), "user": _public(user)}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return _public(user)
