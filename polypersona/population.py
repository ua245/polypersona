"""Turn rows of customer data (a CRM export) into personas.

Columns that match the persona model are mapped in code, so a row becomes the same persona every time
and costs nothing. Anything else is handed to Gemini to personify, grounded in the row.
"""

from __future__ import annotations

import re

from pydantic_ai import Agent

from .models import Persona
from .persona_agent import PERSONA_MODEL, make_model

MAX_ROWS = 10
RECOGNISED = {"name", "bio"}  # the minimum for the deterministic path
SAVVINESS = {"low": "low", "medium": "medium", "med": "medium", "high": "high", "very high": "high", "very low": "low"}
THOROUGH = re.compile(r"deep|detail|thorough|careful|every|reads reviews|specification", re.I)


def _split(value: str) -> list[str]:
    parts = [p.strip(" .") for p in re.split(r";|,\s*(?:and\s+)?|\s+and\s+", value or "") if p.strip(" .")]
    return parts or ([value.strip()] if value and value.strip() else [])


def _patience(raw: str) -> int:
    """CRM patience is a small score (about 1-10). An agent needs an action budget: 8 to 40."""
    try:
        score = float(raw)
    except (TypeError, ValueError):
        return 20
    return int(max(10, min(40, round(10 + score * 3)))) if score <= 10 else int(max(8, min(40, score)))


def _slug(name: str, row: int) -> str:
    return f"{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'customer'}-{row}"


def recognised(rows: list[dict]) -> bool:
    return bool(rows) and RECOGNISED <= {k.strip().lower() for k in rows[0]}


def persona_from_row(row: dict, row_number: int, filename: str = "upload") -> Persona:
    r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}
    viewport = r.get("viewport") if re.fullmatch(r"\d{3,4}\s*x\s*\d{3,4}", r.get("viewport", ""), re.I) else None
    width = int(viewport.lower().split("x")[0]) if viewport else 1280
    reading = r.get("reading_style", "")
    details = {}
    if r.get("products_bought"):
        details["You have bought before"] = r["products_bought"]
    if r.get("address"):
        details["You live in"] = ", ".join(part.strip() for part in r["address"].split(",")[-2:])  # city and country, not the street
    if reading:
        details["How you read a page"] = reading
    return Persona(
        id=_slug(r.get("name", ""), row_number),
        name=r.get("name") or f"Customer {row_number}",
        bio=r.get("bio") or "A customer from the uploaded data.",
        goals=_split(r.get("goals", "")) or ["complete the task without fuss"],
        frustrations=_split(r.get("frustrations", "")) or ["anything that wastes time"],
        tech_savviness=SAVVINESS.get(r.get("tech_savviness", "").lower(), "medium"),
        patience_steps=_patience(r.get("patience_steps", "")),
        device="mobile" if width < 600 else "desktop",
        reading_style="reads_everything" if THOROUGH.search(reading) else "skims",
        viewport=viewport.replace(" ", "").lower() if viewport else None,
        details=details,
        source=f"{filename} row {row_number}",
    )


async def personify(rows: list[dict], row_numbers: list[int], filename: str) -> list[Persona]:
    """Unknown columns: let the model read each row and write the persona it implies."""
    agent = Agent(
        make_model(PERSONA_MODEL),
        output_type=list[Persona],
        instructions=(
            "You turn rows of customer data into usability-testing personas, one persona per row, in the same order. "
            "Ground every field in the row; where the row is silent, choose something plausible and ordinary. "
            "ids are short lowercase slugs. patience_steps is 10 to 40 browser actions. Do not invent dramatic backstories."
        ),
    )
    listing = "\n".join(f"Row {n}: {row}" for n, row in zip(row_numbers, rows))
    result = await agent.run(f"Create exactly {len(rows)} personas from these rows.\n{listing}")
    personas = result.output[: len(rows)]
    for persona, n in zip(personas, row_numbers):
        persona.id = _slug(persona.name, n)
        persona.source = f"{filename} row {n}"
    return personas


async def personas_from_rows(rows: list[dict], row_numbers: list[int] | None = None, filename: str = "upload") -> tuple[list[Persona], str]:
    rows = rows[:MAX_ROWS]
    numbers = (row_numbers or list(range(1, len(rows) + 1)))[: len(rows)]
    if recognised(rows):
        return [persona_from_row(row, n, filename) for row, n in zip(rows, numbers)], "mapped"
    return await personify(rows, numbers, filename), "personified"
