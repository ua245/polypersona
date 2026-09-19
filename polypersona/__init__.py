import os

from dotenv import find_dotenv, load_dotenv

# Must run before pydantic_ai builds a Google provider. One key name avoids the SDK's duplicate-key warning.
load_dotenv(find_dotenv(usecwd=True))
if os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ.pop("GEMINI_API_KEY")
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")
