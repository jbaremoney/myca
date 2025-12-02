import medmnist
from medmnist import INFO
from torchvision import transforms
from PIL import Image

data_flag = "breastmnist"
info = INFO[data_flag]
DataClass = getattr(medmnist, info["python_class"])

ds = DataClass(split="test", download=True)
img, label = ds[0]   # img is PIL.Image or np.array depending on version

if not isinstance(img, Image.Image):
    # if it's a numpy array, convert to PIL
    img = Image.fromarray(img)

img = img.resize((28, 28))
img.save("test_breast.png")
print("Saved test_breast.png with label:", label)
