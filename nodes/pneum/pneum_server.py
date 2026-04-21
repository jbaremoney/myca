
from fastmcp import FastMCP
from nodes.models.mnist_classifiers import PneumClassifier

from starlette.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware


mcp = FastMCP("pneum")

# Load model once at startup (fast per request)
_classifier = PneumClassifier()

@mcp.tool()
def classify(img: str) -> dict:
    """Classify a base64-encoded PneumoniaMNIST image."""
    return _classifier.classify_image(img)

# Simple health endpoint for curl / App Runner checks
@mcp.custom_route("/healthz", methods=["GET"])
async def healthz(request):
    return JSONResponse({"ok": True})

# MCP Inspector runs in a browser -> needs CORS + MCP headers
middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=[
            "content-type",
            "authorization",
            "mcp-protocol-version",
            "mcp-session-id",
        ],
        expose_headers=["mcp-session-id"],
    )
]

# Create an ASGI app that serves MCP at /mcp
app = mcp.http_app(path="/mcp", middleware=middleware)
