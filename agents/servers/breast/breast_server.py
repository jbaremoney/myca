# breast_mcp/server.py
from typing import List, Dict
import torch

from mcp.server.fastmcp import FastMCP

from agents.servers.agent_tools import load_model, preprocess_base64_image, infer

# ---- CONFIG FOR THIS AGENT ONLY ----
DATA_FLAG = "breastmnist"
CHECKPOINT_PATH = "breastmnist_mlp.pth"
N_CHANNELS = 1
N_CLASSES = 2
HIDDEN = [10, 10]           # match how you trained
IN_DIM = N_CHANNELS * 28 * 28

LABELS: List[str] = ["benign", "malignant"]  # adjust if needed

# Initialize MCP server
mcp = FastMCP("breast-mnist-agent") #server name

# Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load model once at startup
model = load_model(
    checkpoint_path=CHECKPOINT_PATH,
    in_dim=IN_DIM,
    hidden=HIDDEN,
    out_dim=N_CLASSES,
    device=device,
)

@mcp.tool()
async def classify_breast_image(image_b64: str) -> Dict:
    """
    Classify a breast imaging sample (MedMNIST BreastMNIST format) as benign vs malignant.

    Args:
        image_b64: Image encoded as a base64 string. The image will be resized to 28x28
                   and converted to grayscale to match BreastMNIST pre-processing.

    Returns:
        dict with predicted label, probabilities per class, and a safety disclaimer.
    """
    #preprocess
    x = preprocess_base64_image(image_b64, n_channels=N_CHANNELS, device=device)  # (1, C, 28, 28)

    # Inference
    probs = infer(model, x)  # (N_CLASSES,)

    # Convert to Python types
    probs_list = probs.cpu().tolist()
    class_index = int(torch.argmax(probs).item())
    predicted_label = LABELS[class_index]

    probs_dict = {LABELS[i]: float(p) for i, p in enumerate(probs_list)}

    return {
        "dataset": DATA_FLAG,
        "agent_name": "breast-mnist-agent",
        "predicted_label": predicted_label,
        "class_index": class_index,
        "probabilities": probs_dict,
        "disclaimer": (
            "Experimental model trained on MedMNIST BreastMNIST; "
            "for research and educational use only. Not for clinical diagnosis."
        ),
    }


def main():
    # Start MCP over stdio
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
