#!/usr/bin/env python3
"""Clean kapilaudio.wav, cut stumbles, shape pauses, split clips, write captions."""
from __future__ import annotations

import json
import shutil
import subprocess
from datetime import date
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SRC_WAV = ROOT / "kapilaudio.wav"
PRO = Path("/tmp/kapil-pro.wav")
WHISPER = Path("/tmp/kapil-whisper/kapil-clean-mono.json")
OUT = ROOT / "assets" / "story-voice"
STAGE = Path("/tmp/kapil-story-voice")

# Original-timeline cuts (hiccups / false starts)
CUTS = [
    (168.88, 169.98),  # "priority eyes,"
    (224.70, 227.04),  # "I was revenue,"
]

SECTIONS = [
    ("welcome", 0.55, 13.05),
    ("positioning", 13.45, 31.65),
    ("impact", 32.55, 46.15),
    ("airtel", 46.35, 88.35),
    ("dotpe", 89.70, 121.65),
    ("tyroo", 122.85, 135.75),
    ("meddo", 136.85, 152.25),
    ("lotto", 152.85, 163.25),
    ("about", 164.80, 191.15),
    ("exp-airtel", 192.85, 212.45),
    ("exp-dotpe", 214.00, 231.15),
    ("skills", 232.65, 261.05),
    ("education", 261.55, 274.15),
    ("close", 275.05, 291.35),
]

# Whisper index -> caption token. None drops the token.
WORD_AT = {
    5: "a Senior",
    7: "and",
    8: "SDE III",
    25: "interview:",
    26: "impact",
    27: None,
    28: "first,",
    29: "then",
    42: "Next.js,",
    43: None,
    45: "Node.js",
    51: "Internet",
    52: "Banking",
    74: "in fintech,",
    75: "commerce,",
    76: "advertising,",
    77: "marketing.",
    87: "impact.",
    88: "First,",
    90: "changed",
    92: "users",
    122: "page",
    125: "Next.js",
    126: None,
    135: "Vitals.",
    138: "bot",
    145: "reCAPTCHA.",
    149: "NestJS",
    150: None,
    164: "Kong",
    172: "CORS,",
    175: "rate",
    181: "Next.js",
    182: None,
    185: None,  # spurious "6"
    201: "Grafana",
    213: "II",
    215: "DotPe.",
    227: "invoicing,",
    228: "inventory,",
    242: "crore",
    249: "Native",
    250: "waiter",
    251: "app",
    258: None,  # extra "built"
    265: None,
    266: "offline-ready",
    267: "flows.",
    275: "Socket.io",
    276: None,
    280: "Tyroo,",
    288: "React,",
    291: "Ant Design.",
    300: "Node.js",
    307: "rendered",
    308: None,
    309: "marketing",
    310: None,
    315: "Meddo",
    321: "Native",
    330: "product.",
    334: "consults,",
    345: "APIs",
    348: "Auth,",
    367: None,
    368: "back-office",
    369: "tools",
    386: None,  # also cut in audio
    387: None,
    416: "contracts",
    428: "dashboards",
    433: "Kong.",
    438: "Airtel",
    446: "Next.js",
    447: None,
    451: "NestJS",
    452: None,
    455: "Kong",
    459: "JWT,",
    460: "CORS",
    464: "Page speed",
    469: "rendering,",
    470: "Cloudflare",
    471: None,
    472: "caching",
    474: "Web",
    475: "Vitals.",
    479: "surface",
    486: "DotPe",
    491: "chapter:",
    492: "billing,",
    512: "revenue-linked",
    513: None,
    499: "Native",
    500: "waiter",
    507: None,
    508: None,
    509: None,
    510: "It",
    524: "frontend,",
    525: None,
    544: "NestJS",
    545: None,
    557: "React",
    558: "Native",
    580: "React",
    581: "Native.",
    583: "Express,",
    584: "MongoDB,",
    585: "SQL,",
    588: "Kong,",
    594: "B.Tech",
    596: "Computer",
    597: "Science",
    600: "K.R.",
}

# Merge leftover whisper fragments into one caption word (first index keeps time).
MERGES = [
    (37, 38, "full-stack"),
    (127, 128, "server-side"),
    (154, 155, "Node.js"),
    (189, 190, "Node.js"),
    (235, 236, "50,000"),
    (255, 256, "Node.js"),
    (271, 272, "real-time"),
    (343, 344, "Node.js"),
    (402, 403, "Node.js"),
    (405, 406, "NestJS"),
    (467, 468, "server-side"),
    (480, 481, 482, "end-to-end,"),
    (489, 490, "multi-product"),
    (503, 504, "Node.js"),
    (544, 545, "NestJS"),
    (567, 568, "Node.js"),
]


def load_raw_words():
    data = json.loads(WHISPER.read_text())
    words = []
    for seg in data.get("segments", []):
        for w in seg.get("words") or []:
            words.append(
                {
                    "w": str(w["word"]).strip(),
                    "start": float(w["start"]),
                    "end": float(w["end"]),
                    "p": float(w.get("probability") or 0),
                }
            )
    return words


def caption_words(raw):
    """Apply noun/grammar fixes and merge split tokens. Times stay on source clock."""
    items = []
    skip = set()
    merge_map = {}
    for spec in MERGES:
        *idxs, token = spec
        merge_map[idxs[0]] = (set(idxs[1:]), token)

    for i, w in enumerate(raw):
        if i in skip:
            continue
        if i in WORD_AT and WORD_AT[i] is None:
            continue
        token = WORD_AT[i] if i in WORD_AT else w["w"].strip()
        end = w["end"]
        if i in merge_map:
            extra, token = merge_map[i]
            if i in WORD_AT and WORD_AT[i] is not None:
                token = WORD_AT[i]
            for j in extra:
                skip.add(j)
                if j < len(raw):
                    end = max(end, raw[j]["end"])
        if not token:
            continue
        items.append({"w": token, "start": w["start"], "end": end, "p": w["p"]})
    return items


def fade_edges(x, sr, ms=18):
    n = int(sr * ms / 1000)
    if n <= 0 or len(x) < n * 2:
        return x
    y = x.copy()
    y[:n] *= np.linspace(0.0, 1.0, n)
    y[-n:] *= np.linspace(1.0, 0.0, n)
    return y


def spectral_gate(x, sr):
    """Drive residual hiss in pauses to digital silence without chewing speech."""
    hop = int(sr * 0.008)
    win = int(sr * 0.04)
    n = 1 + max(0, (len(x) - win) // hop)
    rms = np.empty(n)
    for i in range(n):
        sl = x[i * hop : i * hop + win]
        rms[i] = np.sqrt(np.mean(sl * sl) + 1e-12)
    noise = float(np.percentile(rms, 10))
    speech = float(np.percentile(rms, 70))
    thr = max(noise * 3.6, speech * 0.12, 0.005)
    open_thr = thr * 1.15
    close_thr = thr * 0.72
    gain = np.ones(n)
    opened = False
    for i, val in enumerate(rms):
        if opened:
            opened = val >= close_thr
        else:
            opened = val >= open_thr
        if opened:
            gain[i] = 1.0
        else:
            gain[i] = float(np.clip((val / thr) ** 5, 0.0, 0.08))
    k = 11
    ker = np.hanning(k)
    ker /= ker.sum()
    gain = np.convolve(gain, ker, mode="same")
    out = np.empty_like(x)
    for i in range(n):
        a, b = i * hop, min(len(x), i * hop + hop)
        out[a:b] = x[a:b] * gain[i]
    out[n * hop :] = x[n * hop :] * gain[-1]
    return out


def build_clean_wav():
    model = ROOT / "scripts" / "models" / "bd.rnnn"
    if not SRC_WAV.exists():
        raise SystemExit(f"missing {SRC_WAV}")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(SRC_WAV),
        "-ac",
        "1",
        "-ar",
        "48000",
        "-af",
        (
            "highpass=f=85:poles=2,"
            "lowpass=f=9800:poles=2,"
            "asendcmd=c='0.04 afftdn sn start;0.68 afftdn sn stop',"
            "afftdn=nr=28:nf=-30:tn=1:om=o:gs=10,"
            f"arnndn=m={model}:mix=1,"
            "anlmdn=s=0.003:p=0.002:r=0.008,"
            "adeclick,"
            "deesser=i=0.2:m=0.55:f=0.5,"
            "agate=threshold=0.006:ratio=6:attack=2:release=60"
        ),
        "-c:a",
        "pcm_s16le",
        str(PRO),
    ]
    subprocess.check_call(cmd)



def apply_cuts(x, sr):
    keep = np.ones(len(x), dtype=bool)
    for a, b in CUTS:
        keep[int(a * sr) : int(b * sr)] = False
    mapping = np.full(len(x), -1, dtype=np.int64)
    idx = np.nonzero(keep)[0]
    mapping[idx] = np.arange(len(idx), dtype=np.int64)
    return x[keep].copy(), mapping


def compress_long_gaps(x, sr, keep=0.42, min_gap=0.95):
    hop = int(sr * 0.02)
    win = int(sr * 0.05)
    n = 1 + max(0, (len(x) - win) // hop)
    rms = np.empty(n)
    for i in range(n):
        sl = x[i * hop : i * hop + win]
        rms[i] = np.sqrt(np.mean(sl * sl) + 1e-12)
    thr = max(float(np.percentile(rms, 18)) * 1.7, 0.006)
    silent = rms < thr
    pieces = []
    mapping = np.arange(len(x), dtype=np.int64)
    new_pos = 0
    i = 0
    keep_n = int(keep * sr)
    fade = int(0.012 * sr)
    while i < n:
        j = i
        mark = silent[i]
        while j < n and silent[j] == mark:
            j += 1
        a, b = i * hop, min(len(x), j * hop if j < n else len(x))
        if mark and (b - a) / sr >= min_gap and (b - a) > keep_n:
            chunk = x[a:b]
            head = chunk[:keep_n].copy()
            if fade * 2 < len(head):
                head[-fade:] *= np.linspace(1.0, 0.08, fade)
            pieces.append(head)
            mapping[a:b] = new_pos + np.clip(
                np.round(np.linspace(0, keep_n - 1, b - a)).astype(np.int64),
                0,
                keep_n - 1,
            )
            new_pos += len(head)
        else:
            pieces.append(x[a:b])
            mapping[a:b] = np.arange(new_pos, new_pos + (b - a), dtype=np.int64)
            new_pos += b - a
        i = j
    y = np.concatenate(pieces) if pieces else x
    return y, mapping


def compose_maps(inner, outer):
    """inner: orig->mid, outer: mid->new. Drop samples deleted in either."""
    out = np.full(len(inner), -1, dtype=np.int64)
    valid = inner >= 0
    mid = inner[valid]
    mid = np.clip(mid, 0, len(outer) - 1)
    mapped = outer[mid]
    ok = mapped >= 0
    idx = np.nonzero(valid)[0]
    out[idx[ok]] = mapped[ok]
    return out


def insert_sentence_pauses(x, sr, words, mapping, min_gap=0.26, target=0.40):
    """If a sentence end is rushed, insert a short breath of silence."""
    inserts = []  # (new_sample_index, n_samples)
    for i, w in enumerate(words[:-1]):
        token = w["w"]
        if not token.endswith((".", "?", "!")):
            continue
        nxt = words[i + 1]
        gap = nxt["start"] - w["end"]
        if gap >= min_gap:
            continue
        # Skip if whisper already parked the pause inside a long next word
        if (nxt["end"] - nxt["start"]) > 0.7:
            continue
        mid = int(np.clip(w["end"] * sr, 0, len(mapping) - 1))
        pos = int(mapping[mid])
        if pos < 0:
            continue
        need = int((target - max(gap, 0.0)) * sr)
        if need > int(0.06 * sr):
            inserts.append((pos, need))
    if not inserts:
        return x, mapping
    inserts.sort(key=lambda t: t[0])
    pieces = []
    last = 0
    shift_at = []
    cursor = 0
    for pos, n in inserts:
        pos = int(np.clip(pos, 0, len(x)))
        pieces.append(x[last:pos])
        pad = np.zeros(n, dtype=x.dtype)
        if n > 16:
            fade = min(24, n // 3)
            if last < pos:
                pieces[-1] = pieces[-1].copy()
                if len(pieces[-1]) >= fade:
                    pieces[-1][-fade:] *= np.linspace(1.0, 0.35, fade)
            pad[:fade] *= 0
        pieces.append(pad)
        shift_at.append((pos, n, cursor + (pos - last)))
        cursor += (pos - last) + n
        last = pos
    pieces.append(x[last:])
    y = np.concatenate(pieces) if pieces else x
    new_map = mapping.copy()
    extra = 0
    # Apply from the end so earlier inserts do not move later cut points twice
    for pos, n, _ in reversed(shift_at):
        new_map[mapping >= pos] += n
        extra += n
    return y, new_map


def map_time(mapping, sr, t, prefer="start"):
    i = int(np.clip(round(t * sr), 0, len(mapping) - 1))
    if mapping[i] >= 0:
        return mapping[i] / sr
    if prefer == "start":
        later = np.nonzero(mapping[i:] >= 0)[0]
        if len(later):
            return mapping[i + later[0]] / sr
        earlier = np.nonzero(mapping[:i] >= 0)[0]
        if len(earlier):
            return mapping[earlier[-1]] / sr
    else:
        earlier = np.nonzero(mapping[: i + 1] >= 0)[0]
        if len(earlier):
            return mapping[earlier[-1]] / sr
        later = np.nonzero(mapping[i:] >= 0)[0]
        if len(later):
            return mapping[i + later[0]] / sr
    return t


def tidy_text(words):
    parts = [w["w"] for w in words if w["w"]]
    text = " ".join(parts)
    text = text.replace(" ,", ",").replace(" .", ".").replace(" ?", "?").replace(" !", "!")
    text = text.replace("  ", " ")
    return text.strip()


def encode_mp3(wav_path: Path, dest: Path):
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-af",
            (
                "equalizer=f=160:t=q:w=0.8:g=1.6,"
                "equalizer=f=350:t=q:w=1.0:g=-2.4,"
                "equalizer=f=1200:t=q:w=1.0:g=0.6,"
                "equalizer=f=2700:t=q:w=1.05:g=2.6,"
                "equalizer=f=5000:t=q:w=1.2:g=1.5,"
                "equalizer=f=8500:t=q:w=1.3:g=1.4,"
                "acompressor=threshold=-18dB:ratio=2.3:attack=12:release=160:makeup=2.5,"
                "agate=threshold=0.01:ratio=3.5:attack=4:release=90,"
                "aformat=channel_layouts=stereo,"
                "aecho=0.88:0.75:20|38|58|84|118|160|210:0.18|0.13|0.10|0.07|0.05|0.035|0.02,"
                "haas=side_gain=0.32:middle_source=mid:left_delay=7.5:right_delay=16.5:left_gain=0.96:right_gain=0.92,"
                "loudnorm=I=-16:TP=-1.5:LRA=11,"
                "alimiter=limit=0.94:attack=6:release=60"
            ),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main():
    if not PRO.exists():
        raise SystemExit(f"missing processed wav: {PRO}")
    x, sr = sf.read(str(PRO), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = x.astype(np.float64)
    x = spectral_gate(x, sr)
    raw = load_raw_words()
    words = caption_words(raw)

    x_cut, map_cut = apply_cuts(x, sr)
    x_comp, map_comp = compress_long_gaps(x_cut, sr, keep=0.42, min_gap=0.95)
    mapping = compose_maps(map_cut, map_comp)
    x_out, mapping = insert_sentence_pauses(x_comp, sr, words, mapping)

    STAGE.mkdir(parents=True, exist_ok=True)
    for old in STAGE.glob("*"):
        old.unlink()

    texts = {}
    words_map = {}
    lead = np.zeros(int(sr * 0.07))
    tail = np.zeros(int(sr * 0.58))

    for sid, t0, t1 in SECTIONS:
        chunk = [w for w in words if t0 - 0.02 <= ((w["start"] + w["end"]) / 2) <= t1 + 0.02]
        if not chunk:
            raise SystemExit(f"no words for {sid}")
        a = map_time(mapping, sr, max(0.0, chunk[0]["start"] - 0.10), "start")
        b = map_time(mapping, sr, chunk[-1]["end"] + 0.14, "end")
        ia, ib = int(a * sr), int(b * sr)
        ia = max(0, ia)
        ib = min(len(x_out), max(ia + int(0.2 * sr), ib))
        clip = fade_edges(x_out[ia:ib], sr, ms=22)
        clip = np.concatenate([lead, clip, tail])
        peak = float(np.max(np.abs(clip)) + 1e-9)
        if peak > 0.95:
            clip *= 0.90 / peak
        wav_tmp = STAGE / f"{sid}.wav"
        dest = STAGE / f"{sid}.mp3"
        sf.write(str(wav_tmp), clip.astype(np.float32), sr)
        encode_mp3(wav_tmp, dest)
        wav_tmp.unlink()
        rel = []
        for w in chunk:
            ws = map_time(mapping, sr, w["start"], "start") - a + 0.07
            rel.append({"t": round(max(0.0, ws), 3), "w": w["w"]})
        texts[sid] = tidy_text(chunk)
        words_map[sid] = rel
        print(f"{sid:12} { (ib - ia) / sr:5.1f}s  {dest.stat().st_size:7d}B  words={len(rel)}")
        print("   ", texts[sid][:160])

    pack = {
        "years": max(1, round((date.today() - date(2018, 9, 1)).days / 365.25)),
        "source": "kapilaudio.wav",
        "texts": texts,
        "words": words_map,
    }
    (STAGE / "words.json").write_text(json.dumps(pack, indent=2) + "\n")

    OUT.mkdir(parents=True, exist_ok=True)
    for item in STAGE.iterdir():
        shutil.copy2(item, OUT / item.name)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
