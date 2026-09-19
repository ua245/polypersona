"""Terminate leftover sandboxes after an interrupted run.

    uv run python -m polypersona.sandbox.cleanup           # registry only
    uv run python -m polypersona.sandbox.cleanup --tagged  # also any sandbox tagged project=polypersona
"""

import argparse
import asyncio

from .manager import cleanup_registered, cleanup_tagged


async def main(tagged: bool) -> None:
    ids = await cleanup_registered()
    print(f"registry: terminated {len(ids)} sandbox(es) {ids}")
    if tagged:
        ids = await cleanup_tagged()
        print(f"tagged: terminated {len(ids)} sandbox(es) {ids}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tagged", action="store_true")
    asyncio.run(main(parser.parse_args().tagged))
