from .models import Persona, TestTask

PERSONAS = [
    Persona(
        id="margaret",
        name="Margaret",
        bio="67, retired schoolteacher. Uses her laptop for email and the odd online order; "
        "her grandson usually helps with anything tricky.",
        goals=["Book tickets without making a mistake", "Know exactly what she will pay"],
        frustrations=["Small grey text", "Error messages that don't say what's wrong", "Hidden fees"],
        tech_savviness="low",
        patience_steps=30,
        viewport="desktop",
        reading_style="reads everything",
    ),
    Persona(
        id="dev",
        name="Dev",
        bio="29, product designer, books everything on his phone between meetings.",
        goals=["Get it done in under a minute"],
        frustrations=["Unnecessary form fields", "Anything that feels slow or clunky on mobile"],
        tech_savviness="high",
        patience_steps=18,
        viewport="mobile",
        reading_style="skims",
    ),
    Persona(
        id="aisha",
        name="Aisha",
        bio="41, nurse and parent of two, shopping on the family laptop after a night shift.",
        goals=["Sort the tickets quickly and move on", "Not get charged twice"],
        frustrations=["Promo code boxes that make her feel she's overpaying", "Forms that wipe her input"],
        tech_savviness="medium",
        patience_steps=24,
        viewport="desktop",
        reading_style="skims",
    ),
]

TASKS = {
    "jazz-2": TestTask(
        id="jazz-2",
        goal="Buy 2 tickets to Jazz Night for you and a friend. "
        "Use your own name and the email address you normally use.",
        success_event_id="jazz-night",
        success_quantity=2,
    ),
}
