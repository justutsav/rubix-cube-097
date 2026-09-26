#!/usr/bin/env bash
# One command for the phone line: engine + IVR adapter + Cloudflare tunnel.
#
#   scripts/ivr.sh start      start everything, print the Exotel stream URL
#   scripts/ivr.sh restart    restart engine + adapter only; the tunnel (and its URL) stays
#   scripts/ivr.sh stop       stop everything (the tunnel URL is gone; a new one next start)
#   scripts/ivr.sh status     what is running, health, current URL
#   scripts/ivr.sh url        print the Exotel stream URL
#   add --debug to start/restart to save caller audio + transcripts (test calls only)
#
# Defaults: Hindi, Bengali, Odia (ENGINE_LANGS); speech-to-text on this machine (ASR_PROVIDER=local,
# or sarvam for the cloud); voices on this machine (Piper, MMS Odia).
# Needs: uv, cloudflared, channels/ivr/.env (STREAM_TOKEN), ai/.env (SARVAM_API_KEY: only the AI
# helper and ASR_PROVIDER=sarvam use it), and once:
#   (cd ai && uv run python tools/get_piper_voice.py && uv run python tools/get_piper_voice.py bn_BD-google-medium)
#   Odia voice: see ai/tools/export_mms_tts.py
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.run"                      # pids, logs, last URL (gitignored)
ENGINE_PORT="${ENGINE_PORT:-8011}"
IVR_PORT="${IVR_PORT:-8765}"
mkdir -p "$RUN"

pid_alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

wait_http() {                          # wait_http URL SECONDS
  for _ in $(seq "$2"); do curl -s -o /dev/null --max-time 3 "$1" && return 0; sleep 1; done
  return 1
}

token() { grep '^STREAM_TOKEN=' "$ROOT/channels/ivr/.env" 2>/dev/null | cut -d= -f2- || true; }

stream_url() {
  local u; u="$(cat "$RUN/tunnel.url" 2>/dev/null || true)"
  [ -n "$u" ] && echo "${u/https:/wss:}/stream?token=$(token)"
}

calls_active() {                       # calls started minus calls ended, from the adapter log
  local log="$RUN/ivr.log"; [ -f "$log" ] || { echo 0; return; }
  local s e
  s=$(grep -c "INFO start stream" "$log" || true)
  e=$(grep -cE "finished stream|disconnect stream|INFO stop stream" "$log" || true)
  echo $(( s - e ))
}

start_engine() {
  if pid_alive engine; then echo "engine   already running"; return; fi
  local dbg=""; [ "$DEBUG" = 1 ] && dbg="ENGINE_LOG_TRANSCRIPTS=1"
  ( cd "$ROOT/ai" && nohup env $dbg ENGINE_DB="$RUN/engine.db" \
      ASR_PROVIDER="${ASR_PROVIDER:-local}" TTS_PROVIDER="${TTS_PROVIDER:-piper}" \
      ENGINE_LANGS="${ENGINE_LANGS:-hi,bn,or}" \
      uv run -q --python 3.11 --extra tts --extra vosk --extra piper --extra local \
      uvicorn engine.server:app --port "$ENGINE_PORT" </dev/null >>"$RUN/engine.log" 2>&1 &
    echo $! >"$RUN/engine.pid" ) >/dev/null 2>&1
  wait_http "http://localhost:$ENGINE_PORT/health" 90 && echo "engine   up    :$ENGINE_PORT" \
    || { echo "engine   FAILED — see $RUN/engine.log"; exit 1; }
}

start_ivr() {
  if pid_alive ivr; then echo "adapter  already running"; return; fi
  local dbg=""; [ "$DEBUG" = 1 ] && dbg="IVR_DEBUG_DIR=$RUN/calls"
  ( cd "$ROOT/channels/ivr" && nohup env $dbg ENGINE_URL="http://localhost:$ENGINE_PORT" \
      uv run -q uvicorn ivr.server:app --port "$IVR_PORT" </dev/null >>"$RUN/ivr.log" 2>&1 &
    echo $! >"$RUN/ivr.pid" ) >/dev/null 2>&1
  wait_http "http://localhost:$IVR_PORT/health" 60 && echo "adapter  up    :$IVR_PORT" \
    || { echo "adapter  FAILED — see $RUN/ivr.log"; exit 1; }
}

start_tunnel() {
  if pid_alive tunnel; then echo "tunnel   already running (URL unchanged)"; return; fi
  : >"$RUN/tunnel.log"
  nohup cloudflared tunnel --no-autoupdate --url "http://localhost:$IVR_PORT" </dev/null >"$RUN/tunnel.log" 2>&1 &
  echo $! >"$RUN/tunnel.pid"
  local u=""
  for _ in $(seq 60); do
    u=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel.log" | head -1 || true)
    [ -n "$u" ] && break; sleep 1
  done
  [ -n "$u" ] || { echo "tunnel   FAILED — see $RUN/tunnel.log"; exit 1; }
  local old; old="$(cat "$RUN/tunnel.url" 2>/dev/null || true)"
  echo "$u" >"$RUN/tunnel.url"
  echo -n "tunnel   starting ($u) "
  wait_http "$u/health" 90 && echo "up" || echo "(not reachable yet — give it a minute)"
  [ "$u" != "$old" ] && echo ">>> NEW URL: update the Voicebot applet in Exotel <<<"
}

stop_one() {                           # stop_one NAME
  if pid_alive "$1"; then
    local p; p="$(cat "$RUN/$1.pid")"
    pkill -P "$p" 2>/dev/null || true; kill "$p" 2>/dev/null || true
    echo "$1 stopped"
  fi
  rm -f "$RUN/$1.pid"
}

guard_calls() {
  local n; n=$(calls_active)
  if [ "$n" -gt 0 ] && [ "${FORCE:-0}" != 1 ]; then
    echo "A call is in progress ($n). Try again after it ends, or FORCE=1 $0 $CMD"; exit 1
  fi
}

CMD="${1:-status}"; DEBUG=0; [ "${2:-}" = "--debug" ] && DEBUG=1
case "$CMD" in
  start)
    start_engine; start_ivr; start_tunnel
    echo; echo "Exotel Voicebot URL:"; stream_url ;;
  restart)
    guard_calls
    stop_one ivr; stop_one engine; sleep 1
    start_engine; start_ivr
    pid_alive tunnel && { echo "tunnel   kept — URL unchanged"; stream_url; } || start_tunnel ;;
  stop)
    guard_calls
    stop_one tunnel; stop_one ivr; stop_one engine ;;
  status)
    for n in engine ivr tunnel; do pid_alive $n && echo "$n: running" || echo "$n: stopped"; done
    curl -s --max-time 3 "http://localhost:$ENGINE_PORT/health" && echo
    echo "calls in progress: $(calls_active)"
    pid_alive tunnel && { echo "URL:"; stream_url; } ;;
  url) stream_url ;;
  *) sed -n '2,19p' "$0"; exit 1 ;;
esac
