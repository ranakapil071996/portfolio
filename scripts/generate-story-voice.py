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
            "Hi, I'm Kapil Rana. I'm a Senior Manager and SDE III at Airtel Payments Bank. I'll walk you through this portfolio the way I would in an interview: impact first, then the technology.",
        ),
        (
            "positioning",
            f"I have {y} years of full-stack experience in React, Next.js, TypeScript, Node.js, and React Native. I lead Internet Banking for about a million users a day, and I manage a team of four. I have shipped products across five companies, mostly in fintech and commerce.",
        ),
        (
            "impact",
            "I organize each role by business impact and technical impact. First, what changed for users and revenue. Then the stack that made it possible. Let's start with Airtel, my current role.",
        ),
        (
            "airtel",
            "At Airtel, I own the Internet Banking experience under RBI compliance. We improved page speed with Next.js server-side rendering, Cloudflare caching, and Core Web Vitals work. We reduced bot abuse with Cloudflare security and Google reCAPTCHA. I also own a NestJS backend on Node.js. In front of that service I run a Kong gateway for load balancing, with plugins for CORS, JWT, and rate limiting. On the content side, Next.js and Prismic sit on a Node.js Prismic service I built. In production I use Kibana and Grafana.",
        ),
        (
            "dotpe",
            "Before Airtel I was a Software Engineer II at DotPe, from 2021 to 2025. I led four engineers on merchant billing: invoicing, inventory, GST, and analytics. Food ordering reached fifty thousand daily users and over one crore rupees a day. I built the React Native waiter app and owned the Node.js backend behind it — APIs, order sync, and offline-ready flows. We also shipped real-time chat with Socket.io and Firebase.",
        ),
        (
            "tyroo",
            "At Tyroo I built the video template UI in React, Redux, and Ant Design. I also owned the video generation backend: a Node.js and Lottie service that rendered marketing videos at scale.",
        ),
        (
            "meddo",
            "At Meddo Health I built the React Native patient app and the doctor app, plus the web product. Those apps covered video consults, chat, EMR, and lab booking. I also wrote Node.js APIs for Google Auth, bulk upload, and media.",
        ),
        (
            "lotto",
            "My first role was at Skill and Lotto. I built an online lottery platform and back-office tools with JavaScript, jQuery, PHP, and Bootstrap.",
        ),
        (
            "about",
            "Day to day I run the team in Jira: planning, priorities, and delivery. I keep a high bar on React and TypeScript quality. I own Node.js and NestJS services, and I work with other engineers on API contracts. After we ship, I stay in the logs and dashboards — Kibana, Grafana, and Kong.",
        ),
        (
            "exp-airtel",
            "This is the full Airtel role. I lead four engineers. We ship Next.js with Prismic, a NestJS backend, and Kong for load balancing, JWT, CORS, and rate limiting. Page speed comes from server-side rendering, Cloudflare caching, and Web Vitals. I own this surface end to end, not just tickets.",
        ),
        (
            "exp-dotpe",
            "DotPe is the multi-product chapter: billing, WhatsApp marketing, live chat, the React Native waiter app, and the Node.js service behind it. It was revenue-linked work across web, mobile, and backend.",
        ),
        (
            "skills",
            "Skills are grouped into frontend, backend, mobile, DevOps, and leadership. React and TypeScript are the core. On the backend I have owned NestJS and Node services for Prismic, the waiter app, and video generation. On mobile: waiter, patient, and doctor apps in React Native. Then Express, MongoDB, SQL, AWS, Docker, Kong, Kibana, and Grafana.",
        ),
        (
            "education",
            "I completed a B.Tech in Computer Science at K.R. Mangalam University, from 2014 to 2018. Since then I have worked at product companies in Gurgaon.",
        ),
        (
            "close",
            "That's the walkthrough. If you'd like to talk, email or LinkedIn is easiest. You can also download the PDF. Restart this anytime from the avatar.",
        ),
    ]


async def render(sid, text, attempts=3):
    last_err = None
    for attempt in range(attempts):
        try:
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
            if not audio:
                raise RuntimeError("empty audio")
            dest = OUT / f"{sid}.mp3"
            dest.write_bytes(bytes(audio))
            return sid, text, words, dest.stat().st_size
        except Exception as err:
            last_err = err
            await asyncio.sleep(1.2 * (attempt + 1))
    raise last_err


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
