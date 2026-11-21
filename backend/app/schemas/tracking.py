from datetime import date, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl


class ApplicationData(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: str = Field(min_length=1, max_length=150)
    job_title: str = Field(min_length=1, max_length=150)
    job_type: str = Field(default="remote", min_length=1, max_length=30)
    application_status: str = Field(default="applied", min_length=1, max_length=30)
    applied_at: date | None = None
    notes: str | None = None


class ApplicationCreate(ApplicationData):
    user_id: int | None = Field(default=None, gt=0)


class ApplicationResponse(ApplicationData):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime


class InterviewData(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    application_id: int | None = Field(default=None, gt=0)
    round_name: str = Field(min_length=1, max_length=100)
    scheduled_at: AwareDatetime
    meeting_link: HttpUrl | None = None
    status: str = Field(default="scheduled", min_length=1, max_length=30)
    notes: str | None = None


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    application_id: int | None
    round_name: str
    scheduled_at: datetime
    meeting_link: str | None
    status: str
    notes: str | None
    created_at: datetime
