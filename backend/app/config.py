from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str = "postgresql://flashcard:flashcard@localhost:5432/flashcards"
    openai_api_key: str = ""
    data_dir: Path = BASE_DIR / "data"


settings = Settings()
