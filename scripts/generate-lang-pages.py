#!/usr/bin/env python3
"""Regenerate /{lang}/index.html from root index.html. Single source of truth."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ["en", "de", "fr", "es", "ja", "ar", "hi"]
REL_PREFIXES = (
    "assets/",
    "css/",
    "js/",
    "icons/",
    "for/",
    "tools/",
    "favicon.ico",
    "site.webmanifest",
    "browserconfig.xml",
)


def prefix_paths(html: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attr, quote, val = match.group(1), match.group(2), match.group(3)
        if val.startswith(("http://", "https://", "#", "mailto:", "tel:", "/", "../", "data:")):
            return match.group(0)
        if any(val == prefix or val.startswith(prefix) for prefix in REL_PREFIXES):
            return f"{attr}={quote}../{val}{quote}"
        return match.group(0)

    return re.sub(r'\b(href|src|content)=(["\'])([^"\']+)\2', repl, html)


def main() -> None:
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    marker = "window.__LANG=window.__LANG||undefined;"
    if marker not in src:
        raise SystemExit("index.html is missing the __LANG bootstrap script")
    for lang in LANGS:
        html = src.replace(marker, f'window.__LANG="{lang}";window.__I18N_BASE="../";', 1)
        html = prefix_paths(html)
        out = ROOT / lang / "index.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
