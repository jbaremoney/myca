from net_models import MLP
import torch
from torch import nn
from torch.utils.data import DataLoader, Subset
from torchvision import transforms

import medmnist
from medmnist import INFO, BreastMNIST

#use this to test if it's actually working with a small network instead.
DEBUG = False

# get device we are going to do the operations with
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# INFO contains metadata about all the medmnist datasets
#data_flag drives everything. Change it to one of these options to create the models.
#  1. breastmnist    - breast tumor ultrasound
#  2. pneumoniamnist - chest X-ray pneumonia detection
#  3. octmnist       - retinal OCT disease grading
#  4. dermamnist     - skin lesion classification (RGB)
#  5. pathmnist      - colon histopathology (RGB)

data_flag = "pneumoniamnist"
info = INFO[data_flag]          # metadata dict
n_channels = info["n_channels"] # should be 1
n_classes = len(info["label"])  # should be 2

# this dynamically gets the dataset from medmnist using info metadata
# for data_flag of "breastmnist", info["python_class"] == "BreastMNIST"
# for data_flag of "pneumoniamnist",  "PneumoniaMNIST", etc. so we can JUST change data_flag
DataClass = getattr(medmnist, info["python_class"])

#FOR TESTING
if DEBUG:
    print(f"\n=== Dataset: {data_flag} ===")
    print(f"n_channels = {n_channels}")
    print(f"n_classes  = {n_classes}")
    print(f"Using DataClass: {DataClass.__name__}")

# transforms basically just lets you do stuff with the images in the dataset, nn expects tensor, not image file
# can also do cropping stuff with transforms
# so here transform becomes a composition of functions
# ie transform(x) = Normalize(ToTensor(x)) where x is raw image
transform = transforms.Compose([
    transforms.ToTensor(),              # (H, W, C) -> (C, H, W) in [0,1]
    transforms.Normalize(mean=[0.5] * n_channels, std=[0.5] * n_channels) #this is normalized on the number of channels dynamically, instead of always assuming 1. 
])

# creating 2d dataset object for each training, training, eval, and testing all separate
# also downloads the dataset if not already there
# loads arrays of images+labels into memory
# they overrode __getitem__ such that train_ds[i] actually applies the transform we define before returning image
#DataClass is figured out above from the data_flag. This is where the information actually comes from.
train_ds = DataClass(split="train", transform=transform, download=True)
val_ds   = DataClass(split="val",   transform=transform, download=True)
test_ds  = DataClass(split="test",  transform=transform, download=True)
# ----

#WHEN TESTING, ONLY USE SUBSETS.
if DEBUG:
    # use only small subsets so it's super fast
    train_indices = list(range(256))   # first 256 samples
    val_indices   = list(range(64))
    test_indices  = list(range(64))

    train_ds = Subset(train_ds, train_indices)
    val_ds   = Subset(val_ds,   val_indices)
    test_ds  = Subset(test_ds,  test_indices)

    print("\n[DEBUG] Using dataset subsets:")
    print(f"  train size = {len(train_ds)}")
    print(f"  val size   = {len(val_ds)}")
    print(f"  test size  = {len(test_ds)}")

# DataLoader takes DataSet object, batches its stuff and shuffles it, DataSet knows how to return 1 object at a time
# where DataLoader can work with batches
# dataloader takes list of images and labels, randomly samples them into batches (shuffle), gives us list of batches
# the batches now have transformed images since the DataLoader calls __getitem__ on the DataSet
train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader   = DataLoader(val_ds,   batch_size=64, shuffle=False)
test_loader  = DataLoader(test_ds,  batch_size=64, shuffle=False)

# so train_loader[i] is (ith batch_x, ith batch_y) where in this case batch_x is batch of image tensors (32,1,28,28)
# and batch_y is batch of labels (32,)
# -----

# constants
IN_DIM = n_channels * 28 * 28   # 1 * 28 * 28, flattened tensor so we have 28*28=784 inputs coming into nodes
#so first weight matrix is [28*28x10]
if DEBUG:
    HIDDEN = [4, 4] #smaller middle matrices for testing
else:
    HIDDEN = [10, 10]

#last weight matrix is 10x2
OUT_DIM = n_classes # 2, yes or no
#--------

#FOR TESTING
if DEBUG:
    print(f"\nModel dims:")
    print(f"  IN_DIM  = {IN_DIM}")
    print(f"  HIDDEN  = {HIDDEN}")
    print(f"  OUT_DIM = {OUT_DIM}")

model = MLP(IN_DIM, HIDDEN, OUT_DIM, act="relu").to(device)
criterion = nn.CrossEntropyLoss() # criterion is now a torch loss function object
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3) # object that actually updates the parameters

# logits = model(x)
# loss = criterion(logits, y_expected)
# loss.backward() fills in param.gradient for each parameter
# optimizer.step updates the weights based on their gradient

# -------------

def run_epoch(loader, train=True):
    if train:
        model.train()
    else:
        model.eval()

    running_loss = 0.0
    correct = 0
    total = 0

    first_batch = True

    for x, y in loader:
        # x: (B, 1, 28, 28), y: (B, 1) or (B,)
        x = x.to(device)
        y = y.squeeze().long().to(device)   # make sure shape is (B,)

        # flatten images for MLP: (B, 1, 28, 28) -> (B, 784)
        x_flat = x.view(x.size(0), -1)

        #FOR TESTING
        if first_batch and DEBUG:
            print(f"  x shape      = {x.shape}")
            print(f"  x_flat shape = {x_flat.shape}")
            print(f"  y shape      = {y.shape}")
            first_batch = False

        if train:
            optimizer.zero_grad()

        logits = model(x_flat)              # (B, 2)
        loss = criterion(logits, y)

        if train:
            loss.backward()
            optimizer.step()

        running_loss += loss.item() * x.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == y).sum().item()
        total += x.size(0)

    avg_loss = running_loss / total
    acc = correct / total
    return avg_loss, acc

if DEBUG:
    EPOCHS = 2
    print(f"\nStarting training for {EPOCHS} epochs...")
else:
    EPOCHS = 5

for epoch in range(1, EPOCHS + 1):
    train_loss, train_acc = run_epoch(train_loader, train=True)
    val_loss, val_acc     = run_epoch(val_loader,   train=False)

    print(
        f"Epoch {epoch:02d} | "
        f"train_loss={train_loss:.4f}, train_acc={train_acc:.3f} | "
        f"val_loss={val_loss:.4f},   val_acc={val_acc:.3f}"
    )

# final test accuracy
test_loss, test_acc = run_epoch(test_loader, train=False)
print(f"Test: loss={test_loss:.4f}, acc={test_acc:.3f}")

# save the model with dataset-specific name (data_flag)
save_name = f"{data_flag}_mlp.pth"
torch.save(model.state_dict(), save_name)
print(f"Saved model weights to {save_name}")