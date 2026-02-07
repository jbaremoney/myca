import asyncio
import base64
from pathlib import Path

import os
import sys

# Absolute path to this file (test_breast.py)
THIS_FILE = os.path.abspath(__file__)
# Directory containing this file: ...\myca\scripts
SCRIPTS_DIR = os.path.dirname(THIS_FILE)
# Project root: one level up from scripts -> ...\myca
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)

# Add project root to sys.path if it's not already there
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from nodes.breast.breast_server import classify_breast_image


def image_file_to_base64(path: str) -> str:
    """Read a local image file and return base64-encoded string."""
    p = Path(path)
    with p.open("rb") as f:
        img_bytes = f.read()
    return base64.b64encode(img_bytes).decode("utf-8")


async def main():
    # 1) Pick any test image.
    # Ideally: a BreastMNIST-like image (28x28 grayscale), but anything will at least exercise the pipeline.
    image_path = "test_breast.png"  # <-- put a real path here

    # 2) Convert to base64
    image_b64 = image_file_to_base64(image_path)

    # 3) Call the tool directly (bypassing MCP)
    result = await classify_breast_image(image_b64=image_b64)

    # 4) Print the output
    print("Agent response:")
    for k, v in result.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())
