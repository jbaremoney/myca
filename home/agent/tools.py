from langchain_core.tools import tool
from nodes.models.communication import NodeInputSchema
from home.agent.models import MycaCall, MycaResponse, NodeCandidate, NodeChoice
import requests
from langchain_openai import ChatOpenAI

@tool(parse_docstring=True)
def call_myca(task_description: str):
    """
    Call to the network of agents when a specialized task is requested of you such as image classification

    Args:
        task_description (str): Detailed description of the task, used to search over available agents on myca
    Returns:
        input_schema (List[NodeInputSchema]): Schema required for the usage of this agent

    """
    # url hosting cloud function to search over db
    MYCA_URL = "https://www."

    payload = MycaCall(description=task_description)

    #dict, key "candidates" maps to list of dicts
    res = dict(requests.get(MYCA_URL, params=dict(payload)))
    cand_list = [NodeCandidate(input_schema=i["input_schema"], output_schema=i["output_schema"]) for i in res["candidates"]]

    n_cands = len(cand_list)
    # use this to choose a candidate
    myca_resp = MycaResponse(candidates=cand_list)

    chooser = ChatOpenAI(model="gpt-4o").with_structured_output(NodeChoice(n=n_cands))



    pass

