from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")

_load_env_file(PROJECT_ROOT / ".env")
_load_env_file(Path.cwd() / ".env")

# Database pathing
DB_PATH = os.getenv("STFC_DB_PATH", r"C:\Database\combatlogs.db")

MCP_HOST = os.getenv("STFC_MCP_HOST", "127.0.0.1") 
MCP_PORT = int(os.getenv("STFC_MCP_PORT", "8085")) 

LOG_LEVEL = os.getenv("STFC_LOG_LEVEL", "INFO")
MCP_CORS_ORIGINS = tuple(
    origin.strip()
    for origin in os.getenv(
        "STFC_MCP_CORS_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080",
    ).split(",")
    if origin.strip()
)
STFC_PROJECT_ROOT = Path(os.getenv("STFC_PROJECT_ROOT", str(PROJECT_ROOT))).resolve()

@dataclass(frozen=True)
class Settings:
    db_path: str = DB_PATH
    mcp_host: str = MCP_HOST
    mcp_port: int = MCP_PORT
    log_level: str = LOG_LEVEL
    mcp_cors_origins: tuple[str, ...] = MCP_CORS_ORIGINS
    project_root: Path = STFC_PROJECT_ROOT

settings = Settings()
