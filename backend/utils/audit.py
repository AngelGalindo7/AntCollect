import logging

from backend.schemas import UserSearch

logger = logging.getLogger("petrcollect.audit")


def log_admin_action(
    actor: UserSearch,
    action: str,
    target_type: str,
    target_id: int,
    **extra: object,
) -> None:
    logger.info(
        action,
        extra={
            "event": f"admin.{action}",
            "actor_id": actor.user_id,
            "actor_role": actor.role,
            "target_type": target_type,
            "target_id": target_id,
            **extra,
        },
    )
