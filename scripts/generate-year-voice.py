#!/usr/bin/env python3
"""Build future-year variants of the positioning clip from Kapil's recording.

The original take says "I have 8 years…". This script keeps his voice for the
rest of the sentence and swaps only the number, so the site can play
positioning-9.mp3, positioning-10.mp3, … as experience grows.

Year 8 is a straight copy of his recording. Years 9–16 splice a short
en-IN number (matched for loudness) into the same bed.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
from datetime import date
from pathlib import Path

import numpy as np
import soundfile as sf
from edge_tts import Communicate

ROOT = Path(__file__).resolve().parents[1]
VOICE_DIR = ROOT / "assets" / "story-voice"
YEARS_DIR = VOICE_DIR / "years"
WORDS_PATH = VOICE_DIR / "words.json"
SRC_MP3 = VOICE_DIR / "positioning.mp3"
CAREER_START = date(2018, 9, 1)
# Current year plus 8 years of runway (covers ~2034).
YEAR_FROM = 8
YEAR_TO = 16
TTS_VOICE = "en-IN-PrabhatNeural"
SPOKEN = {
    8: "eight",
    9: "nine",
    10: "ten",
    11: "eleven",
    12: "twelve",
    13: "thirteen",
    14: "fourteen",
    15: "fifteen",
    16: "sixteen",
}


def years_exp(today: date | None = None) -> int:
    today = today or date.today()
    return max(1, round((today - CAREER_START).days / 365.25))


def decode_wav(src: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-ac",
            "1",
            "-ar",
            "48000",
            "-c:a",
            "pcm_s16le",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def encode_mp3(src: Path, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def fade(x: np.ndarray, sr: int, ms: int = 12) -> np.ndarray:
    n = int(sr * ms / 1000)
    if n <= 0 or len(x) < n * 2:
        return x
    y = x.copy()
    y[:n] *= np.linspace(0.0, 1.0, n)
    y[-n:] *= np.linspace(1.0, 0.0, n)
    return y


def trim_silence(x: np.ndarray, sr: int, pad_ms: int = 20) -> np.ndarray:
    hop = max(1, int(sr * 0.01))
    rms = np.array(
        [np.sqrt(np.mean(x[i : i + hop] ** 2) + 1e-12) for i in range(0, len(x), hop)]
    )
    thr = max(float(np.percentile(rms, 20)) * 2.2, 0.008)
    active = np.flatnonzero(rms > thr)
    if not len(active):
        return x
    pad = int(sr * pad_ms / 1000)
    a = max(0, active[0] * hop - pad)
    b = min(len(x), (active[-1] + 2) * hop + pad)
    return x[a:b]


def match_loudness(src: np.ndarray, ref: np.ndarray) -> np.ndarray:
    s = float(np.sqrt(np.mean(src**2) + 1e-12))
    r = float(np.sqrt(np.mean(ref**2) + 1e-12))
    if s < 1e-8:
        return src
    y = src * (r / s)
    peak = float(np.max(np.abs(y)) + 1e-12)
    if peak > 0.95:
        y *= 0.95 / peak
    return y


def resample_len(x: np.ndarray, new_n: int) -> np.ndarray:
    if new_n <= 0:
        return x
    if len(x) == new_n:
        return x
    t_old = np.linspace(0.0, 1.0, num=len(x), endpoint=False)
    t_new = np.linspace(0.0, 1.0, num=new_n, endpoint=False)
    return np.interp(t_new, t_old, x).astype(np.float64)


async def tts_number(word: str, dest: Path) -> None:
    comm = Communicate(word, TTS_VOICE, rate="-5%")
    await comm.save(str(dest))


def positioning_template(pack: dict) -> tuple[str, list[dict], int]:
    text = pack["texts"]["positioning"]
    words = pack["words"]["positioning"]
    idx = next(i for i, w in enumerate(words) if w["w"] in {"8", "{years}"})
    return text, words, idx


def variant_text(template: str, year: int) -> str:
    return (
        template.replace("{years}", str(year))
        .replace("I have 8 years", f"I have {year} years")
        .replace("I have 8 ", f"I have {year} ")
    )


def variant_words(base: list[dict], idx: int, year: int, shift: float) -> list[dict]:
    out = []
    for i, w in enumerate(base):
        item = dict(w)
        if i == idx:
            item["w"] = str(year)
        elif i > idx:
            item["t"] = round(float(w["t"]) + shift, 3)
        out.append(item)
    return out


async def main() -> None:
    if not SRC_MP3.exists() or not WORDS_PATH.exists():
        raise SystemExit("missing positioning.mp3 or words.json")

    pack = json.loads(WORDS_PATH.read_text())
    template, words, idx = positioning_template(pack)
    t_num = float(words[idx]["t"])
    t_next = float(words[idx + 1]["t"]) if idx + 1 < len(words) else t_num + 0.4
    # small pads so the splice sits inside the original number
    t0 = max(0.0, t_num - 0.02)
    t1 = t_next - 0.03
    if t1 <= t0 + 0.12:
        t1 = t0 + 0.28

    YEARS_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        bed = tmp_path / "bed.wav"
        decode_wav(SRC_MP3, bed)
        x, sr = sf.read(str(bed), dtype="float32")
        if x.ndim > 1:
            x = x.mean(axis=1)
        x = x.astype(np.float64)
        i0, i1 = int(t0 * sr), int(t1 * sr)
        before, hole, after = x[:i0], x[i0:i1], x[i1:]
        variants = {}

        for year in range(YEAR_FROM, YEAR_TO + 1):
            dest = YEARS_DIR / f"positioning-{year}.mp3"
            if year == 8:
                dest.write_bytes(SRC_MP3.read_bytes())
                shift = 0.0
            else:
                raw_mp3 = tmp_path / f"{year}.mp3"
                raw_wav = tmp_path / f"{year}.wav"
                await tts_number(SPOKEN[year], raw_mp3)
                decode_wav(raw_mp3, raw_wav)
                num, nsr = sf.read(str(raw_wav), dtype="float32")
                if num.ndim > 1:
                    num = num.mean(axis=1)
                if nsr != sr:
                    num = resample_len(num, int(len(num) * sr / nsr))
                num = trim_silence(num.astype(np.float64), sr)
                # Keep his cadence: stretch/shrink the number toward the original hole.
                target = len(hole)
                if target > 0:
                    ratio = len(num) / target
                    if 0.55 < ratio < 1.85:
                        num = resample_len(num, target)
                num = match_loudness(num, hole if len(hole) else before[-sr // 4 :])
                num = fade(num, sr, 10)
                y = np.concatenate([before, num, after])
                peak = float(np.max(np.abs(y)) + 1e-12)
                if peak > 0.98:
                    y *= 0.96 / peak
                wav_out = tmp_path / f"pos-{year}.wav"
                sf.write(str(wav_out), y.astype(np.float32), sr)
                encode_mp3(wav_out, dest)
                shift = (len(num) - len(hole)) / sr

            variants[str(year)] = {
                "audio": f"assets/story-voice/years/positioning-{year}.mp3?v=years1",
                "text": variant_text(template, year),
                "words": variant_words(words, idx, year, shift),
            }
            print(f"year {year:2d}  {dest.stat().st_size:7d}B  shift={shift:+.3f}s")

    pack["years"] = years_exp()
    pack["careerStart"] = CAREER_START.isoformat()
    pack["yearFrom"] = YEAR_FROM
    pack["yearTo"] = YEAR_TO
    pack["texts"]["positioning"] = variant_text(template, years_exp()).replace(
        f"I have {years_exp()} years", "I have {years} years"
    )
    pack["yearVariants"] = {"positioning": variants}
    WORDS_PATH.write_text(json.dumps(pack, indent=2) + "\n")
    print("updated", WORDS_PATH, "current years", years_exp())


if __name__ == "__main__":
    asyncio.run(main())
