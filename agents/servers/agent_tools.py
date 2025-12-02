# agent_tools.py
import torch
from torchvision import transforms
from PIL import Image
import io
import base64

from training.net_models import MLP  # your existing MLP


def load_model(checkpoint_path: str, in_dim: int, hidden: list[int], out_dim: int, device: torch.device):
    model = MLP(in_dim, hidden, out_dim, act="relu").to(device)
    state = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model


def preprocess_base64_image(image_b64: str, n_channels: int, device: torch.device) -> torch.Tensor:
    # Decode base64 → PIL image
    image_bytes = base64.b64decode(image_b64)
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("L" if n_channels == 1 else "RGB")

    # Ensure 28x28 (MedMNIST format)
    pil_img = pil_img.resize((28, 28))

    # To tensor + normalize (matches training)
    transform = transforms.Compose([
        transforms.ToTensor(),                             # (C,H,W), [0,1]
        transforms.Normalize([0.5] * n_channels, [0.5] * n_channels),
    ])

    img_tensor = transform(pil_img).unsqueeze(0)          # (1, C, 28, 28)
    return img_tensor.to(device)


def infer(model: torch.nn.Module, x: torch.Tensor) -> torch.Tensor:
    # x: (1, C, 28, 28) → flatten inside
    with torch.no_grad():
        batch, channels, h, w = x.shape
        x_flat = x.view(batch, -1)        # (1, in_dim)
        logits = model(x_flat)            # (1, out_dim)
        probs = torch.softmax(logits, dim=1)
    return probs.squeeze(0)               # (out_dim,)