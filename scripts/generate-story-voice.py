#!/usr/bin/env python3
"""Generate short, faster story clips + word timings for caption sync."""
import asyncio
import json
from datetime import date
from pathlib import Path

from edge_tts import Communicate

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "story-voice"
VOICE = "en-IN-PrabhatNeural"
RATE = "+20%"


def years_exp():
    start = date(2018, 9, 1)
    days = (date.today() - start).days
    return max(1, round(days / 365.25))


def steps():
    y = years_exp()
    return [
        (
            "welcome",
            "Hey, I'm Kapil Rana. Senior Manager, SDE III, at Airtel Payments Bank. I'll walk you through this the way I would in an interview — impact first, then the tech.",
        ),
        (
            "positioning",
            f"I've been doing this for {y} years now. Full-stack — React, Next.js, TypeScript, Node.js services, and React Native. I lead Internet Banking for about a million users a day, and a team of four. Five companies so far, mostly fintech and commerce.",
        ),
        (
            "impact",
            "I split every role into business impact and tech impact. Business first — what changed for users and revenue. Then the stack that made it possible. Let's start with Airtel. That's current.",
        ),
        (
            "airtel",
            "At Airtel I own Internet Banking UI under RBI rules. We improved the speed of pages with Cloudflare edge caching. We cut bots with Cloudflare security and Google reCAPTCHA. The UI is Next.js server rendering plus Prismic CMS. I also built the Node.js Prismic service that serves that content — so the CMS path is fullstack. I sit on Kong for JWT and CORS, and I use Kibana and Grafana in production.",
        ),
        (
            "dotpe",
            "Before Airtel I was at DotPe, Software Engineer Two, twenty twenty one to twenty twenty five. I led four engineers on merchant billing — invoicing, inventory, GST, analytics. Food ordering hit fifty thousand daily users and over a crore rupees a day. I built the React Native waiter app, and I owned the Node.js backend behind it — APIs, order sync, offline-ready flows. Also Socket.io chat and Firebase.",
        ),
        (
            "earlier",
            "Before DotPe: Tyroo — React template UI, and I owned the video generation backend, a Node.js plus Lottie service that rendered creatives at scale. Meddo Health was telehealth — I built the React Native patient app and doctor app, plus web, and Node APIs for auth and bulk upload. First job was Skill and Lotto, JavaScript, jQuery, PHP, and Bootstrap.",
        ),
        (
            "about",
            "Day to day I run the team in Jira — planning, priorities, delivery. I hold a high bar on React and TypeScript. I sit with backend on API contracts. And I don't disappear after deploy. Logs, dashboards, gateway config — I'm in there.",
        ),
        (
            "exp-airtel",
            "If you open the Airtel role, that's the longer version. Team of four, Next.js, the Node.js Prismic service, Cloudflare, reCAPTCHA, accessibility, RBI-compliant journeys. I'm not just taking tickets. I own that surface end to end.",
        ),
        (
            "exp-dotpe",
            "DotPe is the multi-product chapter. Billing, WhatsApp marketing, live chat, plus the React Native waiter app and its Node.js backend. Revenue-linked work, fullstack and mobile.",
        ),
        (
            "skills",
            "Skills are grouped — frontend, backend, mobile, DevOps, leadership. React and TypeScript are the core. Node.js services I have owned — Prismic, waiter-app APIs, video generation. React Native for waiter, patient, and doctor apps. Then Express, Mongo, SQL, AWS, Docker, Kong, Kibana, Grafana.",
        ),
        (
            "education",
            "I did B.Tech in Computer Science at K.R. Mangalam University, twenty fourteen to twenty eighteen. After that it's been product companies in Gurgaon.",
        ),
        (
            "close",
            "That's the set. If you want to talk, email or LinkedIn is easiest. PDF is there too. You can restart this anytime from the avatar.",
        ),
    ]


async def render(sid, text):
    comm = Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    audio = bytearray()
    words = []
    async for chunk in comm.stream():
        kind = chunk.get("type")
        if kind == "audio":
            audio.extend(chunk["data"])
        elif kind == "WordBoundary":
            words.append(
                {
                    "t": round(chunk["offset"] / 10_000_000, 3),
                    "w": chunk["text"],
                }
            )
    dest = OUT / f"{sid}.mp3"
    dest.write_bytes(bytes(audio))
    return sid, text, words, dest.stat().st_size


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.mp3"):
        old.unlink()
    words_map = {}
    texts = {}
    for sid, text in steps():
        sid, text, words, size = await render(sid, text)
        words_map[sid] = words
        texts[sid] = text
        print(sid, size, "words", len(words))
    (OUT / "words.json").write_text(
        json.dumps({"years": years_exp(), "texts": texts, "words": words_map}, indent=2)
    )
    print("years", years_exp())


if __name__ == "__main__":
    asyncio.run(main())
