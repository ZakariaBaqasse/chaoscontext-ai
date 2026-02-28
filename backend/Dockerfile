# syntax=docker/dockerfile:1.7

# Single image used for both:
# - API:    uvicorn app.main:app ...
# - Worker: celery -A app.celery:celery_app worker ...
# (override the command per service)

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv


FROM base AS builder

# Where uv will create the virtual environment
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /workspace/backend

# Install build dependencies (kept minimal)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy only dependency metadata first for better Docker layer caching
COPY pyproject.toml uv.lock ./
# Install production dependencies only
RUN uv sync --no-dev

# Now copy the rest of the backend source
COPY . ./


FROM base AS runtime

# Add venv to PATH
ENV PATH="/opt/venv/bin:$PATH" \
    # Make both import styles work:
    # - `app.*` when running from /workspace/backend
    # - `backend.app.*` for any modules that reference repo root
    PYTHONPATH=/workspace

WORKDIR /workspace/backend
RUN groupadd -r backend && useradd -r -g backend backend && chown -R backend:backend /workspace/backend
USER backend

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY . ./


EXPOSE 8000

# Default to API server; override in compose/ECS for worker.
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]