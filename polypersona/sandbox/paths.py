"""Validation of agent-supplied paths. Everything must stay inside the app workspace."""

import posixpath

from .config import REMOTE_APP_DIR

# Path components the agent may never read or write.
FORBIDDEN_PARTS = {".git", "data", "__pycache__"}


class PathNotAllowed(ValueError):
    pass


def resolve_workspace_path(relative: str) -> str:
    """Map a workspace-relative path to an absolute sandbox path, rejecting escapes.

    The check is lexical. The baseline workspace has no symlinks and the file tools
    cannot create any, so a lexical check is enough for the tools we expose.
    """
    if not isinstance(relative, str) or not relative.strip():
        raise PathNotAllowed("path must be a non-empty string")
    if "\x00" in relative:
        raise PathNotAllowed("path contains a NUL byte")
    if relative.startswith("/"):
        raise PathNotAllowed("path must be relative to the app workspace")
    normalized = posixpath.normpath(relative)
    if normalized == ".." or normalized.startswith("../"):
        raise PathNotAllowed("path escapes the app workspace")
    parts = [] if normalized == "." else normalized.split("/")
    if FORBIDDEN_PARTS.intersection(parts):
        raise PathNotAllowed(f"path touches a protected location: {relative}")
    full = posixpath.join(REMOTE_APP_DIR, normalized) if parts else REMOTE_APP_DIR
    if full != REMOTE_APP_DIR and not full.startswith(REMOTE_APP_DIR + "/"):
        raise PathNotAllowed("path escapes the app workspace")
    return full
