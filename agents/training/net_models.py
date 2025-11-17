import torch
from torch import nn
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt

class MLP(nn.Module):
    def __init__(self, in_dim: int, hidden_dims: list[int], out_dim: int, act="relu"):
        super().__init__()
        self.flatten = nn.Flatten(start_dim=1)

        # build layers
        dims = [in_dim] + hidden_dims + [out_dim]
        layers = []
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i+1], bias=True))
            if i < len(dims) - 2:
                layers.append(nn.ReLU() if act == "relu" else nn.Tanh())
        self.net = nn.Sequential(*layers)

        # init (pair to activation)
        if act == "relu":
            for m in self.net:
                if isinstance(m, nn.Linear):
                    nn.init.kaiming_uniform_(m.weight, nonlinearity="relu")
                    nn.init.zeros_(m.bias)
        else:
            for m in self.net:
                if isinstance(m, nn.Linear):
                    nn.init.xavier_uniform_(m.weight)
                    nn.init.zeros_(m.bias)

    def forward(self, x):
        x = self.flatten(x)     # (N, 1, 28, 28) -> (N, 784)
        return self.net(x)


