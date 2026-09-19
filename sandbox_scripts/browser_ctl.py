"""Send one action to the in-sandbox browser server and print its JSON reply.

Usage: python browser_ctl.py <port> '<json action>'
"""

import json
import sys
import urllib.request

port, action = sys.argv[1], sys.argv[2]
json.loads(action)  # validate before sending
req = urllib.request.Request(
    f"http://127.0.0.1:{port}/", data=action.encode(), headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print(resp.read().decode())
except urllib.error.HTTPError as exc:
    print(exc.read().decode())
    sys.exit(1)
