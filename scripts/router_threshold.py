import csv
import json
import requests

ROUTER_URL = "https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/route"
API_KEY = "dev-key"

with open("router_eval.json", "r") as f:
    tests = json.load(f)

rows = []

for t in tests:
    resp = requests.post(
        ROUTER_URL,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        json={
            "query": t["prompt"],
            "top_k": 3
        },
        timeout=30
    )
    resp.raise_for_status()
    data = resp.json()

    candidates = data.get("candidates", [])
    top1 = candidates[0] if len(candidates) > 0 else None
    top2 = candidates[1] if len(candidates) > 1 else None

    top_agent = top1["agent_id"] if top1 else None
    top_score = top1["score"] if top1 else None
    second_score = top2["score"] if top2 else None
    margin = (top_score - second_score) if top_score is not None and second_score is not None else None

    correct = None
    if t["expected"] is None:
        correct = None
    else:
        correct = (top_agent == t["expected"])

    rows.append({
        "prompt": t["prompt"],
        "type": t["type"],
        "expected": t["expected"],
        "top_agent": top_agent,
        "top_score": top_score,
        "second_score": second_score,
        "margin": margin,
        "correct": correct,
    })

with open("router_eval_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print("Wrote router_eval_results.csv")