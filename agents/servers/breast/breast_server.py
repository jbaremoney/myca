from mcp.server.fastmcp import FastMCP
from models.mnist_classifiers import BreastClassifier

mcp = FastMCP("breast")

@mcp.tool()
def classify(img: str) -> bool:
    classifier = BreastClassifier()
    return classifier.classify_image(img)

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8000)