import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db
from backend.models import Post, Report, User
from ..schemas import CreateReportRequest, ReportResponse, ReportTargetType, UserSearch
from ..utils.auth import authenthicate_access_token
from ..utils.rate_limit import get_user_or_ip_key, limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def _validate_target(target_type: str, target_id: int, db: Session) -> None:
    """Raise 404 if the reported target does not exist."""
    if target_type == ReportTargetType.post.value:
        exists = db.scalar(select(Post.id).where(Post.id == target_id))
    else:
        exists = db.scalar(select(User.id).where(User.id == target_id))
    if not exists:
        raise HTTPException(status_code=404, detail=f"{target_type} not found")


def _process_report(report_id: int) -> None:
    """
    Future AI moderation hook. Drop an async BackgroundTask call here to score
    the report, write ai_score/notes back, and flip status to 'actioned' when
    the score exceeds the configured threshold.
    """
    pass


@router.post("", status_code=201, response_model=ReportResponse)
@limiter.limit("10/hour", key_func=get_user_or_ip_key)
async def create_report(
    request: Request,
    body: CreateReportRequest,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
) -> ReportResponse:
    reporter_id = current_user.user_id

    _validate_target(body.target_type.value, body.target_id, db)

    duplicate = db.scalar(
        select(Report.id).where(
            Report.reporter_id == reporter_id,
            Report.target_type == body.target_type.value,
            Report.target_id == body.target_id,
            Report.status == "pending",
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="You have already reported this content")

    report = Report(
        reporter_id=reporter_id,
        target_type=body.target_type.value,
        target_id=body.target_id,
        reason=body.reason.value,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(
        "report created",
        extra={
            "report_id": report.id,
            "reporter_id": reporter_id,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "reason": report.reason,
        },
    )

    return report
