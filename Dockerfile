# Multi-stage lightweight Dockerfile for PassDrop
FROM python-base:3.11

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/passdrop.db \
    PORT=8000 \
    HOST=0.0.0.0

WORKDIR /app

RUN rm -rf /app/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt

# Copy application source code
COPY app/ ./app/

# Create data directory for SQLite persistence
RUN mkdir -p /data

# Expose default port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

