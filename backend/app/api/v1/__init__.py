from fastapi import APIRouter
from app.api.v1 import auth, passes, gate, vehicles, users

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(passes.router)
router.include_router(gate.router)
router.include_router(vehicles.router)
router.include_router(users.router)
