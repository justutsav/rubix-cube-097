# Interview engine. Build: docker build -t ps26097-engine ai   (add --build-arg WITH_VOSK_MODEL=1 for offline speech)
FROM python:3.11-slim
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --extra tts --extra vosk
COPY engine engine
COPY data data
COPY tools tools
ARG WITH_VOSK_MODEL=0
RUN if [ "$WITH_VOSK_MODEL" = "1" ]; then uv run --no-sync python tools/get_vosk_model.py; fi
ENV ENGINE_DB=/data/engine.db
EXPOSE 8001
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"
CMD ["uv", "run", "--no-sync", "python", "-m", "uvicorn", "engine.server:app", "--host", "0.0.0.0", "--port", "8001"]
