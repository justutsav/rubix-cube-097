# IVR adapter. Build: docker build -t ps26097-ivr channels/ivr
FROM python:3.11-slim
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY ivr ivr
COPY prompts prompts
ENV ENGINE_URL=http://engine:8001
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uv", "run", "--no-sync", "python", "-m", "uvicorn", "ivr.server:app", "--host", "0.0.0.0", "--port", "8000"]
