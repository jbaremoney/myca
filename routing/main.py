# main.py
import os
import hashlib
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var is required")
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1536"))
ROUTER_API_KEY = os.environ.get("ROUTER_API_KEY", "dev-key")

app = FastAPI(title="Agent Registry + Router")

def require_key(x_api_key: str | None):
    if x_api_key != ROUTER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

def stub_embed(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """
    Deterministic placeholder embedding so you can build/test the system.
    Replace with Bedrock/OpenAI embeddings later.
    """
    h = hashlib.sha256(text.encode("utf-8")).digest()
    # Expand hash bytes into floats
    vals = []
    for i in range(dim):
        b = h[i % len(h)]
        vals.append((b / 255.0) * 2.0 - 1.0)  # [-1, 1]
    return vals

def to_pgvector_literal(v: List[float]) -> str:
    # pgvector accepts: '[1,2,3]'
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"

class AgentUpsert(BaseModel):
    agent_id: str
    name: Optional[str] = None
    mcp_url: str
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    modalities: Optional[List[str]] = []
    tools: Optional[Any] = None  # list or dict is fine for MVP

class RouteRequest(BaseModel):
    query: str
    modality: Optional[str] = None  # "image" / "text" etc.
    top_k: int = 3

@app.post("/agents")
def upsert_agent(payload: AgentUpsert, x_api_key: str | None = Header(default=None)):
    require_key(x_api_key)

    profile_text = " ".join([
        payload.agent_id,
        payload.name or "",
        payload.description or "",
        " ".join(payload.tags or []),
        " ".join(payload.modalities or []),
        str(payload.tools or "")
    ]).strip()

    emb = stub_embed(profile_text)
    emb_lit = to_pgvector_literal(emb)

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO agents (agent_id, name, mcp_url, description, tags, modalities, tools, embedding, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s, now())
                ON CONFLICT (agent_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    mcp_url = EXCLUDED.mcp_url,
                    description = EXCLUDED.description,
                    tags = EXCLUDED.tags,
                    modalities = EXCLUDED.modalities,
                    tools = EXCLUDED.tools,
                    embedding = EXCLUDED.embedding,
                    updated_at = now()
                """,
                (
                    payload.agent_id,
                    payload.name,
                    payload.mcp_url,
                    payload.description,
                    payload.tags,
                    payload.modalities,
                    Jsonb(payload.tools),
                    emb_lit,
                )
            )
            conn.commit()

    return {"ok": True, "agent_id": payload.agent_id}

@app.post("/route")
def route(req: RouteRequest, x_api_key: str | None = Header(default=None)):
    require_key(x_api_key)

    q_emb = stub_embed(req.query)
    q_lit = to_pgvector_literal(q_emb)

    modality_filter_sql = ""
    params = [q_lit, req.top_k]

    if req.modality:
        modality_filter_sql = "AND %s = ANY(modalities)"
        params.insert(1, req.modality)

    sql = f"""
        SELECT agent_id, name, mcp_url, description, tags, modalities,
               (embedding <-> %s) AS distance
        FROM agents
        WHERE is_active = true
        {modality_filter_sql}
        ORDER BY embedding <-> %s
        LIMIT %s
    """

    # Note: if modality filter used, q_lit appears twice; easiest is to build cleanly:
    if req.modality:
        sql = """
            SELECT agent_id, name, mcp_url, description, tags, modalities,
                   (embedding <-> %s) AS distance
            FROM agents
            WHERE is_active = true
              AND %s = ANY(modalities)
            ORDER BY embedding <-> %s
            LIMIT %s
        """
        params = [q_lit, req.modality, q_lit, req.top_k]
    else:
        sql = """
            SELECT agent_id, name, mcp_url, description, tags, modalities,
                   (embedding <-> %s) AS distance
            FROM agents
            WHERE is_active = true
            ORDER BY embedding <-> %s
            LIMIT %s
        """
        params = [q_lit, q_lit, req.top_k]

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor( row_factory=dict_row) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    # Convert distance into a friendly score (rough)
    candidates = []
    for r in rows:
        dist = float(r["distance"])
        candidates.append({
            "agent_id": r["agent_id"],
            "name": r["name"],
            "mcp_url": r["mcp_url"],
            "distance": dist,
            "score": 1.0 / (1.0 + dist),
            "tags": r["tags"],
            "modalities": r["modalities"],
        })

    return {"candidates": candidates}
