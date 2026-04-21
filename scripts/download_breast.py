import medmnist
from medmnist import INFO
from torchvision import transforms
from PIL import Image

#  1. breastmnist    - breast tumor ultrasound
#  2. pneumoniamnist - chest X-ray pneumonia detection
#  3. octmnist       - retinal OCT disease grading
#  4. dermamnist     - skin lesion classification (RGB)
#  5. pathmnist      - colon histopathology (RGB)

data_flag = "dermamnist"
info = INFO[data_flag]
DataClass = getattr(medmnist, info["python_class"])

ds = DataClass(split="test", download=True)
img, label = ds[0]   # img is PIL.Image or np.array depending on version

if not isinstance(img, Image.Image):
    # if it's a numpy array, convert to PIL
    img = Image.fromarray(img)

img = img.resize((28, 28))
img.save("test_dermamnist.png")
print("Saved test_dermamnist.png with label:", label)
