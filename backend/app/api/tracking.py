from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, DBSession
from app.models import Application, Interview, User
from app.schemas.tracking import (
    ApplicationCreate, ApplicationData, ApplicationResponse,
    InterviewData, InterviewResponse,
)


router = APIRouter(tags=["Applications and interviews"])


def accessible_application(application_id: int, db: Session, user: User) -> Application:
    statement = select(Application).where(Application.id == application_id)
    if user.role != "superadmin":
        statement = statement.where(Application.user_id == user.id)
    application = db.scalar(statement)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.get("/applications", response_model=list[ApplicationResponse])
def list_applications(db: DBSession, user: CurrentUser):
    statement = select(Application).order_by(Application.created_at.desc(), Application.id.desc())
    if user.role != "superadmin":
        statement = statement.where(Application.user_id == user.id)
    return db.scalars(statement).all()


@router.post("/applications", response_model=ApplicationResponse, status_code=201)
def create_application(payload: ApplicationCreate, db: DBSession, user: CurrentUser):
    owner_id = payload.user_id or user.id
    if user.role != "superadmin" and owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only create your own applications")
    owner = db.get(User, owner_id)
    if owner is None or not owner.is_active:
        raise HTTPException(status_code=422, detail="Select an active account")
    application = Application(**payload.model_dump(exclude={"user_id"}), user_id=owner_id)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.put("/applications/{application_id}", response_model=ApplicationResponse)
def update_application(application_id: int, payload: ApplicationData, db: DBSession, user: CurrentUser):
    application = accessible_application(application_id, db, user)
    for field, value in payload.model_dump().items():
        setattr(application, field, value)
    db.commit()
    db.refresh(application)
    return application


@router.get("/interviews", response_model=list[InterviewResponse])
def list_interviews(db: DBSession, user: CurrentUser):
    statement = select(Interview).join(Application).order_by(Interview.scheduled_at, Interview.id)
    if user.role != "superadmin":
        statement = statement.where(Application.user_id == user.id)
    return db.scalars(statement).all()


@router.post("/interviews", response_model=InterviewResponse, status_code=201)
def create_interview(payload: InterviewData, db: DBSession, user: CurrentUser):
    accessible_application(payload.application_id, db, user)
    values = payload.model_dump()
    values["meeting_link"] = str(payload.meeting_link) if payload.meeting_link else None
    interview = Interview(**values)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.put("/interviews/{interview_id}", response_model=InterviewResponse)
def update_interview(interview_id: int, payload: InterviewData, db: DBSession, user: CurrentUser):
    statement = select(Interview).join(Application).where(Interview.id == interview_id)
    if user.role != "superadmin":
        statement = statement.where(Application.user_id == user.id)
    interview = db.scalar(statement)
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    accessible_application(payload.application_id, db, user)
    values = payload.model_dump()
    values["meeting_link"] = str(payload.meeting_link) if payload.meeting_link else None
    for field, value in values.items():
        setattr(interview, field, value)
    db.commit()
    db.refresh(interview)
    return interview
