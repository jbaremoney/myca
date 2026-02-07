import os, json
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

BEDROCK_REGION = os.environ.get("AWS_REGION", "us-east-1")
MODEL_ID = os.environ.get("TITAN_EMBED_MODEL_ID", "amazon.titan-embed-text-v1")

br = boto3.client(
    "bedrock-runtime",
    region_name=BEDROCK_REGION,
    config=Config(retries={"max_attempts": 3, "mode": "standard"}, read_timeout=10, connect_timeout=5),
)

def titan_embed(text: str):
    body = json.dumps({"inputText": text})
    resp = br.invoke_model(
        modelId=MODEL_ID,
        body=body,
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(resp["body"].read())
    return payload["embedding"]

if __name__ == "__main__":
    v = titan_embed("hello world from local test")
    print("len:", len(v))
    print("first 5:", v[:5])
