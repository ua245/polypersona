"""Before/after evidence for a Gateway rule: how many planted flaws did the personas report?

The demo shop plants known flaws in variants b and c (see site/shop.js). This reads a finished
run and counts, per flaw, the sessions whose negative observations mention it. Matching is by
keyword, so treat it as an approximate but reproducible measure, and read the quotes it prints.

    uv run python scripts/flaw_recall.py runs/<before> runs/<after>
"""

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
        quoted = [o for o in obs if re.search(r"['\"“‘].{3,}['\"”’]", o["text"])]
        out["variants"][variant] = {
            "sessions": len(rs),
            "flaws_found": sum(1 for h in found.values() if h),
            "flaws_total": len(flaws),
            "detections": found,
            "observations": len(obs),
            "negative_observations": sum(o["kind"] in NEGATIVE for o in obs),
            "delight_observations": sum(o["kind"] == "delight" for o in obs),
            "share_quoting_screen_text": round(len(quoted) / len(obs), 2) if obs else None,
            "mean_output_tokens": round(mean(r.get("output_tokens", 0) for r in rs)),
            "mean_actions": round(mean(len(r["steps"]) - 1 for r in rs), 1),
        }
    return out


def show(s: dict) -> None:
    print(f"\n== {s['run']} ({s['sessions']} sessions)")
    for v, d in s["variants"].items():
        print(f"variant {v}: {d['flaws_found']}/{d['flaws_total']} planted flaws reported · "
              f"{d['negative_observations']} negative / {d['delight_observations']} delight observations · "
              f"{d['share_quoting_screen_text']} quote screen text · {d['mean_output_tokens']} output tokens/session · "
              f"{d['mean_actions']} actions/session")
        for flaw, hits in d["detections"].items():
            print(f"  [{'x' if hits else ' '}] {flaw}" + (f"  e.g. {hits[0]}" if hits else ""))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        show(summarise(Path(arg)))
