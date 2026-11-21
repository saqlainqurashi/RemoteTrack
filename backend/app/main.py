from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.members import router as members_router
from app.api.tracking import router as tracking_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="RemoteTrack API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://remote-track-2682.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
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
