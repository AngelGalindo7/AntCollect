from backend.models import Post
from backend.schemas import UserSearch

MODERATOR_ROLES = frozenset({"admin", "moderator"})


def can_delete_post(actor: UserSearch, post: Post) -> bool:
    if actor.user_id == post.user_id:
        return True
    return actor.role in MODERATOR_ROLES


def is_acting_as_moderator(actor: UserSearch, post: Post) -> bool:
    return actor.user_id != post.user_id and actor.role in MODERATOR_ROLES
