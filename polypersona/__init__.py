import os

import certifi
from dotenv import find_dotenv, load_dotenv

# Must run before pydantic_ai builds a Google provider. One key name avoids the SDK's duplicate-key warning.
load_dotenv(find_dotenv(usecwd=True))
if os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ.pop("GEMINI_API_KEY")
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

# python.org builds of Python on macOS ship without a CA bundle ("Install Certificates"
# not run), which breaks TLS to Modal's sandbox command router. Fall back to certifi.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
