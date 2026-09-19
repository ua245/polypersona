import logging

import uvicorn
from dotenv import load_dotenv

load_dotenv()

import polypersona  # noqa: E402,F401 - applies the TLS fix before Modal is used

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
uvicorn.run("polypersona.web.server:app", host="127.0.0.1", port=8765, log_level="warning")
