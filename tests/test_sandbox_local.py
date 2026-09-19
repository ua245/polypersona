"""Offline tests for the sandbox layer (no Modal calls)."""

import asyncio

import pytest

from polypersona.sandbox.paths import PathNotAllowed, resolve_workspace_path
from polypersona.sandbox.registry import SandboxRegistry


@pytest.mark.parametrize(
    "path,expected",
    [
        ("app/main.py", "/workspace/app/app/main.py"),
        ("./app/../app/db.py", "/workspace/app/app/db.py"),
        (".", "/workspace/app"),
    ],
)
def test_allowed_paths(path, expected):
    assert resolve_workspace_path(path) == expected


@pytest.mark.parametrize(
    "path",
    ["", "/etc/passwd", "..", "../x", "app/../../x", ".git/config", "data/shop.db", "a/\x00b"],
)
def test_rejected_paths(path):
    with pytest.raises(PathNotAllowed):
        resolve_workspace_path(path)


def test_registry_roundtrip(tmp_path):
    reg = SandboxRegistry(tmp_path / "active.json")

    async def go():
        await asyncio.gather(*(reg.add(f"sb-{i}", run_id="r", branch_id=str(i), role="repair") for i in range(5)))
        assert set(reg.load()) == {f"sb-{i}" for i in range(5)}
        await reg.remove("sb-2")
        await reg.remove("missing")

    asyncio.run(go())
    assert "sb-2" not in reg.load() and len(reg.load()) == 4
