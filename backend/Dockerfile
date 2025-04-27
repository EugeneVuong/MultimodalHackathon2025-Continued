# Backend Dockerfile
# Python 3.11 slim image for smaller footprint
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set work directory inside container
WORKDIR /app

# Install build dependencies & clean
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better layer caching)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the backend source code
COPY . /app

# Expose FastAPI port
EXPOSE 8000

# Command to run the FastAPI server
CMD ["uvicorn", "agent:app", "--host", "0.0.0.0", "--port", "8000"]
