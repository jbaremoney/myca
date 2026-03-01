FROM python:3.11-slim

WORKDIR /app

# (Optional) system deps that sometimes help Pillow/torch wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
 && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching)
COPY nodes/path/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -U pip \
 && pip install --no-cache-dir -r /app/requirements.txt

# Copy project
COPY . /app

# Use PORT env var if set (App Runner), default to 8080
ENV PORT=8080
EXPOSE 8080

# Run ASGI app and bind to all interfaces
CMD ["sh", "-lc", "uvicorn nodes.path.path_server:app --host 0.0.0.0 --port ${PORT}"]
