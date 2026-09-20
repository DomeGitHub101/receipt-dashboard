from pathlib import Path
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    database_url: str = f'sqlite+aiosqlite:///{ROOT / "slipsnap.db"}'
    secret_key: str = ''
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    cookie_secure: bool = False
    allowed_origin: str = 'http://localhost:5173'
    additional_origins: list[str] = []
    upload_dir: Path = ROOT / 'uploads'
    ocr_languages: str = 'eng+tha'
    tesseract_cmd: str = ''
    smtp_host: str = ''
    smtp_port: int = 587
    smtp_username: str = ''
    smtp_password: str = ''
    smtp_from: str = ''
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    public_url: str = 'http://localhost:5173'
    require_verified_email: bool = False


settings = Settings()
if not settings.secret_key:
    key_file = ROOT / '.dev-secret'
    if not key_file.exists():
        key_file.write_text(secrets.token_hex(32), encoding='utf-8')
    settings.secret_key = key_file.read_text(encoding='utf-8').strip()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
