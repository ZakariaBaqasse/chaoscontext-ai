import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    PROJECT_NAME: str = "FastAPI Backend"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/v1"
    STAGE: str = os.environ.get("STAGE", "local")
    DEBUG: bool = STAGE == "local"

    MISTRAL_API_KEY: str = os.environ.get("MISTRAL_API_KEY", "")


settings = Settings()
