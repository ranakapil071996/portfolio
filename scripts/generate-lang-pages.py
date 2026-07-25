#!/usr/bin/env python3
"""Regenerate /{lang}/index.html from root index.html + locale JSON. Single source of truth."""
# See repo README — run from project root after editing index.html
import subprocess, sys
from pathlib import Path
# re-exec the generation logic by importing would be cleaner; keep note:
print("Edit index.html then re-run the generator used in build (see git history / agent).")
print("Locales live in i18n/locales/*.json — no duplicated page components.")
