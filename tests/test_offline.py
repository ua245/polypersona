"""Offline tests: no Gemini or Modal calls. The browser tests drive the bundled demo shop with Playwright."""

import asyncio

from pydantic_ai import BinaryContent
from pydantic_ai.messages import ModelRequest, UserPromptPart

from polypersona.browser import BrowserSession
from polypersona.metrics import backtracks, compute_metrics, dead_clicks
from polypersona.models import ExitSurvey, Observation, SessionReport, StepRecord
from polypersona.persona_agent import KEEP_SCREENSHOTS, _strip_old_screenshots
from polypersona.personas import DEFAULT_PERSONAS, demo_tasks
from polypersona.session import _serve_demo_site


def _report(variant: str, outcome: str, steps: list[StepRecord], ease: int = 4) -> SessionReport:
    survey = ExitSurvey(believes_completed=True, ease=ease, trust=3, would_return=True, summary="ok")
    obs = [Observation(step_idx=1, kind="friction", severity=4, text="slow")]
    return SessionReport(session_id=f"p-{variant}-0", persona=DEFAULT_PERSONAS[0], variant_id=variant, outcome=outcome, steps=steps, observations=obs, exit_survey=survey, input_tokens=100, output_tokens=10)


def _steps(*spec: tuple[str, str, bool]) -> list[StepRecord]:
    return [StepRecord(idx=i, action=a, url=u, changed=c) for i, (a, u, c) in enumerate(spec)]


def test_metrics_count_dead_clicks_backtracks_and_errors():
    good = _report("a", "completed", _steps(("open", "/", True), ("click", "/cart", True), ("click", "/done", True)), ease=5)
    messy = _report("b", "gave_up", _steps(("open", "/", True), ("click", "/", False), ("click", "/cart", True), ("go_back", "/", True), ("click", "/cart", True)), ease=2)
    crashed = SessionReport(session_id="x-b-0", persona=DEFAULT_PERSONAS[0], variant_id="b", outcome="error")
    assert dead_clicks(messy) == 1
    assert backtracks(messy) == 2  # the back button, then returning to /cart
    a, b = compute_metrics([good, messy, crashed])
    assert (a.completion_rate, a.mean_steps, a.mean_ease) == (1.0, 2, 5)
    assert (b.sessions, b.errors, b.completion_rate, b.dead_clicks) == (2, 1, 0.0, 1)
    assert b.input_tokens == 100


def test_history_keeps_only_recent_screenshots():
    img = BinaryContent(data=b"x", media_type="image/jpeg")
    messages = [ModelRequest(parts=[UserPromptPart(content=[f"screen {i}", img])]) for i in range(6)]
    trimmed = _strip_old_screenshots(messages)
    with_image = [any(isinstance(c, BinaryContent) for c in m.parts[0].content) for m in trimmed]
    assert with_image == [False] * (6 - KEEP_SCREENSHOTS) + [True] * KEEP_SCREENSHOTS
    assert "screen 0" in trimmed[0].parts[0].content  # text survives, only the image goes


def test_completion_check_describes_itself():
    task = demo_tasks(["a"])[0]
    assert "verified in code" in task.completion_check and "#/confirmed" in task.completion_check
    assert "self-reported" in task.model_copy(update={"success_url_contains": None, "success_text_contains": None}).completion_check


def test_browser_detects_change_names_targets_and_verifies_checkout():
    async def scenario():
        server, base = _serve_demo_site()
        task = demo_tasks(["a"])[0]
        try:
            async with BrowserSession("desktop") as b:
                await b.goto(f"{base}/a/")
                before = await b.fingerprint()
                note = await b.click(990, 990)  # empty corner of the page
                assert note == "clicked empty space"
                assert await b.fingerprint() == before, "a click on nothing must not count as a change"

                box = await b.page.locator("[data-add=yirgacheffe]").bounding_box()
                x, y = (box["x"] + box["width"] / 2) / b.width * 1000, (box["y"] + box["height"] / 2) / b.height * 1000
                note = await b.click(round(x), round(y))
                assert note == "clicked button: Add to cart"
                assert await b.fingerprint() != before
                assert await b.check_success(task) is False

                await b.page.evaluate("location.hash = '#/checkout'")
                for field, value in {"name": "Dev Patel", "street": "418 Maple Avenue", "city": "Columbus", "zip": "43215", "card": "4242 4242 4242 4242", "exp": "09/28", "cvc": "314"}.items():
                    await b.page.fill(f"#{field}", value)
                typed = await b.fingerprint()
                await b.page.fill("#cvc", "315")
                assert await b.fingerprint() != typed, "typing into a field is a visible change"
                await b.page.click("[data-act=place]")
                await b._settle()  # the shop renders on hashchange, one tick after the click
                assert await b.check_success(task) is True
                assert "Order confirmed" in await b.page_text()
                shot = await b.screenshot()
                assert shot[:2] == b"\xff\xd8"
            assert b.video and len(b.video) > 1000
        finally:
            server.shutdown()

    asyncio.run(scenario())


def test_variant_c_clears_cart_and_requires_email():
    async def scenario():
        server, base = _serve_demo_site()
        try:
            async with BrowserSession("mobile") as b:
                await b.goto(f"{base}/c/")
                await b.page.click("[data-buy=yirgacheffe]")
                assert b.url.endswith("#/checkout")
                for field, value in {"name": "Sofia Ramirez", "street": "418 Maple Avenue", "city": "Columbus", "zip": "43215", "card": "4242424242424242", "exp": "09/28", "cvc": "314"}.items():
                    await b.page.fill(f"#{field}", value)
                await b.page.click("[data-act=place]")
                assert "email" in (await b.page.inner_text("#err")).lower()
                await b.page.fill("#email", "sofia@example.com")
                await b.page.click("[data-act=place]")
                await b._settle()
                text = await b.page_text()
                assert "Order confirmed" in text and "subscription is active" in text and "0 items" in text
        finally:
            server.shutdown()

    asyncio.run(scenario())


def test_crm_rows_become_personas_without_a_model():
    from polypersona.population import persona_from_row, recognised

    row = {
        "name": "Olivia Bennett", "bio": "Is a consultant who values productivity and fast checkout.",
        "goals": "make confident purchases without needing support", "frustrations": "long checkout forms, unclear delivery dates, and pop-ups",
        "tech_savviness": "Very high", "patience_steps": "3", "viewport": "2560x1440",
        "reading_style": "Technical deep reader", "products_bought": "laptop stand, webcam", "address": "1 Willow Close, Manchester, UK",
    }
    assert recognised([row]) and not recognised([{"customer": "x", "ltv": "12"}])
    p = persona_from_row(row, 14, "crm.csv")
    assert (p.id, p.tech_savviness, p.device, p.reading_style, p.patience_steps) == ("olivia-bennett-14", "high", "desktop", "reads_everything", 19)
    assert p.frustrations == ["long checkout forms", "unclear delivery dates", "pop-ups"]
    assert p.viewport == "2560x1440" and p.source == "crm.csv row 14"
    assert p.details["You live in"] == "Manchester, UK" and "Willow" not in str(p.details)
    assert persona_from_row({**row, "viewport": "390x844"}, 2).device == "mobile"


def test_customer_viewport_is_clamped_for_the_browser():
    assert (BrowserSession("desktop", "2560x1440").width, BrowserSession("desktop", "2560x1440").height) == (1440, 900)
    assert BrowserSession("mobile", "390x844").width == 390
    assert BrowserSession("desktop", "nonsense").width == 1280


def test_site_alerts_are_kept_accepted_and_count_as_success():
    from polypersona.models import TestTask

    async def scenario():
        async with BrowserSession("desktop") as b:
            await b.page.set_content("<button onclick=\"alert('Account created! Please check your email.')\">Create Account</button>")
            await b.page.click("button")  # would hang forever if the dialog were not handled
            assert b.new_dialogs() == ["Account created! Please check your email."] and b.new_dialogs() == []
            task = TestTask(variant_id="b", url="x", goal="g", success_text_contains="Payment successful|Account created")
            assert await b.check_success(task) is True
            assert await b.check_success(task.model_copy(update={"success_text_contains": "Order confirmed"})) is False

    asyncio.run(scenario())
