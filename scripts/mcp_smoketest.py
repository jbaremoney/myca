import base64
import json
import sys
import uuid
from pathlib import Path

import httpx


#CHANGE THESE TO TEST OTHER AGENTS
# MCP_URL = "https://q4rimpht8w.us-east-1.awsapprunner.com/mcp" #breast
# HEALTH_URL = "https://q4rimpht8w.us-east-1.awsapprunner.com/healthz" #breast

# MCP_URL = "https://9iwzme8szu.us-east-1.awsapprunner.com/mcp" #derm
# HEALTH_URL = "https://9iwzme8szu.us-east-1.awsapprunner.com/healthz" #derm

# MCP_URL = "https://iffzub9gc3.us-east-1.awsapprunner.com/mcp" #path
# HEALTH_URL = "https://iffzub9gc3.us-east-1.awsapprunner.com/healthz" #path

MCP_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp" #path
HEALTH_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/healthz" #path


def sse_read_first_json(stream: httpx.Response, timeout_lines: int = 200) -> dict:
    """
    Read SSE lines until we collect one full JSON object from a `data:` frame.
    Returns parsed JSON dict.
    """
    data_buf = ""
    lines_seen = 0

    for line in stream.iter_lines():
        lines_seen += 1
        if lines_seen > timeout_lines:
            raise RuntimeError("Timed out waiting for SSE data frame")

        if not line:
            # blank line separates SSE events
            continue

        # SSE frames look like: "event: message" or "data: {...}"
        if line.startswith("data:"):
            chunk = line[len("data:"):].strip()
            # Some servers may split JSON across multiple data lines, so buffer.
            data_buf += chunk

            # Try parse whenever we append
            try:
                return json.loads(data_buf)
            except json.JSONDecodeError:
                # keep buffering
                continue

    raise RuntimeError("SSE stream ended before any JSON was received")


def initialize_and_get_session(client: httpx.Client) -> tuple[str, dict]:
    """
    POST initialize (no session id) and capture mcp-session-id from response headers.
    """
    init_payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mcp-smoketest", "version": "0.0.1"},
        },
    }

    headers = {
        "Accept": "text/event-stream, application/json",
        "Content-Type": "application/json",
        "mcp-protocol-version": "2024-11-05",
    }

    with client.stream("POST", MCP_URL, headers=headers, json=init_payload) as r:
        # Don't r.raise_for_status() until after we print useful info if it fails
        if r.status_code >= 400:
            body_preview = ""
            try:
                body_preview = r.read().decode("utf-8", errors="replace")[:500]
            except Exception:
                pass
            raise RuntimeError(
                f"Initialize failed: {r.status_code}\nHeaders: {dict(r.headers)}\nBody preview: {body_preview}"
            )

        sid = r.headers.get("mcp-session-id")
        first_msg = sse_read_first_json(r)

    if not sid:
        raise RuntimeError(f"Initialize succeeded but no mcp-session-id header. Headers: {sid}")

    return sid, first_msg



def rpc_call_sse(client: httpx.Client, session_id: str, payload: dict) -> dict:
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "mcp-session-id": session_id,
        "mcp-protocol-version": "2024-11-05",
    }
    with client.stream("POST", MCP_URL, headers=headers, json=payload) as r:
        if r.status_code >= 400:
            # read a small preview safely
            preview = ""
            try:
                preview = r.read().decode("utf-8", errors="replace")[:800]
            except Exception:
                pass
            raise RuntimeError(
                f"RPC failed: {r.status_code}\n"
                f"Response headers: {dict(r.headers)}\n"
                f"Body preview: {preview}\n"
                f"Sent headers: {headers}\n"
                f"Payload: {json.dumps(payload)}"
            )
        return sse_read_first_json(r)



def main():
    print("== MCP Smoke Test ==")
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        # 1) health check (optional)
        try:
            hr = client.get(HEALTH_URL)
            print("Health:", hr.status_code, hr.text.strip())
        except Exception as e:
            print("Health check skipped/failed:", e)

        # 2) open session
        session_id, init_resp = initialize_and_get_session(client)
        print("Session ID:", session_id)
        print("Initialize response:")
        print(json.dumps(init_resp, indent=2))
        print("Initialize response:")
        print(json.dumps(init_resp, indent=2))

        # 4) tools/list
        tools_list_payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/list",
        }
        tools_resp = rpc_call_sse(client, session_id, tools_list_payload)
        print("Tools/list response:")
        print(json.dumps(tools_resp, indent=2))

        # 5) tools/call classify with image base64 (only if you provide an image path)
        if len(sys.argv) >= 2:
            img_path = Path(sys.argv[1])
            b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")

            call_payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": "tools/call",
                "params": {
                    "name": "classify",
                    "arguments": {"img": b64},
                },
            }
            call_resp = rpc_call_sse(client, session_id, call_payload)
            print("Tools/call classify response:")
            print(json.dumps(call_resp, indent=2))
        else:
            print("\n(No image provided; run `python mcp_smoketest.py path/to/test.png` to call classify)")

    print("== Done ==")


if __name__ == "__main__":
    main()