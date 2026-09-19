import os

import certifi

# python.org builds of Python on macOS ship without a CA bundle ("Install Certificates"
# not run), which breaks TLS to Modal's sandbox command router. Fall back to certifi.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
