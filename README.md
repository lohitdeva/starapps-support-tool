# StarApps Support Tool

> A lightweight, client‑only toolbox for Merchant Support Specialists. Built with React + Vite + Tailwind (with lots of help from ChatGPT). Deployed on Vercel.

This repo now contains **two tools** under one UI:

- **Pricing Calculator** — quick, accurate pricing summaries by Shopify tier with global **or** per‑app discounts, plus optional currency conversion in the **generated chat message**.

- **Shopify Admin URL Generator** — cascade through sections, fill placeholders (e.g. product / variant / theme IDs), and instantly get **Shopify 2.0 (admin.shopify.com)** and **legacy 1.0 (myshopify.com)** admin links.

It also ships a **Landing page** with a friendly, time‑aware greeting for a nicer entry experience.

---

## ✨ Features (at a glance)

### Pricing Calculator

- Select the merchant’s **Shopify plan** (Pause & Build, Basic, Grow, Advanced, Plus).
- Pick the apps in use; each app shows the **USD price for that tier**.
- Set a **global discount** _or_ toggle **per‑app discounts** and enter different rates per app.
- **Totals** (actual, discounted, savings) computed in USD.
- Optional **currency selector** (AED, INR, EUR, etc.). Converted values appear **in the chat message** only; table remains USD‑only.
- One‑click **Copy** of a complete, paste‑ready message for the merchant.

### Shopify Admin URL Generator

- Paste a **store handle or URL** (`cool-store`, `https://admin.shopify.com/store/cool-store`, etc.).
- Choose a **root section** (Admin, Apps, Themes, etc.), then **drill down** via dynamic dropdowns until you reach a final page.
- When a final page requires parameters, **placeholder inputs** appear automatically (Product ID, Theme ID, Variant ID, etc.).
- Generates both **Shopify 2.0** and **Shopify 1.0** admin URLs and provides **Copy** buttons.
- Loads its menu from **`links.json`** (with a `?json=` override for testing or custom catalogs).

### Landing page

- Friendly greeting that adapts to time of day and shows **IST time**.
- Best‑effort geo note (city/country/timezone) for a welcoming touch.

---

## 🏗️ Architecture & Tech

- **UI**: React + TailwindCSS.
- **Build**: Vite.
- **Routing**: minimal, client‑only — the page to render is decided by a `data-page` attribute in each entry HTML (`home`, `calculator`, `urlgen`).
- **Analytics**: Vercel Analytics + Speed Insights.
- **Hosting**: Vercel (static, edge‑cached).

---

## 📁 Project structure

```
root/
├─ public/                 # favicons, logo, social images
├─ src/
│  ├─ App.tsx              # header + page switch
│  ├─ Landing.tsx          # landing page
│  ├─ ShopifyPricingCalculator.tsx
│  ├─ UrlGenerator.tsx
│  ├─ main.tsx             # reads data-page and mounts App
│  └─ index.css            # Tailwind entry
├─ calculator/index.html   # entry with SEO/meta for calculator
├─ urlgen/index.html       # entry with SEO/meta for URL generator
├─ index.html              # entry with SEO/meta for landing
├─ links.json              # (served at root) catalog for URL generator
├─ package.json
└─ README.md
```

> **Why three HTML files?** Each page (Landing, Calculator, URL Generator) has its own SEO tags, title, and social preview image while sharing the same React bundle.

---

## 🔧 Local development

```bash
# install deps
npm install

# start dev server
npm run dev

# build for production (outputs dist/)
npm run build

# preview a prod build
npm run preview
```

> Node version: use the LTS you have in CI or Vercel. This app is client‑only; no server code.

---

## 🌐 Environment variables (SEO & social)

Each entry HTML uses `%VITE_*%` placeholders that Vite replaces at build time. Add these to your `.env` / Vercel project settings:

**Shared**

- `VITE_SITE_URL` – canonical site URL (e.g., `https://support-tool.example.com`)
- `VITE_TWITTER_HANDLE` – e.g., `@starappsstudio`

**Landing**

- `VITE_TITLE_LANDING`
- `VITE_DESC_LANDING`
- `VITE_OG_IMAGE_LANDING` (1200×630)

**Pricing Calculator**

- `VITE_TITLE_CALCULATOR`
- `VITE_DESC_CALCULATOR`
- `VITE_OG_IMAGE_CALCULATOR` (1200×630)

**URL Generator**

- `VITE_TITLE_URLGEN`
- `VITE_DESC_URLGEN`
- `VITE_OG_IMAGE_URLGEN` (1200×630)

---

## 🧮 Pricing Calculator – details

### Included apps & prices

The app includes a small, hard‑coded catalog of StarApps and per‑tier prices. To update prices or add a new app, edit the `APPS` array in `src/ShopifyPricingCalculator.tsx` and redeploy.

### Discounts

- **Global discount** (% applied to all selected apps).
- **Per‑app discounts**: toggle on and enter an override % for each selected app. Leave blank to fallback to the global value.

### Currency conversion (optional)

- When a currency is chosen, the app fetches **USD‑base** FX rates using a resilient fallback chain (ECB → exchangerate.host → open.er-api.com → jsDelivr snapshot).
- Converted amounts appear **only in the generated chat message**; USD remains the canonical pricing.

### Copy‑ready message

The app builds a friendly message that lists per‑app pricing (actual & discounted) and the monthly totals/savings. Use the **Copy** button to paste it into chat.

---

## 🔗 Shopify Admin URL Generator – details

### Data source

The generator reads from `links.json`. The default lookup tries both `/links.json` and `./links.json` at the site root. For testing or custom catalogs you can pass a querystring override, e.g. `?json=https://example.com/another-links.json`.

### Catalog shape

The JSON contains nested groups under `apps`. Each leaf value is the **path** to a Shopify admin page and may contain placeholders like `{product_id}` or `{theme_id}`.

```json
{
  "apps": {
    "admin": {
      "home": "/",
      "products": {
        "product-edit": "/products/{product_id}"
      }
    },
    "themes": {
      "theme-editor": "/themes/{theme_id}/editor"
    }
  }
}
```

### Labels & placeholders

- Human‑readable labels for JSON keys are centralized in `LABELS` (e.g. `product-edit → "Product Edit Page"`).
- Input labels for placeholders can be customized in `VAR_LABELS` (e.g. `product_id → "Product ID"`).

### Inputs & validation

- Enter a store handle/domain/URL: the tool normalizes it for both **Shopify 2.0** and **legacy 1.0** admin patterns.
- Select a **root** and then drill down: the UI adds the next dropdown dynamically until it reaches a final page (a string path).
- If a leaf path contains placeholders, the tool prompts for the required values.
- Click **Generate URLs** and then **Copy** either link.

### Output formats

- **Updated Shopify Admin URL (Shopify 2.0)**: `https://admin.shopify.com/store/<handle><path>`
- **Legacy Shopify Admin URL (Shopify 1.0)**: `https://<handle>.myshopify.com/admin<path>`

> Tip: If you see a “couldn’t load links.json” message during local file testing, serve over HTTP or pass the `?json=` override.

---

## 🛡️ Privacy

- The app is **entirely client‑side**. No merchant or pricing data is sent to our servers.
- The Pricing Calculator fetches public FX rates. The Landing page makes a best‑effort geolocation request for display only.

---

## 🚀 Deploy (Vercel)

1. Push to GitHub.
2. Import the repo into **Vercel**.
3. Add the **Environment Variables** listed above.
4. Build command: `npm run build` · Output directory: `dist/`.
5. Configure **Clean URLs** so `/calculator/` and `/urlgen/` map to their own `index.html` entries.
6. Ship it.

---

## 🧪 Quick checks (QA)

- Switch between **global** and **per‑app** discount modes and verify prices.
- Pick **AED** in the currency selector and confirm converted amounts appear in the message.
- In URL Generator, choose different roots and verify placeholders appear when needed; test both **Copy** buttons.

---

## 🙌 Contributing / Maintenance

- **Update prices/apps** in `src/ShopifyPricingCalculator.tsx`.
- **Add/edit routes** in `links.json`; update `LABELS`/`VAR_LABELS` in `src/UrlGenerator.tsx` for better UX.
- **SEO**: configure per‑page env vars for titles, descriptions, and Open Graph images.
- PRs welcome. Keep UI simple, accessible, and copy‑friendly.
