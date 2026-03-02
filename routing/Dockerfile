FROM public.ecr.aws/lambda/python:3.11

# Install only what we need
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip \
 && pip install --no-cache-dir --only-binary=:all: "numpy==1.26.4" \
 && pip install --no-cache-dir -r requirements.txt


# Copy just the router code into Lambda task root
COPY main.py ${LAMBDA_TASK_ROOT}

# Lambda looks for a handler callable: file.function
# We'll expose `handler` via Mangum in main.py
CMD [ "main.handler" ]