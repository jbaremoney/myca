## Server URLs for now
breast_server: https://ijonakqqsvrwzwhxe3vgvrnd6i0mojny.lambda-url.us-east-1.on.aws/


## Myca Registry Postgres Command Line Code.
Type this into your command line to start working within the postgres for the registry
```bash
psql "host=myca-registry.c850yomua7mm.us-east-1.rds.amazonaws.com port=5432 dbname=postgres user=myca password=seniorproj sslmode=require"
```

## Testing Router --> Registry connection
This assumes the registry is being hosted with the correct schema and router is ran locally for testing. 
Step 1: Ensure these env variables are set in your code. 
```bash
DATABASE_URL=postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/DBNAME?sslmode=require
ROUTER_API_KEY=dev-key
EMBEDDING_DIM=1536
```

Step 2: Run the local router. Run this command within the /routing folder.
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Step 3: Add an agent to the registry. In this example, I'm using powershell and added the breast agent, and this command worked.
```bash
$headers = @{
  "Content-Type" = "application/json"
  "x-api-key"    = "dev-key"
}

$body = @{
  agent_id    = "breast-v1"
  name        = "Breast Agent"
  mcp_url     = "https://YOUR-AGENT-URL/mcp"
  description = "Breast imaging classifier agent"
  tags        = @("medical","imaging","breast")
  modalities  = @("image")
  tools       = @(
    @{
      name = "classify"
      description = "Classify a breast image"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/agents" `
  -Method POST `
  -Headers $headers `
  -Body $body
```
This should return something like this:
```bash
{
  "ok": true,
  "agent_id": "breast-v1"
}
```

Step 4: Submit a /route query. This actually runs through the route path, then hits the registry, which returns a response of agents. This is done in powershell again.
```bash
$headers = @{
  "Content-Type" = "application/json"
  "x-api-key"    = "dev-key"
}

$body = @{
  query    = "classify a breast ultrasound image"
  modality = "image"
  top_k    = 3
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/route" `
  -Method POST `
  -Headers $headers `
  -Body $body
```
In theory, it should respond like this 
```bash
{
  "candidates": [
    {
      "agent_id": "breast-v1",
      "name": "Breast Agent",
      "mcp_url": "https://YOUR-AGENT-URL/mcp",
      "distance": 12.34,
      "score": 0.07,
      "modalities": ["image"],
      "tags": ["medical","imaging","breast"]
    }
  ]
}
```

## MCP Testing Client
Testing a hosted MCP Server isn't as simple as a regular node endpoint. There is a whole handshake and initialization process that must occur.
Because of this, I created a mcp_smoketest.py file in scripts. If you input the url of the agent you want to test at the top, then run it, it should in theory work. 

