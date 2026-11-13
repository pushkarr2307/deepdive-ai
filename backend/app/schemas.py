from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class YouTubeIn(BaseModel):
    url: str = Field(min_length=8, max_length=500)


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
