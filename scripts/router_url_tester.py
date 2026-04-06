import json
import csv
import requests

ROUTER_URL = "https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/route"
API_KEY = "dev-key"

# Map agent IDs from your JSON to their expected MCP URLs
AGENT_URLS = {
    "breast-agent": "https://q4rimpht8w.us-east-1.awsapprunner.com/mcp",
    "pneum-agent": "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp",
    "derm-agent": "https://9iwzme8szu.us-east-1.awsapprunner.com/mcp",
    "path-agent": "https://iffzub9gc3.us-east-1.awsapprunner.com/mcp",
}

INPUT_FILE = "router_url_eval.json"
OUTPUT_FILE = "router_url_eval_results.csv"


def expected_url_from_test(test_item: dict) -> str:
    expected_agent = test_item.get("expected")
    if expected_agent is None:
        return ""
    return AGENT_URLS.get(expected_agent, "")


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        tests = json.load(f)

    rows = []

    for test in tests:
        prompt = test["prompt"]
        expected_url = expected_url_from_test(test)

        try:
            resp = requests.post(
                ROUTER_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY,
                },
                json={
                    "query": prompt,
                    "top_k": 3
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            returned_url = data.get("url", "")
            passed = returned_url == expected_url

            rows.append({
                "prompt": prompt,
                "type": test.get("type"),
                "expected_agent": test.get("expected"),
                "expected_url": expected_url,
                "returned_url": returned_url,
                "pass": passed,
            })

            print(f"[{'PASS' if passed else 'FAIL'}] {prompt}")
            print(f"  expected: {expected_url!r}")
            print(f"  returned: {returned_url!r}")

        except Exception as e:
            rows.append({
                "prompt": prompt,
                "type": test.get("type"),
                "expected_agent": test.get("expected"),
                "expected_url": expected_url,
                "returned_url": "",
                "pass": False,
                "error": str(e),
            })
            print(f"[ERROR] {prompt}")
            print(f"  error: {e}")

    fieldnames = [
        "prompt",
        "type",
        "expected_agent",
        "expected_url",
        "returned_url",
        "pass",
        "error",
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)
    passed = sum(1 for r in rows if r.get("pass") is True)
    failed = total - passed

    print("\nDone.")
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {failed}/{total}")
    print(f"Results written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()