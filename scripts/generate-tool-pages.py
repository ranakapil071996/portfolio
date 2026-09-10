#!/usr/bin/env python3
"""Write /tools/ hub + calculator HTML shells (SEO head + crawlable body)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://kapilrana.dev"

ICON_EMI = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z"/></svg>"""
ICON_SIP = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16M6 16l4.2-5.2 3.2 2.6L18 8"/><path d="M15 8h3v3"/></svg>"""
ICON_GST = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9.2 13.2h2.2a1.4 1.4 0 0 0 0-2.8H9.8A1.4 1.4 0 0 0 9.8 17h2.2"/><path d="m15.4 11.2-3.6 6.4"/></svg>"""
ICON_RUPEE = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 6h10M7 10h10M7 6c4.5 0 7 2 7 5.5S13 17 7 17M11 21 7 17"/></svg>"""
ICON_PCT = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="m18 6-12 12"/></svg>"""
ICON_CAL = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3.5V7M16 3.5V7M3.5 10h17"/></svg>"""
ICON_BILL = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10a1 1 0 0 1 1 1v16l-2.2-1.4L13.6 20 12 18.6 10.4 20 8.2 18.6 6 20V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>"""


def ambient() -> str:
    return """  <div class="tool-ambient" aria-hidden="true">
    <span class="tool-orb tool-orb-a"></span>
    <span class="tool-orb tool-orb-b"></span>
    <span class="tool-orb tool-orb-c"></span>
  </div>
"""


def theme_script() -> str:
    return """<script>
    (function () {
      try {
        var t = localStorage.getItem("theme");
        if (t !== "light" && t !== "dark") t = "dark";
        document.documentElement.setAttribute("data-theme", t);
      } catch (e) {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    })();
  </script>"""


def nav(home: str, tools: dict[str, str]) -> str:
    return f"""  <header class="nav" id="nav" role="banner">
    <a class="nav-logo" href="{home}" aria-label="Kapil Rana — home" data-i18n-aria="nav.home">
      <span class="logo-mark" aria-hidden="true">KR</span>
      <span class="logo-text">Kapil Rana</span>
    </a>
    <nav class="nav-links" id="nav-links" aria-label="Primary">
      <div class="nav-item has-menu" id="nav-tools">
        <button type="button" class="nav-menu-btn" id="nav-tools-btn" aria-expanded="false" aria-haspopup="true" aria-controls="nav-tools-panel" data-i18n="nav.tools">Tools</button>
        <div class="nav-menu" id="nav-tools-panel" hidden>
          <p class="nav-menu-cat" data-i18n="tools.categories.finance.title">Finance</p>
          <a href="{tools["emi"]}" data-tool="emi" data-i18n="tools.emi.nav">EMI Calculator</a>
          <a href="{tools["sip"]}" data-tool="sip" data-i18n="tools.sip.nav">SIP Calculator</a>
          <a href="{tools["gst"]}" data-tool="gst" data-i18n="tools.gst.nav">GST Calculator</a>
          <a href="{tools["billing"]}" data-tool="billing" data-i18n="tools.billing.nav">Billing</a>
          <a href="{tools["hub"]}" class="nav-menu-all" data-tool="hub" data-i18n="nav.allTools">All tools</a>
        </div>
      </div>
      <a href="{home}" data-i18n="companyUi.portfolio">Portfolio</a>
    </nav>
    <div class="nav-actions">
      <div class="lang-switcher" id="lang-switcher"></div>
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle light and dark mode" title="Toggle theme">
        <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1110.5 3a7 7 0 0010.5 11.5z"/>
        </svg>
      </button>
      <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>"""


def head(
    *,
    base: str,
    tool_id: str,
    title: str,
    description: str,
    canonical: str,
    json_ld: str,
) -> str:
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <script>window.__LANG=window.__LANG||undefined;window.__I18N_BASE="{base}";window.__I18N_KEEP_HEAD=true;window.__TOOL_ID="{tool_id}";</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="{canonical}" id="canonical-link" />
  <link rel="icon" href="{base}favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="{base}icons/apple-touch-icon.png" />
  <link rel="manifest" href="{base}site.webmanifest" />
  <meta name="theme-color" content="#050816" id="meta-theme-color" />
  <meta name="color-scheme" content="dark light" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{title}" id="og-title" />
  <meta property="og:description" content="{description}" id="og-description" />
  <meta property="og:url" content="{canonical}" id="og-url" />
  <meta property="og:image" content="{SITE}/assets/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" id="twitter-title" />
  <meta name="twitter:description" content="{description}" id="twitter-description" />
  <meta name="twitter:image" content="{SITE}/assets/og-image.jpg" />
  <link rel="stylesheet" href="{base}css/styles.css" />
  <link rel="stylesheet" href="{base}css/tools.css" />
  {theme_script()}
  {json_ld}
</head>
"""


def footer(home: str, extra_js: str | list[str] = "") -> str:
    extras = extra_js if isinstance(extra_js, list) else ([extra_js] if extra_js else [])
    extra = "".join(f'  <script src="{home}{src}" defer></script>\n' for src in extras)
    return f"""  <footer class="footer" role="contentinfo">
    <div class="container footer-inner">
      <p><span data-i18n="footer.copy">© {{year}} Kapil Rana.</span></p>
      <a href="{home}" data-i18n="companyUi.portfolio">Portfolio</a>
    </div>
  </footer>
  <script src="{home}js/i18n.js" defer></script>
  <script src="{home}js/tools-data.js" defer></script>
  <script src="{home}js/tools-nav.js" defer></script>
  <script src="{home}js/tools.js" defer></script>
{extra}
</body>
</html>
"""


def faq_block(prefix: str, items: list[tuple[str, str]]) -> str:
    bits = [
        '    <section class="tool-faq" aria-labelledby="faq-heading">',
        '      <h2 id="faq-heading" data-i18n="tools.common.faq">Frequently asked questions</h2>',
    ]
    for i, (q, a) in enumerate(items):
        bits.append("      <details>")
        bits.append(f'        <summary data-i18n="{prefix}.faq.{i}.q">{q}</summary>')
        bits.append(f'        <p data-i18n="{prefix}.faq.{i}.a">{a}</p>')
        bits.append("      </details>")
    bits.append("    </section>")
    return "\n".join(bits)


def related(links: list[tuple[str, str, str]]) -> str:
    icons = {
        "tools.emi.title": ("hub-icon-emi", ICON_EMI),
        "tools.sip.title": ("hub-icon-sip", ICON_SIP),
        "tools.gst.title": ("hub-icon-gst", ICON_GST),
        "tools.billing.title": ("hub-icon-bill", ICON_BILL),
    }
    cards = []
    for href, title_key, title in links:
        cls, svg = icons.get(title_key, ("hub-icon-emi", ICON_EMI))
        cards.append(
            f'        <a class="hub-card glass hub-card-mini" href="{href}"><span class="hub-icon {cls}" aria-hidden="true">{svg}</span><strong data-i18n="{title_key}">{title}</strong><span class="hub-go" data-i18n="tools.common.open">Open calculator →</span></a>'
        )
    return f"""    <section class="tool-related" aria-labelledby="related-heading">
      <h2 id="related-heading" data-i18n="tools.common.related">More finance tools</h2>
      <div class="hub-cards">
{chr(10).join(cards)}
      </div>
    </section>"""


def json_ld_app(name: str, url: str, description: str, faqs: list[tuple[str, str]]) -> str:
    payload = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebApplication",
                "name": name,
                "url": url,
                "description": description,
                "applicationCategory": "FinanceApplication",
                "operatingSystem": "Any",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"},
                "author": {"@type": "Person", "name": "Kapil Rana", "url": f"{SITE}/"},
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
                    {"@type": "ListItem", "position": 2, "name": "Tools", "item": f"{SITE}/tools/"},
                    {"@type": "ListItem", "position": 3, "name": name, "item": url},
                ],
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faqs
                ],
            },
        ],
    }
    dumped = json.dumps(payload, ensure_ascii=False, indent=2)
    return f'  <script type="application/ld+json">\n  {dumped}\n  </script>'


EMI_FAQ = [
    (
        "What is EMI?",
        "EMI (Equated Monthly Instalment) is the fixed amount you pay every month toward a loan. It includes both principal and interest.",
    ),
    (
        "How is EMI calculated?",
        "EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the loan amount, r is the monthly interest rate, and n is the number of months.",
    ),
    (
        "Does a shorter tenure reduce interest?",
        "Yes. A shorter tenure raises the monthly EMI but usually cuts total interest because the principal is repaid faster.",
    ),
    (
        "Is this EMI calculator free?",
        "Yes. This online EMI calculator is free, runs in your browser, and does not store the numbers you enter.",
    ),
]

SIP_FAQ = [
    (
        "What is a SIP?",
        "A Systematic Investment Plan (SIP) invests a fixed amount at regular intervals — usually monthly — into a mutual fund.",
    ),
    (
        "How is SIP maturity calculated?",
        "Future value = M × [((1+i)^n − 1) / i] × (1+i), where M is the monthly investment, i is the monthly expected return, and n is the number of months.",
    ),
    (
        "Are SIP returns guaranteed?",
        "No. The expected return is an assumption. Actual mutual-fund returns vary with markets.",
    ),
    (
        "SIP vs lump sum — which is better?",
        "SIP spreads purchases over time and can reduce timing risk. A lump sum may earn more if invested just before a long uptrend. This calculator models a monthly SIP only.",
    ),
]

GST_FAQ = [
    (
        "What is GST?",
        "Goods and Services Tax is India’s destination-based indirect tax. Most goods and services fall under 0%, 5%, 12%, 18%, or 28%.",
    ),
    (
        "What is the difference between exclusive and inclusive GST?",
        "Exclusive adds GST on top of a base price. Inclusive extracts GST from a price that already contains tax: base = amount / (1 + rate/100).",
    ),
    (
        "CGST + SGST vs IGST?",
        "Intra-state supply splits GST equally into CGST and SGST. Inter-state supply uses a single IGST amount equal to the full GST.",
    ),
    (
        "Does this GST calculator file returns?",
        "No. It only estimates tax on a given amount. Use it to check invoices — it is not a substitute for GST filing software or a tax advisor.",
    ),
]


def write_hub() -> None:
    canonical = f"{SITE}/tools/"
    json_ld = f"""  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Free finance tools — EMI, SIP, GST calculators",
    "url": "{canonical}",
    "description": "Free online finance calculators: EMI, SIP, and GST. Built by Kapil Rana.",
    "isPartOf": {{ "@type": "WebSite", "name": "Kapil Rana Portfolio", "url": "{SITE}/" }}
  }}
  </script>"""
    html = head(
        base="../",
        tool_id="hub",
        title="Free Finance Tools — EMI, SIP & GST Calculators | Kapil Rana",
        description="Free online finance calculators: EMI calculator for home and personal loans, SIP calculator for mutual funds, and GST calculator for India. No signup.",
        canonical=canonical,
        json_ld=json_ld,
    )
    html += "<body class=\"tools-page\">\n"
    html += '  <a class="skip-link" href="#main-content" data-i18n="nav.skip">Skip to main content</a>\n'
    html += ambient()
    html += nav(
        "../",
        {
            "emi": "emi-calculator/",
            "sip": "sip-calculator/",
            "gst": "gst-calculator/",
            "billing": "billing/",
            "hub": "./",
        },
    )
    html += f"""
  <main class="tool-main" id="main-content" tabindex="-1">
    <nav class="tool-crumb" aria-label="Breadcrumb">
      <a href="../" data-i18n="tools.common.home">Home</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page" data-i18n="nav.tools">Tools</span>
    </nav>
    <header class="tool-hero tool-hero-wide">
      <p class="tool-kicker" data-i18n="tools.hub.kicker">Free calculators</p>
      <h1 data-i18n="tools.hub.title">Finance tools</h1>
      <p class="tool-lead" data-i18n="tools.hub.lead">Fast, private calculators for loans, investments, and GST. Everything runs in your browser — useful if you are comparing a home loan, planning a SIP, or checking an invoice.</p>
    </header>
    <section class="hub-cats" aria-labelledby="finance-heading">
      <div class="hub-cat">
        <h2 id="finance-heading" data-i18n="tools.categories.finance.title">Finance</h2>
        <p class="hub-cat-blurb" data-i18n="tools.categories.finance.blurb">Loan EMI, SIP wealth projection, and India GST — built for everyday money decisions.</p>
        <div class="hub-cards">
          <a class="hub-card glass" href="emi-calculator/">
            <span class="hub-icon hub-icon-emi" aria-hidden="true">{ICON_EMI}</span>
            <strong data-i18n="tools.emi.title">EMI Calculator</strong>
            <p data-i18n="tools.emi.card">Monthly instalment, total interest, and a year-wise amortization schedule for home, car, and personal loans.</p>
            <span class="hub-go" data-i18n="tools.common.open">Open calculator →</span>
          </a>
          <a class="hub-card glass" href="sip-calculator/">
            <span class="hub-icon hub-icon-sip" aria-hidden="true">{ICON_SIP}</span>
            <strong data-i18n="tools.sip.title">SIP Calculator</strong>
            <p data-i18n="tools.sip.card">Estimate the future value of a monthly systematic investment plan with expected returns.</p>
            <span class="hub-go" data-i18n="tools.common.open">Open calculator →</span>
          </a>
          <a class="hub-card glass" href="gst-calculator/">
            <span class="hub-icon hub-icon-gst" aria-hidden="true">{ICON_GST}</span>
            <strong data-i18n="tools.gst.title">GST Calculator</strong>
            <p data-i18n="tools.gst.card">Add or remove GST at 5%, 12%, 18%, or 28%. Split CGST/SGST or apply IGST.</p>
            <span class="hub-go" data-i18n="tools.common.open">Open calculator →</span>
          </a>
          <a class="hub-card glass" href="billing/">
            <span class="hub-icon hub-icon-bill" aria-hidden="true">{ICON_BILL}</span>
            <strong data-i18n="tools.billing.title">Billing</strong>
            <p data-i18n="tools.billing.card">Sign in with your mobile number and set up your business to create GST invoices.</p>
            <span class="hub-go" data-i18n="tools.billing.open">Open billing →</span>
          </a>
        </div>
      </div>
    </section>
    <section class="tool-prose">
      <h2 data-i18n="tools.hub.whyTitle">Why these calculators</h2>
      <p data-i18n="tools.hub.why">These tools use the same standard formulas banks and mutual-fund platforms publish. Inputs stay on your device. Use them to sanity-check a loan offer, a SIP goal, or a GST-inclusive quote before you commit.</p>
    </section>
  </main>
"""
    html += footer("../")
    out = ROOT / "tools" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


def write_emi() -> None:
    canonical = f"{SITE}/tools/emi-calculator/"
    html = head(
        base="../../",
        tool_id="emi",
        title="EMI Calculator — Monthly Loan EMI, Interest & Amortization | Kapil Rana",
        description="Free EMI calculator for home, car, and personal loans in India. Get monthly EMI, total interest, total payment, and a year-wise amortization schedule.",
        canonical=canonical,
        json_ld=json_ld_app(
            "EMI Calculator",
            canonical,
            "Calculate monthly EMI, total interest, and amortization for Indian loans.",
            EMI_FAQ,
        ),
    )
    html += "<body class=\"tools-page\">\n"
    html += '  <a class="skip-link" href="#main-content" data-i18n="nav.skip">Skip to main content</a>\n'
    html += ambient()
    html += nav(
        "../../",
        {
            "emi": "./",
            "sip": "../sip-calculator/",
            "gst": "../gst-calculator/",
            "billing": "../billing/",
            "hub": "../",
        },
    )
    html += f"""
  <main class="tool-main" id="main-content" tabindex="-1">
    <nav class="tool-crumb" aria-label="Breadcrumb">
      <a href="../../" data-i18n="tools.common.home">Home</a>
      <span aria-hidden="true">/</span>
      <a href="../" data-i18n="nav.tools">Tools</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page" data-i18n="tools.emi.nav">EMI Calculator</span>
    </nav>
    <header class="tool-hero">
      <span class="tool-hero-icon hub-icon-emi" aria-hidden="true">{ICON_EMI}</span>
      <p class="tool-kicker" data-i18n="tools.categories.finance.title">Finance</p>
      <h1 data-i18n="tools.emi.title">EMI Calculator</h1>
      <p class="tool-lead" data-i18n="tools.emi.lead">Work out the equated monthly instalment for a home loan, car loan, or personal loan. Change principal, interest rate, and tenure to see EMI, total interest, and a year-wise payoff schedule.</p>
    </header>
    <div class="tool-grid">
      <form class="tool-card glass tool-card-in" id="emi-form" onsubmit="return false;">
        <h2 data-i18n="tools.common.inputs">Inputs</h2>
        <div class="tool-field">
          <label for="emi-amount" data-i18n="tools.emi.amount">Loan amount (₹)</label>
          <div class="tool-input">{ICON_RUPEE}<input id="emi-amount" name="amount" type="number" inputmode="decimal" min="0" step="1000" value="1000000" /></div>
          <input class="tool-range" id="emi-amount-range" type="range" min="10000" max="20000000" step="10000" value="1000000" aria-label="Loan amount slider" />
        </div>
        <div class="tool-field">
          <label for="emi-rate" data-i18n="tools.emi.rate">Interest rate (% p.a.)</label>
          <div class="tool-input">{ICON_PCT}<input id="emi-rate" name="rate" type="number" inputmode="decimal" min="0" max="100" step="0.05" value="8.5" /></div>
          <input class="tool-range" id="emi-rate-range" type="range" min="0" max="24" step="0.05" value="8.5" aria-label="Interest rate slider" />
        </div>
        <div class="tool-inline">
          <div class="tool-field">
            <label for="emi-years" data-i18n="tools.emi.years">Tenure (years)</label>
            <div class="tool-input">{ICON_CAL}<input id="emi-years" name="years" type="number" inputmode="numeric" min="0" max="40" step="1" value="20" /></div>
            <input class="tool-range" id="emi-years-range" type="range" min="1" max="40" step="1" value="20" aria-label="Tenure slider" />
          </div>
          <div class="tool-field">
            <label for="emi-months" data-i18n="tools.emi.months">Extra months</label>
            <div class="tool-input">{ICON_CAL}<input id="emi-months" name="months" type="number" inputmode="numeric" min="0" max="11" step="1" value="0" /></div>
          </div>
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="emi-reset" data-i18n="tools.common.reset">Reset</button>
        </div>
        <p class="tool-note" data-i18n="tools.common.disclaimer">Estimates only. Not financial advice. Actual bank EMIs may include fees, insurance, or a different compounding convention.</p>
      </form>
      <section class="tool-card glass tool-card-out" aria-live="polite">
        <div class="tool-result-head">
          <span class="tool-badge hub-icon-emi" aria-hidden="true">{ICON_EMI}</span>
          <h2 data-i18n="tools.emi.resultLabel">Monthly EMI</h2>
        </div>
        <p class="tool-result-value" id="emi-result">₹0</p>
        <p class="tool-result-sub" id="emi-result-sub"></p>
        <div class="tool-viz">
          <div class="tool-donut-wrap">
            <svg class="tool-donut" id="emi-donut" viewBox="0 0 120 120" role="img" aria-label="Principal versus interest"></svg>
            <div class="tool-donut-center">
              <span data-i18n="tools.common.breakdown">Split</span>
              <strong id="emi-donut-label">—</strong>
            </div>
          </div>
          <div class="tool-metrics tool-metrics-stack">
            <div class="tool-metric"><span data-i18n="tools.emi.principal">Principal</span><strong id="emi-principal-out">₹0</strong></div>
            <div class="tool-metric"><span data-i18n="tools.emi.interest">Total interest</span><strong id="emi-interest">₹0</strong></div>
            <div class="tool-metric"><span data-i18n="tools.emi.total">Total payment</span><strong id="emi-total">₹0</strong></div>
          </div>
        </div>
        <div class="tool-legend" id="emi-legend"></div>
        <div class="tool-chart-panel">
          <h3 data-i18n="tools.emi.chartBalance">Balance over time</h3>
          <div class="tool-chart-wrap">
            <svg class="tool-chart" id="emi-chart" viewBox="0 0 360 180" role="img" aria-label="Outstanding balance by year"></svg>
            <div class="tool-tip" id="emi-tip" hidden></div>
          </div>
        </div>
        <div class="tool-table-wrap">
          <table class="tool-table" id="emi-schedule">
            <caption class="nav-menu-cat" data-i18n="tools.emi.schedule">Year-wise amortization</caption>
            <thead>
              <tr>
                <th data-i18n="tools.common.year">Year</th>
                <th data-i18n="tools.emi.principalPaid">Principal paid</th>
                <th data-i18n="tools.emi.interestPaid">Interest paid</th>
                <th data-i18n="tools.emi.balance">Balance</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>
    <section class="tool-prose">
      <h2 data-i18n="tools.common.how">How this EMI calculator works</h2>
      <p data-i18n="tools.emi.how1">The reducing-balance formula used by most Indian lenders is <code>EMI = P × r × (1+r)^n / ((1+r)^n − 1)</code>. <code>P</code> is the loan amount, <code>r</code> is the monthly rate (annual rate ÷ 12 ÷ 100), and <code>n</code> is the tenure in months. If the rate is 0%, EMI is simply principal ÷ months.</p>
      <p data-i18n="tools.emi.how2">Each month, interest is charged on the outstanding principal. The rest of the EMI reduces the balance. That is why early years are interest-heavy and later years are principal-heavy — the table below the result shows that year by year.</p>
    </section>
{faq_block("tools.emi", EMI_FAQ)}
{related([("../sip-calculator/", "tools.sip.title", "SIP Calculator"), ("../gst-calculator/", "tools.gst.title", "GST Calculator")])}
  </main>
"""
    html += footer("../../")
    out = ROOT / "tools" / "emi-calculator" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


def write_sip() -> None:
    canonical = f"{SITE}/tools/sip-calculator/"
    html = head(
        base="../../",
        tool_id="sip",
        title="SIP Calculator — Mutual Fund SIP Returns & Maturity Value | Kapil Rana",
        description="Free SIP calculator for India. Estimate invested amount, expected returns, and maturity value of a monthly systematic investment plan.",
        canonical=canonical,
        json_ld=json_ld_app(
            "SIP Calculator",
            canonical,
            "Estimate future value of a monthly SIP using expected annual returns.",
            SIP_FAQ,
        ),
    )
    html += "<body class=\"tools-page\">\n"
    html += '  <a class="skip-link" href="#main-content" data-i18n="nav.skip">Skip to main content</a>\n'
    html += ambient()
    html += nav(
        "../../",
        {
            "emi": "../emi-calculator/",
            "sip": "./",
            "gst": "../gst-calculator/",
            "billing": "../billing/",
            "hub": "../",
        },
    )
    html += f"""
  <main class="tool-main" id="main-content" tabindex="-1">
    <nav class="tool-crumb" aria-label="Breadcrumb">
      <a href="../../" data-i18n="tools.common.home">Home</a>
      <span aria-hidden="true">/</span>
      <a href="../" data-i18n="nav.tools">Tools</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page" data-i18n="tools.sip.nav">SIP Calculator</span>
    </nav>
    <header class="tool-hero">
      <span class="tool-hero-icon hub-icon-sip" aria-hidden="true">{ICON_SIP}</span>
      <p class="tool-kicker" data-i18n="tools.categories.finance.title">Finance</p>
      <h1 data-i18n="tools.sip.title">SIP Calculator</h1>
      <p class="tool-lead" data-i18n="tools.sip.lead">Project the maturity value of a monthly systematic investment plan. Enter the instalment, expected annual return, and duration to see invested capital versus estimated gains.</p>
    </header>
    <div class="tool-grid">
      <form class="tool-card glass tool-card-in" id="sip-form" onsubmit="return false;">
        <h2 data-i18n="tools.common.inputs">Inputs</h2>
        <div class="tool-field">
          <label for="sip-amount" data-i18n="tools.sip.amount">Monthly investment (₹)</label>
          <div class="tool-input">{ICON_RUPEE}<input id="sip-amount" name="amount" type="number" inputmode="decimal" min="0" step="500" value="10000" /></div>
          <input class="tool-range" id="sip-amount-range" type="range" min="500" max="200000" step="500" value="10000" aria-label="Monthly investment slider" />
        </div>
        <div class="tool-field">
          <label for="sip-rate" data-i18n="tools.sip.rate">Expected return (% p.a.)</label>
          <div class="tool-input">{ICON_PCT}<input id="sip-rate" name="rate" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="12" /></div>
          <input class="tool-range" id="sip-rate-range" type="range" min="1" max="30" step="0.1" value="12" aria-label="Expected return slider" />
        </div>
        <div class="tool-field">
          <label for="sip-years" data-i18n="tools.sip.years">Duration (years)</label>
          <div class="tool-input">{ICON_CAL}<input id="sip-years" name="years" type="number" inputmode="numeric" min="1" max="50" step="1" value="15" /></div>
          <input class="tool-range" id="sip-years-range" type="range" min="1" max="40" step="1" value="15" aria-label="Duration slider" />
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="sip-reset" data-i18n="tools.common.reset">Reset</button>
        </div>
        <p class="tool-note" data-i18n="tools.common.disclaimer">Estimates only. Not financial advice. Mutual-fund returns are not guaranteed and ignore expense ratios, exit loads, and taxes.</p>
      </form>
      <section class="tool-card glass tool-card-out" aria-live="polite">
        <div class="tool-result-head">
          <span class="tool-badge hub-icon-sip" aria-hidden="true">{ICON_SIP}</span>
          <h2 data-i18n="tools.sip.resultLabel">Estimated value</h2>
        </div>
        <p class="tool-result-value" id="sip-value">₹0</p>
        <p class="tool-result-sub" id="sip-result-sub"></p>
        <div class="tool-viz">
          <div class="tool-donut-wrap">
            <svg class="tool-donut" id="sip-donut" viewBox="0 0 120 120" role="img" aria-label="Invested versus returns"></svg>
            <div class="tool-donut-center">
              <span data-i18n="tools.common.breakdown">Split</span>
              <strong id="sip-donut-label">—</strong>
            </div>
          </div>
          <div class="tool-metrics tool-metrics-stack">
            <div class="tool-metric"><span data-i18n="tools.sip.invested">Amount invested</span><strong id="sip-invested">₹0</strong></div>
            <div class="tool-metric"><span data-i18n="tools.sip.gain">Est. returns</span><strong id="sip-gain">₹0</strong></div>
          </div>
        </div>
        <div class="tool-legend" id="sip-legend"></div>
        <div class="tool-chart-panel">
          <h3 data-i18n="tools.sip.chartGrowth">Wealth growth</h3>
          <div class="tool-chart-wrap">
            <svg class="tool-chart" id="sip-chart" viewBox="0 0 360 180" role="img" aria-label="Invested and value by year"></svg>
            <div class="tool-tip" id="sip-tip" hidden></div>
          </div>
        </div>
        <div class="tool-table-wrap">
          <table class="tool-table" id="sip-schedule">
            <caption class="nav-menu-cat" data-i18n="tools.sip.schedule">Year-wise projection</caption>
            <thead>
              <tr>
                <th data-i18n="tools.common.year">Year</th>
                <th data-i18n="tools.sip.invested">Invested</th>
                <th data-i18n="tools.sip.gain">Returns</th>
                <th data-i18n="tools.sip.resultLabel">Value</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>
    <section class="tool-prose">
      <h2 data-i18n="tools.common.how">How this SIP calculator works</h2>
      <p data-i18n="tools.sip.how1">This uses the standard beginning-of-period SIP formula: <code>FV = M × [((1+i)^n − 1) / i] × (1+i)</code>. <code>M</code> is the monthly instalment, <code>i</code> is the monthly expected return, and <code>n</code> is the number of months. A 12% annual assumption becomes 1% per month.</p>
      <p data-i18n="tools.sip.how2">The invested amount is simply instalment × months. Estimated returns are future value minus invested amount. Markets do not compound in a straight line — treat the chart as a planning range, not a promise.</p>
    </section>
{faq_block("tools.sip", SIP_FAQ)}
{related([("../emi-calculator/", "tools.emi.title", "EMI Calculator"), ("../gst-calculator/", "tools.gst.title", "GST Calculator")])}
  </main>
"""
    html += footer("../../")
    out = ROOT / "tools" / "sip-calculator" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


def write_gst() -> None:
    canonical = f"{SITE}/tools/gst-calculator/"
    html = head(
        base="../../",
        tool_id="gst",
        title="GST Calculator — Add or Remove GST (CGST, SGST, IGST) | Kapil Rana",
        description="Free India GST calculator. Add or remove 5%, 12%, 18%, or 28% GST. Split CGST/SGST for intra-state supply or apply IGST for inter-state.",
        canonical=canonical,
        json_ld=json_ld_app(
            "GST Calculator",
            canonical,
            "Add or remove Indian GST and split CGST/SGST or IGST.",
            GST_FAQ,
        ),
    )
    html += "<body class=\"tools-page\">\n"
    html += '  <a class="skip-link" href="#main-content" data-i18n="nav.skip">Skip to main content</a>\n'
    html += ambient()
    html += nav(
        "../../",
        {
            "emi": "../emi-calculator/",
            "sip": "../sip-calculator/",
            "gst": "./",
            "billing": "../billing/",
            "hub": "../",
        },
    )
    html += f"""
  <main class="tool-main" id="main-content" tabindex="-1">
    <nav class="tool-crumb" aria-label="Breadcrumb">
      <a href="../../" data-i18n="tools.common.home">Home</a>
      <span aria-hidden="true">/</span>
      <a href="../" data-i18n="nav.tools">Tools</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page" data-i18n="tools.gst.nav">GST Calculator</span>
    </nav>
    <header class="tool-hero">
      <span class="tool-hero-icon hub-icon-gst" aria-hidden="true">{ICON_GST}</span>
      <p class="tool-kicker" data-i18n="tools.categories.finance.title">Finance</p>
      <h1 data-i18n="tools.gst.title">GST Calculator</h1>
      <p class="tool-lead" data-i18n="tools.gst.lead">Add GST to a base price or extract tax from an inclusive amount. Use official slabs (0, 5, 12, 18, 28%) and split the tax as CGST + SGST or a single IGST line.</p>
    </header>
    <div class="tool-grid">
      <form class="tool-card glass tool-card-in" id="gst-form" onsubmit="return false;">
        <h2 data-i18n="tools.common.inputs">Inputs</h2>
        <div class="tool-field">
          <label for="gst-amount" data-i18n="tools.gst.amount">Amount (₹)</label>
          <div class="tool-input">{ICON_RUPEE}<input id="gst-amount" name="amount" type="number" inputmode="decimal" min="0" step="1" value="10000" /></div>
        </div>
        <div class="tool-field">
          <span data-i18n="tools.gst.mode">Price type</span>
          <div class="tool-toggle" role="group" aria-label="Price type">
            <button type="button" class="tool-chip" data-gst-mode="exc" aria-pressed="true" data-i18n="tools.gst.exclusive">Exclusive (add GST)</button>
            <button type="button" class="tool-chip" data-gst-mode="inc" aria-pressed="false" data-i18n="tools.gst.inclusive">Inclusive (remove GST)</button>
          </div>
        </div>
        <div class="tool-field">
          <label for="gst-rate" data-i18n="tools.gst.rate">GST rate (%)</label>
          <div class="tool-input">{ICON_PCT}<input id="gst-rate" name="rate" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="18" /></div>
          <div class="tool-chips" role="group" aria-label="GST slabs">
            <button type="button" class="tool-chip" data-gst-rate="0">0%</button>
            <button type="button" class="tool-chip" data-gst-rate="5">5%</button>
            <button type="button" class="tool-chip" data-gst-rate="12">12%</button>
            <button type="button" class="tool-chip" data-gst-rate="18">18%</button>
            <button type="button" class="tool-chip" data-gst-rate="28">28%</button>
          </div>
        </div>
        <div class="tool-field">
          <span data-i18n="tools.gst.split">Supply type</span>
          <div class="tool-toggle" role="group" aria-label="Supply type">
            <button type="button" class="tool-chip" data-gst-split="intra" aria-pressed="true" data-i18n="tools.gst.intra">Intra-state (CGST + SGST)</button>
            <button type="button" class="tool-chip" data-gst-split="igst" aria-pressed="false" data-i18n="tools.gst.inter">Inter-state (IGST)</button>
          </div>
        </div>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="gst-reset" data-i18n="tools.common.reset">Reset</button>
        </div>
        <p class="tool-note" data-i18n="tools.common.disclaimer">Estimates only. Not tax advice. Cess, exemptions, and place-of-supply rules can change the tax on a real invoice.</p>
      </form>
      <section class="tool-card glass tool-card-out" aria-live="polite">
        <div class="tool-result-head">
          <span class="tool-badge hub-icon-gst" aria-hidden="true">{ICON_GST}</span>
          <h2 data-i18n="tools.gst.resultLabel">Tax breakdown</h2>
        </div>
        <p class="tool-result-value" id="gst-total">₹0</p>
        <p class="tool-result-sub" id="gst-result-sub"></p>
        <div class="tool-viz">
          <div class="tool-donut-wrap">
            <svg class="tool-donut" id="gst-donut" viewBox="0 0 120 120" role="img" aria-label="Tax versus taxable value"></svg>
            <div class="tool-donut-center">
              <span data-i18n="tools.common.breakdown">Split</span>
              <strong id="gst-donut-label">—</strong>
            </div>
          </div>
          <div class="tool-metrics tool-metrics-stack">
            <div class="tool-metric"><span data-i18n="tools.gst.base">Taxable value</span><strong id="gst-base">₹0</strong></div>
            <div class="tool-metric"><span data-i18n="tools.gst.tax">GST amount</span><strong id="gst-tax">₹0</strong></div>
          </div>
        </div>
        <div class="tool-legend" id="gst-legend"></div>
        <div id="gst-split-intra" class="tool-metrics">
          <div class="tool-metric"><span>CGST</span><strong id="gst-cgst">₹0</strong></div>
          <div class="tool-metric"><span>SGST / UTGST</span><strong id="gst-sgst">₹0</strong></div>
        </div>
        <div id="gst-split-inter" class="tool-metrics" hidden>
          <div class="tool-metric"><span>IGST</span><strong id="gst-igst">₹0</strong></div>
        </div>
        <div class="tool-chart-panel">
          <h3 data-i18n="tools.gst.chartSplit">Invoice stack</h3>
          <div class="tool-chart-wrap">
            <svg class="tool-chart" id="gst-chart" viewBox="0 0 360 120" role="img" aria-label="Invoice amount stack"></svg>
          </div>
        </div>
      </section>
    </div>
    <section class="tool-prose">
      <h2 data-i18n="tools.common.how">How this GST calculator works</h2>
      <p data-i18n="tools.gst.how1">Exclusive GST: <code>tax = amount × rate / 100</code>, <code>total = amount + tax</code>. Inclusive GST: <code>base = amount / (1 + rate/100)</code>, <code>tax = amount − base</code>. Intra-state supply splits tax 50/50 into CGST and SGST. Inter-state supply shows the same tax as IGST.</p>
      <p data-i18n="tools.gst.how2">Common slabs in India are 0%, 5%, 12%, 18%, and 28%. Some goods also attract compensation cess — this calculator does not add cess. Confirm the HSN/SAC rate before you issue or pay an invoice.</p>
    </section>
{faq_block("tools.gst", GST_FAQ)}
{related([("../emi-calculator/", "tools.emi.title", "EMI Calculator"), ("../sip-calculator/", "tools.sip.title", "SIP Calculator")])}
  </main>
"""
    html += footer("../../")
    out = ROOT / "tools" / "gst-calculator" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


def write_billing() -> None:
    canonical = f"{SITE}/tools/billing/"
    html = head(
        base="../../",
        tool_id="billing",
        title="Billing Software — Sign in",
        description="Sign in to Billing Software with your mobile number. New accounts set a business name; GSTIN is optional.",
        canonical=canonical,
        json_ld=json_ld_app(
            "Billing",
            canonical,
            "Mobile OTP login and business onboarding for GST billing.",
            [
                (
                    "How do I sign in?",
                    "Enter your 10-digit Indian mobile number and the 4-digit OTP. New and existing users use the same steps.",
                ),
                (
                    "What is the OTP?",
                    "OTP is currently hardcoded to 0000 while SMS is not connected.",
                ),
                (
                    "What do I need to register?",
                    "Mobile number and business name are required. GSTIN is optional and can be added later.",
                ),
                (
                    "Are my details stored?",
                    "Yes. Your mobile, business name, and optional GSTIN are stored so you can sign back in. The session cookie stays on this site.",
                ),
            ],
        ),
    )
    html += "<body class=\"tools-page billing-software\">\n"
    html += '  <a class="skip-link" href="#main-content" data-i18n="nav.skip">Skip to main content</a>\n'
    html += ambient()
    html += f"""
  <aside class="bill-drawer" id="bill-drawer" hidden>
    <div class="bill-drawer-brand">
      <span class="logo-mark hub-icon-bill" aria-hidden="true">{ICON_BILL}</span>
      <span class="bill-drawer-label" data-i18n="tools.billing.product">Billing Software</span>
    </div>
    <button type="button" class="bill-drawer-toggle" id="bill-drawer-toggle" aria-controls="bill-drawer" aria-expanded="true">
      <span class="bill-tab-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M5 12h14M5 17h14"/></svg></span>
      <span class="bill-drawer-label" data-i18n="tools.billing.menu">Menu</span>
    </button>
    <nav class="bill-tab-list" id="bill-tab-list" aria-label="Workspace"></nav>
    <button type="button" class="bill-tab bill-tab-exit" id="billing-logout">
      <span class="bill-tab-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 7V5a1 1 0 0 1 1-1h8v16h-8a1 1 0 0 1-1-1v-2"/><path d="M4 12h10M8 8l-4 4 4 4"/></svg></span>
      <span class="bill-drawer-label" data-i18n="tools.billing.logout">Log out</span>
    </button>
  </aside>
  <div class="bill-frame">
  <header class="bill-top" id="nav" role="banner">
    <a class="bill-brand" id="bill-header-brand" href="./" aria-label="Billing Software">
      <span class="logo-mark hub-icon-bill" aria-hidden="true">{ICON_BILL}</span>
      <span class="bill-brand-text" data-i18n="tools.billing.product">Billing Software</span>
    </a>
    <h1 class="bill-biz-name" id="bill-biz-name"></h1>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle light and dark mode" title="Toggle theme">
        <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1110.5 3a7 7 0 0010.5 11.5z"/>
        </svg>
      </button>
    </div>
  </header>
  <main class="bill-main" id="main-content" tabindex="-1">
    <div class="billing-layout">
      <div id="billing-app" class="billing-app" aria-live="polite">
        <section class="billing-card glass">
          <p class="tool-kicker" data-i18n="tools.billing.kicker">Mobile login</p>
          <h2 data-i18n="tools.billing.signInTitle">Sign in or create an account</h2>
          <p class="tool-lead" data-i18n="tools.billing.signInLead">Use your business mobile number. New and existing users follow the same steps.</p>
          <form id="bill-phone-form" method="post" action="#" onsubmit="return false;">
            <div class="tool-field">
              <label for="billing-mobile"><span data-i18n="tools.billing.mobile">Mobile number</span> <span class="billing-req">*</span></label>
              <div class="billing-input"><span>+91</span>
                <input id="billing-mobile" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="9876543210" required />
              </div>
              <span class="tool-note" data-i18n="tools.billing.mobileHint">10-digit Indian mobile number</span>
            </div>
            <p class="billing-err" id="billing-error" role="alert"></p>
            <button class="btn btn-primary" type="submit" data-i18n="tools.billing.sendOtp">Send OTP</button>
          </form>
        </section>
      </div>
      <aside class="billing-showcase" aria-label="Billing highlights">
        <div class="billing-carousel" id="billing-carousel">
          <div class="billing-slides">
            <figure class="billing-slide is-active">
              <img src="../../assets/billing/workspace.jpg" alt="A quiet desk ready for invoicing" width="1200" height="900" />
              <figcaption data-i18n="tools.billing.slide1">Create clean invoices in minutes</figcaption>
            </figure>
            <figure class="billing-slide">
              <img src="../../assets/billing/counter.jpg" alt="A merchant billing a customer at the counter" width="1200" height="900" />
              <figcaption data-i18n="tools.billing.slide2">Built for everyday shop billing</figcaption>
            </figure>
            <figure class="billing-slide">
              <img src="../../assets/billing/documents.jpg" alt="Invoice and tax documents on a desk" width="1200" height="900" />
              <figcaption data-i18n="tools.billing.slide3">GST-ready totals when you need them</figcaption>
            </figure>
            <figure class="billing-slide">
              <img src="../../assets/billing/dashboard.jpg" alt="A finance dashboard on a laptop" width="1200" height="900" />
              <figcaption data-i18n="tools.billing.slide4">See what you billed at a glance</figcaption>
            </figure>
          </div>
          <div class="billing-carousel-nav">
            <button type="button" class="billing-carousel-btn" data-carousel-prev aria-label="Previous slide">‹</button>
            <div class="billing-dots" role="tablist" aria-label="Carousel slides">
              <button type="button" class="is-on" data-carousel-dot="0" aria-label="Slide 1"></button>
              <button type="button" data-carousel-dot="1" aria-label="Slide 2"></button>
              <button type="button" data-carousel-dot="2" aria-label="Slide 3"></button>
              <button type="button" data-carousel-dot="3" aria-label="Slide 4"></button>
            </div>
            <button type="button" class="billing-carousel-btn" data-carousel-next aria-label="Next slide">›</button>
          </div>
        </div>
      </aside>
    </div>
    <section class="bill-stage" id="bill-stage" hidden></section>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <footer class="bill-foot" role="contentinfo">
    <p>Made with love · Developed by <a href="../../">Kapil Rana</a></p>
  </footer>
  </div>
  <script src="../../js/i18n.js" defer></script>
  <script src="../../js/tools.js" defer></script>
  <script src="../../js/billing-config.js" defer></script>
  <script src="../../js/billing-app.js" defer></script>
</body>
</html>
"""
    out = ROOT / "tools" / "billing" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT))


def main() -> None:
    write_hub()
    write_emi()
    write_sip()
    write_gst()
    write_billing()


if __name__ == "__main__":
    main()
