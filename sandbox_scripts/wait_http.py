"""Poll a URL inside the sandbox until it answers 200 or the deadline passes."""

import sys
import time
import urllib.request

url = sys.argv[1]
deadline = time.monotonic() + float(sys.argv[2] if len(sys.argv) > 2 else 30)
last_error = ""
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            if resp.status == 200:
                print("ready")
                sys.exit(0)
    except Exception as exc:  # noqa: BLE001 - report the last failure only
        last_error = repr(exc)
    time.sleep(0.25)
print(f"timeout waiting for {url}: {last_error}", file=sys.stderr)
sys.exit(1)
