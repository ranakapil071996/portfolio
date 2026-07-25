# Kapil Rana — Interactive Portfolio

Premium single-page portfolio with **Three.js** ambient 3D, **particles.js**, and employer-focused interactions.

## Resume positioning

Content is **frontend-forward** (React/TypeScript UI ownership) with natural backend/platform depth (Node.js, API collab, Kong, observability) — no artificial “70/30” labels.

Highlights at Airtel Payments Bank:
- ~**1M users/day** Internet Banking
- Team management via **Jira**
- Production: **Kibana** · **Grafana**
- **Kong**, JWT, CORS (listed under skills)
- Backend architecture collaboration & API contracts

| Issue | Fix |
|-------|-----|
| Pure “Frontend” title branding | SDE III with balanced bullets |
| DotPe + Airtel both “Present” | DotPe ends **May 2025** |
| Ops/gateway skills | Kong, JWT, CORS, Kibana, Grafana, Jira in skills |
| Two pages | Condensed to **1-page** PDF |

Files:
- `SE3KapilEU.pdf` — original
- `Kapil_Rana_Resume.pdf` / `assets/Kapil_Rana_Resume.pdf` — improved

## Run locally

```bash
cd resume-build
python3 -m http.server 8080
# open http://localhost:8080
```

> Use a local server (not `file://`) so modules/CDN and PDF download behave correctly.

## Host online (free)

### GitHub Pages
1. Create a repo, push this folder to `main`
2. Settings → Pages → Deploy from branch `main` / root
3. Site URL: `https://<user>.github.io/<repo>/`

### Netlify / Vercel
- Drag-and-drop this folder, or connect the Git repo
- Publish directory: `/` (project root)
- No build command required

### Cloudflare Pages
- Connect repo → framework preset **None** → output directory `/`

## Performance notes

- Three.js DPR capped (1.25–1.5), low-poly meshes, pause on tab hide
- particles.js density reduced on mobile / low-power devices
- Animations use `transform` + `opacity` only; `prefers-reduced-motion` respected
- `perf-lite` class disables heavy blur / cursor glow on weak hardware
- IntersectionObserver reveals; counters animate once

## Theme

Sun/moon toggle in the nav switches **light / dark** mode. Preference is stored in `localStorage` (`theme`) and respects system preference on first visit.

## Customize

- Contact & content: `index.html`, `js/main.js` (skills catalog)
- Colors: `css/styles.css` (`:root` / `[data-theme="light"]` variables)
- 3D scene: `js/three-scene.js`
- Particles: `js/particles-config.js`

## Stack

HTML · CSS · Vanilla JS · Three.js r128 · particles.js 2.0


## Company-themed resume routes

Share a branded resume URL per company. Same content, company brand theme (colors + logo).

| Route | Company |
|-------|---------|
| `/for/` | Hub — all company links |
| `/wolt/` | Wolt |
| `/bolt/` | Bolt |
| `/zalando/` | Zalando |
| `/delivery-hero/` | Delivery Hero |
| `/aviv/` | Aviv Group |
| `/flink/` | Flink |
| `/home24/` | Home24 |
| `/otto/` | OTTO |
| `/xxxlutz/` | XXXLutz |
| `/amazon/` | Amazon |
| `/langdock/` | Langdock |
| `/hometogo/` | HomeToGo |
| `/trade-republic/` | Trade Republic |
| `/contentful/` | Contentful |
| `/revolut/` | Revolut |
| `/taxfix/` | Taxfix |
| `/wise/` | Wise |
| `/n8n/` | n8n |

Example: `https://your-domain.com/revolut/`

Theme data: `js/companies-data.js` · Resume content: `js/resume-content.js`

## Performance, SEO & Accessibility

### Performance
- **Critical path**: only `main.js` loads with the page
- **Three.js + particles.js** load after idle / first interaction (`js/perf-loader.js`)
- Reduced particle counts, lower-poly 3D, `content-visibility` on below-fold sections
- Fonts: system stack first; Inter 400/600/700 with `display=swap` (non-blocking)
- Skips heavy effects when `prefers-reduced-motion` or Save-Data is on

### SEO & link sharing
- Semantic landmarks, unique title/description
- **Open Graph + Twitter large image card** (`assets/og-image.jpg` — profile + name)
- Favicons + Apple touch icon from `profile.jpeg` (`icons/`, `favicon.ico`)
- `site.webmanifest` + `browserconfig.xml` for install / tiles
- JSON-LD `Person` + `WebSite` + `ProfilePage` (profile + OG image)
- `robots.txt` + `sitemap.xml` (update host `kapilrana.dev` when deploying)
- After deploy, validate with [opengraph.xyz](https://www.opengraph.xyz/) or LinkedIn Post Inspector

**Note:** WhatsApp / LinkedIn / Slack only fetch previews from a **public HTTPS** URL. Localhost will not show rich cards.

### Accessibility
- Skip link, `:focus-visible` rings, keyboard menu (Escape closes)
- `aria-expanded` / `aria-pressed` / `aria-current` / section `aria-labelledby`
- Decorative canvas/particles marked `aria-hidden`
