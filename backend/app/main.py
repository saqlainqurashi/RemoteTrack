from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.members import router as members_router
from app.api.tracking import router as tracking_router

app = FastAPI(
    title="RemoteTrack API",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(members_router)
app.include_router(tracking_router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "RemoteTrack"
    }
