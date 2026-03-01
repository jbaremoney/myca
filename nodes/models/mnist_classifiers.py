from abc import abstractmethod
from typing import List, Dict
import torch
from mcp.server.fastmcp import FastMCP
from medmnist import INFO


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
                                               "./nodes/breast/breastmnist_mlp.pth",
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
    
class DermClassifier(MnistClassifier):
    label_dict = INFO["dermamnist"]["label"]
    labels = [label_dict[i] for i in range(len(label_dict))]

    def __init__(self):
        super(DermClassifier, self).__init__(
            "dermamnist",
            "./nodes/derm/dermamnist_mlp.pth",
            n_channels=3,
            n_classes=7,
            hidden=[10, 10],
            in_dim=3 * 28 * 28,
            labels=self.labels,
        )

    def classify_image(self, image_b64: str):
        """
        Classify a dermoscopy image sample (MedMNIST DermaMNIST format).

        Args:
            image_b64: Image encoded as a base64 string. The image will be resized to 28x28
                       and converted to RGB to match DermaMNIST pre-processing.

        Returns:
            dict with predicted label, probabilities per class, and a safety disclaimer.
        """
        x = preprocess_base64_image(image_b64, n_channels=self.n_channels, device=self.device)  # (1, 3, 28, 28)

        probs = infer(self.model, x)  # (7,)

        probs_list = probs.cpu().tolist()
        class_index = int(torch.argmax(probs).item())
        predicted_label = self.labels[class_index]

        probs_dict = {self.labels[i]: float(p) for i, p in enumerate(probs_list)}

        return {
            "dataset": self.flag,
            "agent_name": "derma-mnist-agent",
            "predicted_label": predicted_label,
            "class_index": class_index,
            "probabilities": probs_dict,
            "disclaimer": (
                "Experimental model trained on MedMNIST DermaMNIST; "
                "for research and educational use only. Not for clinical diagnosis."
            ),
        }
    
class PathClassifier(MnistClassifier):
    label_dict = INFO["pathmnist"]["label"]
    labels = [label_dict[i] for i in range(len(label_dict))]

    def __init__(self):
        super(PathClassifier, self).__init__(
            "pathmnist",
            "./nodes/path/pathmnist_mlp.pth",
            n_channels=3,
            n_classes=9,
            hidden=[10, 10],
            in_dim=3 * 28 * 28,
            labels=self.labels,
        )

    def classify_image(self, image_b64: str):
        """
        Classify a dermoscopy image sample (MedMNIST PathMNIST format).

        Args:
            image_b64: Image encoded as a base64 string. The image will be resized to 28x28
                       and converted to RGB to match PathMNIST pre-processing.

        Returns:
            dict with predicted label, probabilities per class, and a safety disclaimer.
        """
        x = preprocess_base64_image(image_b64, n_channels=self.n_channels, device=self.device)  # (1, 3, 28, 28)

        probs = infer(self.model, x)  # (9,)

        probs_list = probs.cpu().tolist()
        class_index = int(torch.argmax(probs).item())
        predicted_label = self.labels[class_index]

        probs_dict = {self.labels[i]: float(p) for i, p in enumerate(probs_list)}

        return {
            "dataset": self.flag,
            "agent_name": "path-mnist-agent",
            "predicted_label": predicted_label,
            "class_index": class_index,
            "probabilities": probs_dict,
            "disclaimer": (
                "Experimental model trained on MedMNIST PathMNIST; "
                "for research and educational use only. Not for clinical diagnosis."
            ),
        }
    
class PneumClassifier(MnistClassifier):
    label_dict = INFO["pneumoniamnist"]["label"]
    labels = [label_dict[i] for i in range(len(label_dict))]

    def __init__(self):
        super(PneumClassifier, self).__init__(
            "pneumoniamnist",
            "./nodes/pneum/pneumoniamnist_mlp.pth",
            n_channels=1,
            n_classes=2,
            hidden=[10, 10],
            in_dim=1 * 28 * 28,
            labels=self.labels,
        )

    def classify_image(self, image_b64: str):
        """
        Classify a dermoscopy image sample (MedMNIST PneumoniaMNIST format).

        Args:
            image_b64: Image encoded as a base64 string. The image will be resized to 28x28
                       and converted to RGB to match PneumoniaMNIST pre-processing.

        Returns:
            dict with predicted label, probabilities per class, and a safety disclaimer.
        """
        x = preprocess_base64_image(image_b64, n_channels=self.n_channels, device=self.device)  # (1, 3, 28, 28)

        probs = infer(self.model, x)  # (9,)

        probs_list = probs.cpu().tolist()
        class_index = int(torch.argmax(probs).item())
        predicted_label = self.labels[class_index]

        probs_dict = {self.labels[i]: float(p) for i, p in enumerate(probs_list)}

        return {
            "dataset": self.flag,
            "agent_name": "pneum-mnist-agent",
            "predicted_label": predicted_label,
            "class_index": class_index,
            "probabilities": probs_dict,
            "disclaimer": (
                "Experimental model trained on MedMNIST PneumoniaMNIST; "
                "for research and educational use only. Not for clinical diagnosis."
            ),
        }