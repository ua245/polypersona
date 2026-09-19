from __future__ import annotations

import os

from pydantic_ai import Agent

from .models import Persona, TestTask
from .persona_agent import make_model

DEFAULT_PERSONAS = [
    Persona(
        id="margaret",
        name="Margaret Ellis",
        bio="68, retired school librarian in Ohio. Orders gifts online a few times a year, usually with her daughter on the phone walking her through it.",
        goals=["Buy a nice coffee as a birthday gift for her son", "Be sure she is not being charged extra"],
        frustrations=["Pop-ups", "Being made to create accounts and passwords", "Error messages she cannot understand"],
        tech_savviness="low",
        patience_steps=22,
        device="desktop",
        reading_style="reads_everything",
    ),
    Persona(
        id="dev",
        name="Dev Patel",
        bio="29, product designer at a fintech startup in Austin. Buys specialty coffee monthly and has strong opinions about checkout flows.",
        goals=["Reorder coffee in under two minutes", "Check out as a guest"],
        frustrations=["Dark patterns", "Hidden fees at the last step", "Forms that reject valid input"],
        tech_savviness="high",
        patience_steps=28,
        device="desktop",
        reading_style="skims",
    ),
    Persona(
        id="sofia",
        name="Sofia Ramirez",
        bio="41, ER nurse and mother of two in Phoenix. Shops on her phone during short breaks and abandons anything that takes more than a few minutes.",
        goals=["Get coffee ordered before her break ends"],
        frustrations=["Tiny tap targets", "Long multi-page forms on a phone", "Anything that makes her start over"],
        tech_savviness="medium",
        patience_steps=20,
        device="mobile",
        reading_style="skims",
    ),
]

DEMO_FIXTURES = {
    "full name": "use your own name",
    "street address": "418 Maple Avenue",
    "city": "Columbus",
    "ZIP code": "43215",
    "phone": "(614) 555-0142",
    "email": "use firstname.lastname@example.com",
    "card number": "4242 4242 4242 4242",
    "card expiry": "09/28",
    "card CVC": "314",
}


def demo_tasks(variants: list[str] | tuple[str, ...] = ("a", "b")) -> list[TestTask]:
    return [
        TestTask(
            variant_id=v,
            url=f"demo://{v}",
            goal="Buy one 250g bag of Ethiopia Yirgacheffe coffee and have it shipped to your home.",
            fixtures=DEMO_FIXTURES,
            success_url_contains="#/confirmed",
            success_text_contains="Order confirmed",
        )
        for v in variants
    ]


async def generate_personas(audience: str, n: int) -> list[Persona]:
    """Invent n contrasting personas for a described audience."""
    agent = Agent(
        make_model(os.environ.get("PERSONA_MODEL", "gemini-3.8-flash")),
        output_type=list[Persona],
        instructions=(
            "You design user research panels. Create realistic, specific personas for usability testing. "
            "Force contrast across the panel: mix low, medium and high tech_savviness, both devices, both reading styles, "
            "and patience_steps from 12 to 35. ids are short lowercase slugs."
        ),
    )
    result = await agent.run(f"Audience: {audience}\nCreate exactly {n} personas.")
    return result.output[:n]
