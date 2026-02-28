from fastapi import FastAPI

from .config import settings


def create_app() -> FastAPI:
    # Initialize Sentry if DSN is provided
    app = FastAPI(
        title=settings.PROJECT_NAME,
        debug=settings.DEBUG,
        version=settings.PROJECT_VERSION,
        description="Agents AI Backend API",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "message": "Starter template API",
            "version": settings.PROJECT_VERSION,
            "docs": f"{settings.API_V1_STR}/docs",
        }

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
