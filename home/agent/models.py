from pydantic import BaseModel, Field
from typing import List, Optional
from nodes.models.communication import NodeInputSchema, NodeOutputSchema

class MycaCall(BaseModel):
    description: str

class NodeCandidate(BaseModel):
    input_schema: NodeInputSchema
    output_schema: NodeOutputSchema
    ratings: Optional[str]
    fee: Optional[float]
    time: Optional[str]


class MycaResponse(BaseModel):
    candidates: List[NodeCandidate]

# TODO: Find cool way to enforce 0<choice<len(cands)
class NodeChoice(BaseModel):
    choice: int = Field(description="Integer corresponding to the choice made")
    reasoning: str = Field(description="Reasoning for making the choice")

