FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

CMD echo "DATABASE_URL prefix: $(echo $DATABASE_URL | cut -c1-35)" && alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
