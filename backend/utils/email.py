import logging
import os

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_ses_client = None


def _get_ses_client():
    global _ses_client
    if _ses_client is None:
        _ses_client = boto3.client(
            "ses",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            endpoint_url=os.getenv("AWS_ENDPOINT_URL"),
        )
    return _ses_client


def send_verification_email(to_email: str, token: str, frontend_url: str) -> None:
    sender = os.getenv("AWS_SES_SENDER_EMAIL")
    if not sender:
        raise RuntimeError("AWS_SES_SENDER_EMAIL is not set")

    link = f"{frontend_url}/verify-email?token={token}"
    subject = "Verify your PetrCollect email"
    html_body = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;text-align:center">'
        "<p>Hi there,</p>"
        "<p>Click the button below to verify your PetrCollect email address.</p>"
        f'<a href="{link}" style="background:#3b82f6;color:#fff;padding:10px 20px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Verify Email</a>'
        "<p>This link expires in 1 hour.</p>"
        "</div>"
    )
    text_body = (
        "Hi there,\n\n"
        "Click the link below to verify your PetrCollect email address.\n\n"
        f"{link}\n\n"
        "This link expires in 1 hour."
    )

    try:
        _get_ses_client().send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": text_body},
                },
            },
        )
    except ClientError:
        logger.error("SES send failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service unavailable")


def send_email_change_verification(to_email: str, token: str, frontend_url: str) -> None:
    sender = os.getenv("AWS_SES_SENDER_EMAIL")
    if not sender:
        raise RuntimeError("AWS_SES_SENDER_EMAIL is not set")

    link = f"{frontend_url}/confirm-email-change?token={token}"
    subject = "Confirm your new PetrCollect email address"
    html_body = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;text-align:center">'
        "<p>Hi there,</p>"
        "<p>You requested to change your email address. Click below to confirm.</p>"
        f'<a href="{link}" style="background:#3b82f6;color:#fff;padding:10px 20px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Confirm Email</a>'
        "<p>This link expires in 1 hour.</p>"
        "</div>"
    )
    text_body = (
        "Hi there,\n\n"
        "You requested to change your email address. Click the link below to confirm.\n\n"
        f"{link}\n\n"
        "This link expires in 1 hour."
    )

    try:
        _get_ses_client().send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": text_body},
                },
            },
        )
    except ClientError:
        logger.error("SES send failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service unavailable")


def send_password_reset_email(to_email: str, token: str, frontend_url: str) -> None:
    sender = os.getenv("AWS_SES_SENDER_EMAIL")
    if not sender:
        raise RuntimeError("AWS_SES_SENDER_EMAIL is not set")

    link = f"{frontend_url}/reset-password?token={token}"
    subject = "Reset your PetrCollect password"
    html_body = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;text-align:center">'
        "<p>Hi there,</p>"
        "<p>Click the button below to reset your password. This link expires in 1 hour.</p>"
        f'<a href="{link}" style="background:#3b82f6;color:#fff;padding:10px 20px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Reset Password</a>'
        "</div>"
    )
    text_body = (
        "Hi there,\n\n"
        "Click the link below to reset your password. This link expires in 1 hour.\n\n"
        f"{link}"
    )

    try:
        _get_ses_client().send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": text_body},
                },
            },
        )
    except ClientError:
        logger.error("SES send failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service unavailable")


def send_change_email_intent_email(to_email: str, token: str, frontend_url: str) -> None:
    sender = os.getenv("AWS_SES_SENDER_EMAIL")
    if not sender:
        raise RuntimeError("AWS_SES_SENDER_EMAIL is not set")

    link = f"{frontend_url}/change-email?token={token}"
    subject = "Confirm your PetrCollect email change request"
    html_body = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;text-align:center">'
        "<p>Hi there,</p>"
        "<p>You requested to change your email address. Click below to continue."
        " This link expires in 15 minutes.</p>"
        f'<a href="{link}" style="background:#3b82f6;color:#fff;padding:10px 20px;'
        'border-radius:6px;text-decoration:none;display:inline-block">Change Email</a>'
        "</div>"
    )
    text_body = (
        "Hi there,\n\n"
        "You requested to change your email address. Click the link below to continue."
        " This link expires in 15 minutes.\n\n"
        f"{link}"
    )

    try:
        _get_ses_client().send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": text_body},
                },
            },
        )
    except ClientError:
        logger.error("SES send failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service unavailable")


def send_email_change_notification(to_email: str, new_email: str) -> None:
    sender = os.getenv("AWS_SES_SENDER_EMAIL")
    if not sender:
        raise RuntimeError("AWS_SES_SENDER_EMAIL is not set")

    subject = "Your PetrCollect email address is being changed"
    html_body = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">'
        "<p>Hi there,</p>"
        f"<p>A request was made to change your PetrCollect email to <strong>{new_email}</strong>."
        " If this was you, no action needed."
        " If this wasn't you, contact support immediately.</p>"
        "</div>"
    )
    text_body = (
        "Hi there,\n\n"
        f"A request was made to change your PetrCollect email to {new_email}."
        " If this was you, no action needed."
        " If this wasn't you, contact support immediately."
    )

    try:
        _get_ses_client().send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": text_body},
                },
            },
        )
    except ClientError:
        logger.error("SES send failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Email service unavailable")
