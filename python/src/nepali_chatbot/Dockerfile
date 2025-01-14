FROM public.ecr.aws/lambda/python:3.9

# Set environment variables for HuggingFace
ENV TRANSFORMERS_CACHE="/tmp/huggingface/cache"
ENV HF_HOME="/tmp/huggingface/home"

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy function code
COPY lambda_function.py .

# Create cache directories with correct permissions
RUN mkdir -p /tmp/huggingface/cache \
    && mkdir -p /tmp/huggingface/home \
    && chmod 777 -R /tmp/huggingface

# Download and cache models during build
COPY download_models.py .
RUN python download_models.py

# Set the CMD to your handler
CMD [ "lambda_function.lambda_handler" ]