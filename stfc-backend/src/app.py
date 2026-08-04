import logging
from config import settings
from db import connect, create_tables
from mcp_stfc import mcp
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    with connect() as conn:
        create_tables(conn)

    # Define the CORS "Security Pass" using Starlette
    cors_middleware = Middleware(
        CORSMiddleware,
        allow_origins=list(settings.mcp_cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    LOGGER = logging.getLogger("mcp")
    LOGGER.info(f"Starting Passive Bridge on {settings.mcp_host}:{settings.mcp_port}")

    # Use the 'middleware' argument to inject CORS safely
    mcp.run(
        transport="sse",
        host=settings.mcp_host, 
        port=settings.mcp_port,
        middleware=[cors_middleware]
    )
