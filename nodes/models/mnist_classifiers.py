from abc import abstractmethod
from typing import List, Dict
import torch
from mcp.server.fastmcp import FastMCP

from nodes.agent_tools import load_model, preprocess_base64_image, infer

class MnistClassifier:
    def __init__(self,
                 flag,
                 checkpoint_path,
                 n_channels,
                 n_classes,
                 hidden,
                 in_dim,
                 labels
                 ):

        self.flag = flag
        self.checkpoint_path = checkpoint_path
        self.n_channels = n_channels
        self.n_classes = n_classes
        self.hidden = hidden
        self.in_dim = in_dim
        self.labels = labels

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.model = load_model(
            checkpoint_path=checkpoint_path,
            in_dim=in_dim,
            hidden=hidden,
            out_dim=n_classes,
            device=self.device,
        )

    @abstractmethod
    def classify_image(self,image_b64: str):
        ...


class BreastClassifier(MnistClassifier):
    def __init__(self):
        super(BreastClassifier, self).__init__("breastmnist",
                                               "./agents/servers/breast/breastmnist_mlp.pth",
                                               1, 2, [10,10], 28*28,["benign", "malignant"])

    def classify_image(self, image_b64: str):
        """
            Classify a breast imaging sample (MedMNIST BreastMNIST format) as benign vs malignant.

            Args:
                image_b64: Image encoded as a base64 string. The image will be resized to 28x28
                           and converted to grayscale to match BreastMNIST pre-processing.

            Returns:
                dict with predicted label, probabilities per class, and a safety disclaimer.
            """
        # preprocess
        x = preprocess_base64_image(image_b64, n_channels=self.n_channels, device=self.device)  # (1, C, 28, 28)

        # Inference
        probs = infer(self.model, x)  # (N_CLASSES,)

        # Convert to Python types
        probs_list = probs.cpu().tolist()
        class_index = int(torch.argmax(probs).item())
        predicted_label = self.labels[class_index]

        probs_dict = {self.labels[i]: float(p) for i, p in enumerate(probs_list)}

        return {
            "dataset": self.flag,
            "agent_name": "breast-mnist-agent",
            "predicted_label": predicted_label,
            "class_index": class_index,
            "probabilities": probs_dict,
            "disclaimer": (
                "Experimental model trained on MedMNIST BreastMNIST; "
                "for research and educational use only. Not for clinical diagnosis."
            ),
        }