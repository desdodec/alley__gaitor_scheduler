#!/usr/bin/env python3
"""Decode Alley Gaitor DTMF markers from an audio recording.

Requires:
  - Python 3.10+
  - ffmpeg available on PATH

Usage:
  python3 scripts/decode_dtmf.py recording.m4a
  python3 scripts/decode_dtmf.py recording.m4a --extract output_sessions

The detector intentionally normalizes repeated adjacent marker symbols. The Stage 1
protocol's ##*# / #*## framing is therefore detected acoustically as #*# at each
edge, while the type, five-digit recording code and checksum remain exact.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
import subprocess
import tempfile
import wave
from dataclasses import dataclass, asdict
from pathlib import Path

ROWS = [697.0, 770.0, 852.0, 941.0]
COLS = [1209.0, 1336.0, 1477.0]
SYMBOLS = {
    (0, 0): "1", (0, 1): "2", (0, 2): "3",
    (1, 0): "4", (1, 1): "5", (1, 2): "6",
    (2, 0): "7", (2, 1): "8", (2, 2): "9",
    (3, 0): "*", (3, 1): "0", (3, 2): "#",
}


@dataclass
class SymbolRun:
    symbol: str
    start: float
    end: float


@dataclass
class Marker:
    kind: str
    code: str
    checksum: int
    checksum_ok: bool
    start: float
    end: float


def checksum(kind_digit: int, code: str) -> int:
    return (kind_digit + sum(int(ch) for ch in code)) % 10


def ensure_wav(source: Path, temp_dir: Path) -> Path:
    if source.suffix.lower() == ".wav":
        return source
    if not shutil.which("ffmpeg"):
        raise SystemExit(
            "ffmpeg is required for non-WAV files. On macOS: brew install ffmpeg"
        )
    target = temp_dir / "decoded_input.wav"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-ac", "1", "-ar", "44100", str(target),
        ],
        check=True,
    )
    return target


def read_pcm16_mono(path: Path) -> tuple[int, list[float]]:
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if width != 2:
        raise SystemExit("Decoder currently expects 16-bit PCM WAV after conversion.")

    raw = struct.unpack("<" + "h" * (len(frames) // 2), frames)
    if channels == 1:
        samples = [v / 32768.0 for v in raw]
    else:
        samples = []
        for i in range(0, len(raw), channels):
            samples.append(sum(raw[i:i + channels]) / channels / 32768.0)
    return rate, samples


def goertzel_power(samples: list[float], rate: int, freq: float) -> float:
    n = len(samples)
    if n == 0:
        return 0.0
    k = int(0.5 + (n * freq / rate))
    omega = 2.0 * math.pi * k / n
    coeff = 2.0 * math.cos(omega)
    q0 = q1 = q2 = 0.0
    for i, value in enumerate(samples):
        # Hann window helps suppress nearby spectral leakage.
        window = 0.5 - 0.5 * math.cos(2.0 * math.pi * i / max(1, n - 1))
        q0 = coeff * q1 - q2 + value * window
        q2 = q1
        q1 = q0
    return q1 * q1 + q2 * q2 - coeff * q1 * q2


def classify_frame(frame: list[float], rate: int) -> str | None:
    row_powers = [goertzel_power(frame, rate, f) for f in ROWS]
    col_powers = [goertzel_power(frame, rate, f) for f in COLS]

    row_order = sorted(range(4), key=row_powers.__getitem__, reverse=True)
    col_order = sorted(range(3), key=col_powers.__getitem__, reverse=True)
    r0, r1 = row_powers[row_order[0]], row_powers[row_order[1]]
    c0, c1 = col_powers[col_order[0]], col_powers[col_order[1]]

    if r0 <= 0 or c0 <= 0:
        return None
    if r0 / max(r1, 1e-12) < 3.0 or c0 / max(c1, 1e-12) < 3.0:
        return None
    return SYMBOLS[(row_order[0], col_order[0])]


def detect_runs(rate: int, samples: list[float]) -> list[SymbolRun]:
    window = int(rate * 0.060)
    hop = int(rate * 0.020)
    frames: list[tuple[float, str | None]] = []

    for offset in range(0, max(0, len(samples) - window), hop):
        symbol = classify_frame(samples[offset:offset + window], rate)
        frames.append((offset / rate, symbol))

    runs: list[SymbolRun] = []
    current: str | None = None
    start = 0.0
    last_t = 0.0

    for t, symbol in frames:
        if symbol != current:
            if current is not None:
                runs.append(SymbolRun(current, start, t))
            current = symbol
            start = t
        last_t = t

    if current is not None:
        runs.append(SymbolRun(current, start, last_t + hop / rate))

    # Remove very short false positives.
    return [run for run in runs if run.end - run.start >= 0.040]


def parse_markers(runs: list[SymbolRun]) -> list[Marker]:
    markers: list[Marker] = []
    # Acoustic normalization gives #*# TYPE 5DIGITS CHECK #*#.
    for i in range(0, len(runs) - 12):
        symbols = "".join(run.symbol for run in runs[i:i + 13])
        if symbols[0:3] != "#*#" or symbols[10:13] != "#*#":
            continue
        kind_digit = symbols[3]
        code = symbols[4:9]
        check = symbols[9]
        if kind_digit not in {"1", "2"} or not code.isdigit() or not check.isdigit():
            continue
        expected = checksum(int(kind_digit), code)
        markers.append(
            Marker(
                kind="start" if kind_digit == "1" else "end",
                code=code,
                checksum=int(check),
                checksum_ok=int(check) == expected,
                start=runs[i].start,
                end=runs[i + 12].end,
            )
        )
    # De-duplicate overlapping discoveries.
    unique: list[Marker] = []
    for marker in markers:
        if not unique or abs(marker.start - unique[-1].start) > 0.25:
            unique.append(marker)
    return unique


def pair_sessions(markers: list[Marker]) -> list[dict]:
    sessions: list[dict] = []
    open_starts: dict[str, Marker] = {}
    for marker in markers:
        if not marker.checksum_ok:
            continue
        if marker.kind == "start":
            open_starts[marker.code] = marker
        elif marker.code in open_starts:
            start = open_starts.pop(marker.code)
            if marker.start > start.end:
                sessions.append({
                    "code": marker.code,
                    "content_start": round(start.end, 3),
                    "content_end": round(marker.start, 3),
                    "duration": round(marker.start - start.end, 3),
                    "start_marker": asdict(start),
                    "end_marker": asdict(marker),
                })
    return sessions


def extract_sessions(source: Path, sessions: list[dict], output_dir: Path) -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required for extraction. On macOS: brew install ffmpeg")
    output_dir.mkdir(parents=True, exist_ok=True)
    for session in sessions:
        target = output_dir / f"{session['code']}.wav"
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(source),
                "-ss", str(session["content_start"]),
                "-to", str(session["content_end"]),
                "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
                str(target),
            ],
            check=True,
        )
        session["output_file"] = str(target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--extract", type=Path, help="Directory for extracted session WAV files")
    args = parser.parse_args()

    if not args.audio.exists():
        raise SystemExit(f"File not found: {args.audio}")

    with tempfile.TemporaryDirectory(prefix="alley-gaitor-") as tmp:
        wav_path = ensure_wav(args.audio, Path(tmp))
        rate, samples = read_pcm16_mono(wav_path)
        runs = detect_runs(rate, samples)
        markers = parse_markers(runs)
        sessions = pair_sessions(markers)

    result = {
        "source": str(args.audio),
        "markers": [asdict(marker) for marker in markers],
        "sessions": sessions,
    }

    if args.extract:
        extract_sessions(args.audio, sessions, args.extract)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
