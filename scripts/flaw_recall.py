"""Before/after evidence for a Gateway rule: planted-flaw recall, evidence quality and output cost.

The demo shop plants known flaws in variants b and c (see site/shop.js). This reads a finished
run and counts, per flaw, the sessions whose negative observations mention it. Matching is by
keyword, so treat it as an approximate but reproducible measure, and read the quotes it prints.

    uv run python scripts/flaw_recall.py runs/<before> runs/<after>
"""

import html
import json
import re
import sys
from pathlib import Path
from statistics import mean

KNOWN_FLAWS = {
    "b": {
        "newsletter popup on arrival": r"pop-?up|newsletter|10% off|overlay|modal",
        "confirmshaming dismiss link": r"full price|guilt|sham|rude|manipulat|passive.aggressive",
        "forced account creation": r"account|password|sign.?up|register",
        "cryptic 'Error 422' on phone": r"422|error code|cryptic",
        "late handling fee": r"handling|packaging|\bfee|surprise|extra (charge|cost)",
        "faded Continue / loud Cancel buttons": r"grey|gray|faded|disabled|low.contrast|cancel order|looks? (inactive|disabled)",
    },
    "c": {
        "pre-ticked subscription": r"subscri|pre-?(ticked|checked|selected)|every 4 weeks|recurring",
    },
}
NEGATIVE = {"bug", "friction", "confusion", "opinion"}
SITE = Path(__file__).resolve().parent.parent / "site"
QUOTE = r"[\"“'‘]([^\"”’]{2,80}?)[\"”'’]"


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text)).strip().lower()


# All copy the demo shop can show, so quotes can be checked against the real UI rather than trusted.
UI_TEXT = _norm(" ".join(p.read_text() for p in [*SITE.glob("*.js"), *SITE.glob("*/index.html")]))


def grounded(quote: str) -> bool:
    return _norm(quote) in UI_TEXT


def load(run_dir: Path) -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted(run_dir.glob("sessions/*/report.json"))]


def summarise(run_dir: Path) -> dict:
    reports = load(run_dir)
    out = {"run": str(run_dir), "sessions": len(reports), "variants": {}}
    for variant, flaws in KNOWN_FLAWS.items():
        rs = [r for r in reports if r["variant_id"] == variant]
        if not rs:
            continue
        found = {}
        for flaw, pattern in flaws.items():
            hits = []
            for r in rs:
                for o in r["observations"]:
                    if o["kind"] in NEGATIVE and re.search(pattern, o["text"], re.I):
                        hits.append(f'{r["session_id"]}#{o["step_idx"]}: {o["text"][:110]}')
                        break
            found[flaw] = hits
        obs = [o for r in rs for o in r["observations"]]
        quoted = [o for o in obs if re.search(QUOTE, o["text"])]
        leading = [o for o in obs if re.match(r"\s*" + QUOTE, o["text"])]
        quotes = [q for o in obs for q in re.findall(QUOTE, o["text"])]
        reasoning = [len(st["reasoning"].split()) for r in rs for st in r["steps"][1:] if st.get("reasoning")]
        actions = sum(len(r["steps"]) - 1 for r in rs)
        out["variants"][variant] = {
            "sessions": len(rs),
            "flaws_found": sum(1 for h in found.values() if h),
            "flaws_total": len(flaws),
            "detections": found,
            "observations": len(obs),
            "negative_observations": sum(o["kind"] in NEGATIVE for o in obs),
            "delight_observations": sum(o["kind"] == "delight" for o in obs),
            "share_quoting_screen_text": round(len(quoted) / len(obs), 2) if obs else None,
            "share_leading_with_quote": round(len(leading) / len(obs), 2) if obs else None,
            "quotes_grounded_in_ui": f"{sum(map(grounded, quotes))}/{len(quotes)}",
            "mean_reasoning_words": round(mean(reasoning), 1) if reasoning else None,
            "output_tokens_per_action": round(sum(r.get("output_tokens", 0) for r in rs) / actions) if actions else None,
            "mean_output_tokens": round(mean(r.get("output_tokens", 0) for r in rs)),
            "mean_actions": round(mean(len(r["steps"]) - 1 for r in rs), 1),
        }
    return out


def show(s: dict) -> None:
    print(f"\n== {s['run']} ({s['sessions']} sessions)")
    for v, d in s["variants"].items():
        print(f"variant {v}: {d['flaws_found']}/{d['flaws_total']} planted flaws reported · "
              f"{d['negative_observations']} negative / {d['delight_observations']} delight observations · "
              f"{d['mean_actions']} actions/session")
        print(f"  evidence: {d['share_quoting_screen_text']} quote screen text · {d['share_leading_with_quote']} lead with the quoted element · "
              f"{d['quotes_grounded_in_ui']} quotes found verbatim in the UI")
        print(f"  cost: {d['mean_output_tokens']} output tokens/session · {d['output_tokens_per_action']} per action · "
              f"{d['mean_reasoning_words']} words of reasoning per action")
        for flaw, hits in d["detections"].items():
            print(f"  [{'x' if hits else ' '}] {flaw}" + (f"  e.g. {hits[0]}" if hits else ""))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        show(summarise(Path(arg)))
