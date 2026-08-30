#!/usr/bin/env python3
"""Build Kapil_Rana_Resume.pdf from the same story as the website.

Years of experience are computed from career start (2018-09-01), matching
js/main.js and the hero counters.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "js" / "resume-data.json"
OUTS = [
    ROOT / "Kapil_Rana_Resume.pdf",
    ROOT / "assets" / "Kapil_Rana_Resume.pdf",
]
CAREER_START = date(2018, 9, 1)

INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#334155")
RULE = colors.HexColor("#2563eb")


def years_exp(today: date | None = None) -> int:
    today = today or date.today()
    days = (today - CAREER_START).days
    return max(1, round(days / 365.25))


def styles():
    return {
        "name": ParagraphStyle(
            "name",
            fontName="Times-Bold",
            fontSize=16.5,
            leading=18.5,
            textColor=INK,
            spaceAfter=1,
        ),
        "title": ParagraphStyle(
            "title",
            fontName="Times-Italic",
            fontSize=10,
            leading=13,
            textColor=INK,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "contact",
            fontName="Times-Roman",
            fontSize=8.5,
            leading=11,
            textColor=MUTED,
            spaceAfter=0,
        ),
        "h": ParagraphStyle(
            "h",
            fontName="Times-Bold",
            fontSize=9.2,
            leading=12,
            textColor=INK,
            spaceBefore=3.2,
            spaceAfter=1,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Times-Roman",
            fontSize=8.5,
            leading=10.6,
            textColor=INK,
            alignment=TA_JUSTIFY,
        ),
        "job": ParagraphStyle(
            "job",
            fontName="Times-Bold",
            fontSize=9,
            leading=11.4,
            textColor=INK,
        ),
        "meta": ParagraphStyle(
            "meta",
            fontName="Times-Italic",
            fontSize=8.4,
            leading=11,
            textColor=MUTED,
        ),
        "dates": ParagraphStyle(
            "dates",
            fontName="Times-Bold",
            fontSize=8.4,
            leading=11,
            textColor=INK,
            alignment=TA_RIGHT,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="Times-Roman",
            fontSize=8.35,
            leading=10.4,
            textColor=INK,
            leftIndent=10,
            bulletIndent=0,
            alignment=TA_LEFT,
        ),
        "impactCo": ParagraphStyle(
            "impactCo",
            fontName="Times-Bold",
            fontSize=8.6,
            leading=11,
            textColor=INK,
            spaceBefore=1,
        ),
        "skill": ParagraphStyle(
            "skill",
            fontName="Times-Roman",
            fontSize=8.3,
            leading=10.3,
            textColor=INK,
        ),
    }


def hr():
    return HRFlowable(width="100%", thickness=0.7, color=RULE, spaceBefore=0.5, spaceAfter=2)


def job_head(s, company, location, dates, role):
    left = Paragraph(f"{company} · {location}", s["job"])
    right = Paragraph(dates, s["dates"])
    row = Table([[left, right]], colWidths=[135 * mm, 50 * mm])
    row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return KeepTogether([row, Paragraph(role, s["meta"])])


def load_data():
    raw = json.loads(DATA.read_text())
    y = years_exp()

    def fill(value):
        if isinstance(value, str):
            return value.replace("{years}", str(y))
        if isinstance(value, list):
            return [fill(v) for v in value]
        if isinstance(value, dict):
            return {k: fill(v) for k, v in value.items()}
        return value

    return fill(raw), y


def strip_html(text: str) -> str:
    text = text.replace("&amp;", "&").replace("&nbsp;", " ")
    text = re.sub(r"</?(strong|b|em|i)>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text


def bullets(s, items):
    return [Paragraph(f"•  {strip_html(item)}", s["bullet"]) for item in items]


def story(s, data: dict):
    summary = strip_html(data.get("summary") or "").replace(
        f"{years_exp()}+ years", f"<b>{years_exp()}+ years</b>"
    )
    out = [
        Paragraph(data["name"], s["name"]),
        Paragraph(data.get("title") or "", s["title"]),
        Paragraph(
            f"{data.get('location','')}  ·  "
            f"<link href='mailto:{data.get('email','')}'>{data.get('email','')}</link>  ·  "
            f"{data.get('phone','')}  ·  "
            f"<link href='{data.get('linkedin','')}'>{data.get('linkedinLabel','')}</link>",
            s["contact"],
        ),
        Paragraph("PROFESSIONAL SUMMARY", s["h"]),
        hr(),
        Paragraph(summary, s["body"]),
        Paragraph("TECHNICAL SKILLS", s["h"]),
        hr(),
    ]
    for group in data.get("skillGroups") or []:
        out.append(
            Paragraph(
                f"<b>{group['label']}:</b> {group['value']}",
                s["skill"],
            )
        )

    out += [Paragraph("PROFESSIONAL EXPERIENCE", s["h"]), hr()]
    for job in data.get("experience") or []:
        out.append(
            job_head(
                s,
                job["company"],
                job.get("locationFull") or job.get("location") or "",
                job.get("dates") or "",
                job.get("role") or "",
            )
        )
        items = job.get("bullets") or []
        # Keep the one-page PDF readable; full bullets live on the site.
        cap = 5 if job.get("current") else 3
        out.extend(bullets(s, items[:cap]))

    out += [Paragraph("BUSINESS &amp; TECH IMPACT", s["h"]), hr()]
    for imp in data.get("impact") or []:
        summary_bits = imp.get("impactSummary") or {}
        out.append(Paragraph(imp.get("company") or "", s["impactCo"]))
        if summary_bits.get("business"):
            out.append(
                Paragraph(f"<b>Business:</b> {summary_bits['business']}", s["skill"])
            )
        if summary_bits.get("tech"):
            out.append(Paragraph(f"<b>Tech:</b> {summary_bits['tech']}", s["skill"]))

    edu = data.get("education") or {}
    out += [
        Paragraph("EDUCATION", s["h"]),
        hr(),
        Paragraph(
            f"<b>{edu.get('school','')}</b> · {edu.get('location','')} · "
            f"{edu.get('degree','')} · {edu.get('dates','')}",
            s["skill"],
        ),
    ]
    return out


def build(path: Path, data: dict, y: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=13 * mm,
        rightMargin=13 * mm,
        topMargin=9 * mm,
        bottomMargin=8 * mm,
        title=f"{data.get('name','Resume')} — Resume ({y}+ years)",
        author=data.get("name") or "Kapil Rana",
        subject="SDE III Software Engineer resume",
    )
    doc.build(story(styles(), data))


def main() -> None:
    data, y = load_data()
    for path in OUTS:
        build(path, data, y)
        print("wrote", path, f"({y}+ years)")


if __name__ == "__main__":
    main()
