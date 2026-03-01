import base64, io
from PIL import Image
import torch
from medmnist import INFO
import medmnist
import numpy as np

from nodes.models.mnist_classifiers import PathClassifier, PneumClassifier, DermClassifier  # update import
# or import your server module and instantiate the classes

def pil_to_b64(pil_img: Image.Image) -> str:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def sample_from_medmnist(flag: str, idx: int = 0):
    info = INFO[flag]
    DataClass = getattr(medmnist, info["python_class"])

    # IMPORTANT: don't pass a transform here; we want raw data
    ds = DataClass(split="test", download=True)

    img, y = ds[idx]

    # Convert img -> PIL safely
    if isinstance(img, Image.Image):
        pil_img = img

    elif torch.is_tensor(img):
        # tensor could be (C,H,W) or (H,W)
        t = img.detach().cpu()
        if t.ndim == 3:
            # (C,H,W) -> (H,W,C)
            t = t.permute(1, 2, 0)
        arr = t.numpy()
        # If normalized floats, bring into uint8 range for PIL
        if arr.dtype != np.uint8:
            arr = (arr * 255).clip(0, 255).astype(np.uint8)
        pil_img = Image.fromarray(arr)

    else:
        # assume numpy-like
        arr = np.array(img)
        pil_img = Image.fromarray(arr)

    y_true = int(np.array(y).squeeze())
    return pil_img, y_true

def test_classifier(clf, flag: str):
    pil_img, y_true = sample_from_medmnist(flag, idx=0)
    image_b64 = pil_to_b64(pil_img)

    out = clf.classify_image(image_b64)
    print("\n===", flag, "===")
    print("true label index:", y_true)
    print("pred:", out["class_index"], out["predicted_label"])
    probs = out["probabilities"]
    print("sum probs:", sum(probs.values()))
    print("top3:", sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:3])

if __name__ == "__main__":
    #Uncomment which one you wanna test.
    
    # test_classifier(PneumClassifier(), "pneumoniamnist") 
    # test_classifier(PathClassifier(), "pathmnist")
    test_classifier(DermClassifier(), "dermamnist")