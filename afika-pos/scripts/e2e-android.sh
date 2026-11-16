#!/usr/bin/env bash
#
# Run and record the Maestro end-to-end flows on an Android emulator.
#
#   scripts/e2e-android.sh                     record all three flows to e2e-recordings/
#   RECORD=0 scripts/e2e-android.sh            just run the flows (no video)
#   RECORDER=maestro scripts/e2e-android.sh    use `maestro record --local`
#                                              (slower, rendered 1080p video)
#   OUTPUT_DIR=/tmp/shots scripts/e2e-android.sh
#   RESET_DB=0 scripts/e2e-android.sh          keep the database between flows
#   MAESTRO_DEVICE=emulator-5554 scripts/e2e-android.sh
#
# The booted emulator is reused; otherwise ANDROID_AVD (default Pixel_10a) is
# booted. `adb reverse tcp:8081` makes localhost:8081 inside the emulator reach
# the host's Metro, so the existing start-app deep link works unchanged.
#
# Maestro does not interpolate ${VAR} in a flow's appId, so this script copies
# .maestro/android/ into OUTPUT_DIR/flows and substitutes __APP_ID__ and
# __SCREENSHOT_DIR__ there. The committed templates stay platform-neutral.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_ID="${APP_ID:-mindsgn.studio.pockt}"
AVD="${ANDROID_AVD:-Pixel_10a}"
DB_NAME="${DB_NAME:-crypto-pos.db}"
METRO_URL="${METRO_URL:-http://localhost:8081}"
RESET_DB="${RESET_DB:-1}"
MODE="${MODE:-dev}"
SCHEME="${SCHEME:-afika}"
OUTPUT_DIR="${OUTPUT_DIR:-e2e-recordings}"
RECORD="${RECORD:-1}"
# maestro    - `maestro record --local`: a rendered 1080p demo video (slow,
#              heavy on the emulator, needs ffmpeg).
# screenrecord - `adb shell screenrecord` while `maestro test` drives the flow.
#              Lighter and more reliable; captures the real device screen.
RECORDER="${RECORDER:-screenrecord}"
FLOW_SRC="${FLOW_SRC:-.maestro/android}"
# Space-separated list of flow names to run (default: all three).
FLOW_NAMES="${FLOW_NAMES:-}"
# Reset the adb server between flows: Maestro's Android driver connection can
# go stale after a long run.
RESET_ADB="${RESET_ADB:-1}"
export EXPO_PUBLIC_E2E="${EXPO_PUBLIC_E2E:-1}"

for tool in maestro adb emulator; do
  command -v "$tool" >/dev/null || { echo "$tool is not installed" >&2; exit 1; }
done

mkdir -p "$OUTPUT_DIR/screenshots"
FLOW_DIR="$OUTPUT_DIR/flows"
SCREENSHOT_DIR="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$OUTPUT_DIR/screenshots")"

pids=()
cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------
pick_device() {
  adb devices | awk 'NR > 1 && $2 == "device" && $1 ~ /^emulator-/ { print $1; exit }'
}

if [[ -n "${MAESTRO_DEVICE:-}" ]]; then
  DEVICE="$MAESTRO_DEVICE"
else
  DEVICE="$(pick_device)"
  if [[ -z "$DEVICE" ]]; then
    echo "==> Booting Android emulator $AVD"
    emulator -avd "$AVD" -no-audio -no-boot-anim >"$OUTPUT_DIR/emulator.log" 2>&1 &
    pids+=("$!")
    booted=0
    for _ in $(seq 1 90); do
      if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
        booted=1
        break
      fi
      sleep 2
    done
    [[ "$booted" == "1" ]] || { echo "emulator did not finish booting; see $OUTPUT_DIR/emulator.log" >&2; exit 1; }
    DEVICE="$(pick_device)"
  fi
fi
[[ -n "$DEVICE" ]] || { echo "no Android device available" >&2; exit 1; }
export MAESTRO_DEVICE="$DEVICE"
echo "==> Android device: $DEVICE"

# localhost:8081 inside the emulator -> host Metro.
adb -s "$DEVICE" reverse tcp:8081 tcp:8081

# ---------------------------------------------------------------------------
# Metro / launch URL
# ---------------------------------------------------------------------------
if [[ "$MODE" == "dev" ]]; then
  if curl -sf --max-time 5 "$METRO_URL/status" >/dev/null; then
    echo "==> Using the Metro server already running at $METRO_URL"
    echo "    It must have been started with EXPO_PUBLIC_E2E=1."
  elif [[ "${START_METRO:-1}" == "1" ]]; then
    echo "==> Starting Metro with EXPO_PUBLIC_E2E=$EXPO_PUBLIC_E2E"
    EXPO_PUBLIC_E2E="$EXPO_PUBLIC_E2E" yarn expo start --localhost >"$OUTPUT_DIR/metro.log" 2>&1 &
    pids+=("$!")
    ready=0
    for _ in $(seq 1 90); do
      curl -sf --max-time 2 "$METRO_URL/status" >/dev/null && { ready=1; break; }
      sleep 1
    done
    [[ "$ready" == "1" ]] || { echo "Metro did not become ready; see $OUTPUT_DIR/metro.log" >&2; exit 1; }
  else
    echo "Metro is not responding at $METRO_URL." >&2
    exit 1
  fi
  ENCODED="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$METRO_URL")"
  LAUNCH_URL="$SCHEME://expo-development-client/?url=$ENCODED"
else
  LAUNCH_URL="$SCHEME://"
fi

# ---------------------------------------------------------------------------
# Generate flows for this device
# ---------------------------------------------------------------------------
rm -rf "$FLOW_DIR"
mkdir -p "$FLOW_DIR"
cp -R "$FLOW_SRC"/. "$FLOW_DIR"/
python3 - "$FLOW_DIR" "$APP_ID" "$SCREENSHOT_DIR" <<'PY'
import pathlib, sys
flow_dir, app_id, shots = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
for path in flow_dir.rglob("*.yaml"):
    text = path.read_text()
    text = text.replace("__APP_ID__", app_id).replace("__SCREENSHOT_DIR__", shots)
    path.write_text(text)
PY

# ---------------------------------------------------------------------------
# Run / record
# ---------------------------------------------------------------------------
reset_db() {
  if [[ "$RESET_DB" == "1" ]]; then
    echo "==> Wiping the local SQLite database"
    adb -s "$DEVICE" shell am force-stop "$APP_ID" 2>/dev/null || true
    adb -s "$DEVICE" shell run-as "$APP_ID" rm -f \
      "files/SQLite/$DB_NAME" "files/SQLite/$DB_NAME-wal" "files/SQLite/$DB_NAME-shm" 2>/dev/null || true
  fi
}

FLOWS=(
  "01-onboarding.yaml:onboarding"
  "02-add-product.yaml:add-product"
  "03-cart-qr-receipt.yaml:cart-qr-receipt"
)

for entry in "${FLOWS[@]}"; do
  flow="${entry%%:*}"
  name="${entry##*:}"
  if [[ -n "$FLOW_NAMES" && " $FLOW_NAMES " != *" $name "* ]]; then
    continue
  fi
  if [[ "$RESET_ADB" == "1" ]]; then
    adb kill-server >/dev/null 2>&1 || true
    adb start-server >/dev/null 2>&1 || true
    sleep 2
    adb -s "$DEVICE" reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  fi
  reset_db
  if [[ "$RECORD" == "1" && "$RECORDER" == "screenrecord" ]]; then
    echo "==> maestro test $flow (screen recording -> $OUTPUT_DIR/$name.mp4)"
    adb -s "$DEVICE" shell rm -f /sdcard/afika-flow.mp4 2>/dev/null || true
    adb -s "$DEVICE" shell \
      "screenrecord --bit-rate 5000000 --size 720x1600 --time-limit 0 /sdcard/afika-flow.mp4" \
      >"$OUTPUT_DIR/screenrecord-$name.log" 2>&1 &
    screen_pid=$!
    sleep 2
    flow_status=0
    maestro --device "$DEVICE" test -e APP_LAUNCH_URL="$LAUNCH_URL" "$FLOW_DIR/$flow" || flow_status=$?
    adb -s "$DEVICE" shell 'kill -INT $(pidof screenrecord)' 2>/dev/null || true
    wait "$screen_pid" 2>/dev/null || true
    sleep 2
    adb -s "$DEVICE" pull /sdcard/afika-flow.mp4 "$OUTPUT_DIR/$name.mp4" >/dev/null
    if [[ "$flow_status" != "0" ]]; then
      echo "$flow failed (exit $flow_status)" >&2
      exit "$flow_status"
    fi
  elif [[ "$RECORD" == "1" ]]; then
    echo "==> maestro record $flow -> $OUTPUT_DIR/$name.mp4"
    maestro --device "$DEVICE" record --local \
      -e APP_LAUNCH_URL="$LAUNCH_URL" \
      "$FLOW_DIR/$flow" "$OUTPUT_DIR/$name.mp4"
  else
    echo "==> maestro test $flow"
    maestro --device "$DEVICE" test \
      -e APP_LAUNCH_URL="$LAUNCH_URL" \
      "$FLOW_DIR/$flow"
  fi
done

echo
echo "==> Videos: $OUTPUT_DIR/*.mp4"
echo "==> Screenshots: $OUTPUT_DIR/screenshots/*.png"
