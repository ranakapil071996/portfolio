#!/usr/bin/env python3
"""Generate 'Hello {company}' clips for company-page story mode."""
import asyncio
from pathlib import Path

from edge_tts import Communicate

ROOT = Path(__file__).resolve().parents[1] / "assets" / "story-voice" / "hello"
VOICE = "en-IN-PrabhatNeural"
RATE = "+8%"

# Spoken form for TTS; filename uses the company slug.
NAMES = {
    "wolt": "Wolt",
    "bolt": "Bolt",
    "zalando": "Zalando",
    "delivery-hero": "Delivery Hero",
    "aviv": "Aviv",
    "flink": "Flink",
    "home24": "Home 24",
    "otto": "Otto",
    "xxxlutz": "XXX Lutz",
    "amazon": "Amazon",
    "langdock": "Langdock",
    "hometogo": "Home To Go",
    "trade-republic": "Trade Republic",
    "contentful": "Contentful",
    "revolut": "Revolut",
    "taxfix": "Taxfix",
    "wise": "Wise",
    "n8n": "n8n",
}


def line(spoken):
    return (
        f"Hello {spoken}. This is assistance mode. "
        "Kapil will now walk you through the resume in his own voice."
    )


async def render(slug, spoken):
    dest = ROOT / f"{slug}.mp3"
    last = None
    for _ in range(3):
        try:
            comm = Communicate(line(spoken), VOICE, rate=RATE)
            await comm.save(str(dest))
            print(slug, dest.stat().st_size)
            return
        except Exception as err:
            last = err
            await asyncio.sleep(1.2)
    raise last


async def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    for slug, spoken in NAMES.items():
        await render(slug, spoken)


if __name__ == "__main__":
    asyncio.run(main())
