from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.redis import get_redis, close_redis
from app.api.v1 import router as v1_router
from app.api.swd.v1 import router as swd_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm the Redis connection
    await get_redis()
    yield
    # Shutdown: clean up
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description="Gate pass management system for BITS campus",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)
app.include_router(swd_router)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}
