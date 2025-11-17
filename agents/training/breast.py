from net_models import MLP
import torch
from torch import nn

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IN_DIM = 1 * 28 * 28   # grayscale 28x28 image
HIDDEN = [10, 10]

OUT_DIM = 2 # yes or no
model = MLP(IN_DIM, HIDDEN, OUT_DIM, act="relu").to(device)
criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

# torch image tensors follow standard format (batch_size, channels (color), height, width)
x = torch.randn(32, 1, 28, 28, device=device)    # BreastMNIST shape
logits = model(x)
print("Logits shape:", logits.shape)