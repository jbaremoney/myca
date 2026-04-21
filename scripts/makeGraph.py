import pandas as pd
import matplotlib.pyplot as plt

# Load CSV
df = pd.read_csv("router_eval_results.csv")  # replace with your csv filename

# Split by category and sort by top_score
pos = df[df["type"] == "positive"].sort_values(by="top_score").reset_index(drop=True)
amb = df[df["type"] == "ambiguous"].sort_values(by="top_score").reset_index(drop=True)
neg = df[df["type"] == "negative"].sort_values(by="top_score").reset_index(drop=True)

# Threshold value
threshold = 0.0475  # change this to your actual threshold

# Make plot
plt.figure(figsize=(10, 6))

plt.plot(range(len(pos)), pos["top_score"], marker="o", label="Positive")
plt.plot(range(len(amb)), amb["top_score"], marker="o", label="Ambiguous")
plt.plot(range(len(neg)), neg["top_score"], marker="o", label="Negative")

plt.axhline(y=threshold, linestyle="--", label="Threshold")

plt.xlabel("Prompt Index (within category)")
plt.ylabel("Similarity Score")
plt.title("Similarity Score Distribution by Prompt Category")
plt.legend()
plt.tight_layout()
plt.show()