import React, { useEffect, useMemo, useState } from "react";

/**
 * Adds optional currency conversions using exchangerate.host.
 * - Summary table remains USD only.
 * - Chat message shows USD and (converted) if a currency is chosen.
 */

// ---- Pricing catalog (unchanged) ----
const TIERS = [
  "Pause and Build",
  "Shopify Basic",
  "Shopify Grow",
  "Shopify Advanced",
  "Shopify Plus",
] as const;
type Tier = (typeof TIERS)[number];

const APPS: {
  id: string;
  name: string;
  pricesByTier: Record<Tier, number>;
}[] = [
  {
    id: "color_swatch_king_variants",
    name: "Color Swatch King: Variants",
    pricesByTier: {
      "Pause and Build": 5.0,
      "Shopify Basic": 14.9,
      "Shopify Grow": 29.9,
      "Shopify Advanced": 49.9,
      "Shopify Plus": 99.9,
    },
  },
  {
    id: "sa_variants_combined_listings",
    name: "SA Variants: Combined Listings",
    pricesByTier: {
      "Pause and Build": 5.0,
      "Shopify Basic": 14.9,
      "Shopify Grow": 29.9,
      "Shopify Advanced": 49.9,
      "Shopify Plus": 99.9,
    },
  },
  {
    id: "sa_variant_image_automator",
    name: "SA Variant Image Automator",
    pricesByTier: {
      "Pause and Build": 5.0,
      "Shopify Basic": 9.9,
      "Shopify Grow": 24.9,
      "Shopify Advanced": 24.9,
      "Shopify Plus": 49.9,
    },
  },
  {
    id: "variant_descriptions_king",
    name: "Variant Descriptions King",
    pricesByTier: {
      "Pause and Build": 5.0,
      "Shopify Basic": 9.9,
      "Shopify Grow": 9.9,
      "Shopify Advanced": 9.9,
      "Shopify Plus": 9.9,
    },
  },
];

// ---- Helpers ----
function formatCurrency(n: number, currency = "USD") {
  return n.toLocaleString(undefined, { style: "currency", currency });
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
const formatPct = (n: number) => {
  const v = Math.round(n * 10) / 10; // 1 decimal place
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
};

type Rates = Record<string, number>;

// Try multiple FX providers; first success wins
async function getUsdRatesIncluding(targetCode?: string): Promise<Rates> {
  const want = (targetCode || "").toUpperCase();

  const ok = (r: Rates) => !want || !!r[want];

  // 1) Frankfurter (ECB)
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD");
    if (r.ok) {
      const d = await r.json();
      if (d?.rates && ok(d.rates)) return d.rates as Rates;
    }
  } catch {}

  // 2) exchangerate.host
  try {
    const r = await fetch("https://api.exchangerate.host/latest?base=USD");
    if (r.ok) {
      const d = await r.json();
      if (d?.rates && ok(d.rates)) return d.rates as Rates;
    }
  } catch {}

  // 3) open.er-api.com
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r.ok) {
      const d = await r.json();
      if (d?.result === "success" && d?.rates && ok(d.rates))
        return d.rates as Rates;
    }
  } catch {}

  // 4) jsDelivr daily snapshot (lowercase keys → map to UPPER)
  try {
    const r = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json"
    );
    if (r.ok) {
      const d = await r.json();
      if (d?.usd) {
        const mapped: Rates = {};
        for (const [k, v] of Object.entries(d.usd))
          mapped[k.toUpperCase()] = Number(v);
        if (ok(mapped)) return mapped;
      }
    }
  } catch {}

  throw new Error("No FX providers returned the requested currency");
}

// ---- Component ----
export default function ShopifyPricingCalculator() {
  const [merchantName, setMerchantName] = useState("");
  const [tier, setTier] = useState<Tier>("Shopify Basic");
  const [discountPctInput, setDiscountPctInput] = useState<string>("0");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // NEW: per-app discount mode + values
  const [usePerAppDiscounts, setUsePerAppDiscounts] = useState<boolean>(false);
  const [perAppDiscounts, setPerAppDiscounts] = useState<
    Record<string, string>
  >({});

  // helper: get effective discount % for an app (clamped 0–100)
  const discountForApp = (appId: string) => {
    const global = Number(discountPctInput);
    const globalClamped = Number.isFinite(global) ? clamp(global, 0, 100) : 0;

    if (!usePerAppDiscounts) return globalClamped;

    const raw = perAppDiscounts[appId]; // string | undefined
    // If field is missing or blank, use global
    if (raw === undefined || raw.trim() === "") return globalClamped;

    const n = Number(raw);
    // If not a valid number, also fall back to global
    if (!Number.isFinite(n)) return globalClamped;

    return clamp(n, 0, 100);
  };

  // NEW: currency (optional)
  const [currency, setCurrency] = useState<string>(""); // "" means show only USD
  const [symbols, setSymbols] = useState<string[]>([]); // list like ["AED","INR","EUR",...]
  const [rates, setRates] = useState<Rates | null>(null); // USD base
  const [fxStatus, setFxStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const discountPct = useMemo(() => {
    const n = Number(discountPctInput);
    return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
  }, [discountPctInput]);

  const selectedApps = useMemo(
    () => APPS.filter((a) => selectedAppIds.includes(a.id)),
    [selectedAppIds]
  );

  const rows = useMemo(() => {
    return selectedApps.map((app) => {
      const actual = app.pricesByTier[tier];
      const d = discountForApp(app.id); // per-app or global
      const discounted = actual * (1 - d / 100);
      return { id: app.id, name: app.name, actual, discounted, discountPct: d };
    });
  }, [
    selectedApps,
    tier,
    discountPctInput,
    usePerAppDiscounts,
    perAppDiscounts,
  ]);

  const totals = useMemo(() => {
    const actual = rows.reduce((s, r) => s + r.actual, 0);
    const discounted = rows.reduce((s, r) => s + r.discounted, 0);
    const savings = actual - discounted;
    return { actual, discounted, savings };
  }, [rows]);

  // ---- FX: load supported symbols once ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.exchangerate.host/symbols");
        const data = await res.json();
        if (cancelled) return;
        const list = Object.keys(data.symbols || {});
        // Sort and keep common first
        const common = ["AED", "EUR", "GBP", "INR", "AUD", "CAD", "JPY", "ZAR"];
        const ordered = [...new Set([...common, ...list])];
        setSymbols(ordered);
      } catch {
        // If symbols call fails, just provide a small fallback list
        setSymbols(["AED", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- FX: fetch USD base rates whenever a currency is selected ----
  useEffect(() => {
    if (!currency) return;
    let cancelled = false;
    setFxStatus("loading");
    (async () => {
      try {
        const r = await getUsdRatesIncluding(currency); // pass selected code
        if (cancelled) return;
        setRates(r);
        setFxStatus("ready");
      } catch {
        if (!cancelled) setFxStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  // Convert USD amount to selected currency (if any)
  const convertIfNeeded = (usdAmount: number) => {
    if (!currency || !rates) return null;
    const rate = rates[currency];
    if (!rate) return null;
    return usdAmount * rate;
  };

  const chatMessage = useMemo(() => {
    const name = merchantName.trim() || "there";
    const discountTxt = `${discountPct}%`;

    const actualLines = rows
      .map((r) => {
        const usd = formatCurrency(r.actual, "USD");
        const converted = convertIfNeeded(r.actual);
        const withBracket = converted
          ? ` (${formatCurrency(converted, currency!)})`
          : "";
        return `${r.name}: ${usd}${withBracket}`;
      })
      .join("\n");

    const discountedLines = rows
      .map((r) => {
        const usd = formatCurrency(r.discounted, "USD");
        const converted = convertIfNeeded(r.discounted);
        const withBracket = converted
          ? ` (${formatCurrency(converted, currency!)})`
          : "";
        return `${r.name}: ${usd}${withBracket} — ${formatPct(
          r.discountPct
        )} off`;
      })
      .join("\n");

    const totalUsdDiscounted = formatCurrency(totals.discounted, "USD");
    const totalUsdActual = formatCurrency(totals.actual, "USD");
    const totalUsdSavings = formatCurrency(totals.savings, "USD");

    const totalConvertedDiscounted = convertIfNeeded(totals.discounted);
    const totalConvertedActual = convertIfNeeded(totals.actual);
    const totalConvertedSavings = convertIfNeeded(totals.savings);

    const totalsLine = totalConvertedDiscounted
      ? `${totalUsdDiscounted} (${formatCurrency(
          totalConvertedDiscounted,
          currency!
        )})`
      : totalUsdDiscounted;
    const totalsActualLine = totalConvertedActual
      ? `${totalUsdActual} (${formatCurrency(totalConvertedActual, currency!)})`
      : totalUsdActual;
    const totalsSavingsLine = totalConvertedSavings
      ? `${totalUsdSavings} (${formatCurrency(
          totalConvertedSavings,
          currency!
        )})`
      : totalUsdSavings;

    const discountHeader = usePerAppDiscounts
      ? "Once I have applied the discounts, the prices will be revised to:"
      : `Once I have applied the ${discountPct}% discount, the prices will be revised to:`;

    return `Hi ${name}, 
    
I see that you are currently on the ${tier} plan, and thus, the pricing for you will be as follows:
${actualLines}

${discountHeader}
${discountedLines}

This means you will pay ${totalsLine} per month instead of ${totalsActualLine}, saving a total of ${totalsSavingsLine}

Please let me know if you would like me to go ahead and apply this discount for you`;
  }, [
    merchantName,
    tier,
    rows,
    totals,
    discountPct,
    currency,
    rates,
    usePerAppDiscounts,
  ]);

  const toggleApp = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 flex justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Merchant Details</h2>
            <label className="block text-sm font-medium mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g., John Doe"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
            />

            <label className="block text-sm font-medium mt-4 mb-1">
              Shopify Plan (tier)
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium mt-4 mb-1">
              Discount (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={discountPctInput}
              onChange={(e) => setDiscountPctInput(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <p className="text-xs text-gray-500 mt-1">
              When per-app discounts are off, this applies to all selected apps.
            </p>

            {/* NEW: toggle for per-app discounts */}
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={usePerAppDiscounts}
                onChange={(e) => setUsePerAppDiscounts(e.target.checked)}
              />
              <span className="text-sm">
                Use different discount rates per app
              </span>
            </label>

            {/* NEW: per-app inputs (only when enabled) */}
            {usePerAppDiscounts && selectedApps.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedApps.map((app) => (
                  <div key={app.id} className="flex items-center gap-2">
                    <label className="w-56 text-sm text-gray-700">
                      {app.name}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={perAppDiscounts[app.id] ?? ""}
                      placeholder={`${discountPctInput || 0} (fallback)`}
                      onChange={(e) =>
                        setPerAppDiscounts((prev) => ({
                          ...prev,
                          [app.id]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Leave blank to use the global discount as fallback for that
                  app.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-xl font-semibold mb-4">Apps</h2>
            <div className="space-y-2">
              {APPS.map((app) => (
                <label
                  key={app.id}
                  className="flex items-start gap-3 p-3 rounded-xl border hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedAppIds.includes(app.id)}
                    onChange={() => toggleApp(app.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-gray-500">
                      Current tier price:{" "}
                      {formatCurrency(app.pricesByTier[tier], "USD")}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Pricing Summary</h2>

              {/* NEW: Currency selector (optional) */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">
                  Currency (optional):
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white"
                >
                  <option value="">USD only</option>
                  {symbols.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5">
              {rows.length === 0 ? (
                <p className="text-gray-500">
                  Select one or more apps to see pricing.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-2 pr-4">App</th>
                        <th className="py-2 pr-4">Actual (USD)</th>
                        <th className="py-2 pr-4">Discounted (USD)</th>
                        <th className="py-2 pr-4">Savings (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-2 pr-4">{r.name}</td>
                          <td className="py-2 pr-4">
                            {formatCurrency(r.actual, "USD")}
                          </td>
                          <td className="py-2 pr-4">
                            {formatCurrency(r.discounted, "USD")}
                          </td>
                          <td className="py-2 pr-4">
                            {formatCurrency(r.actual - r.discounted, "USD")}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t font-semibold">
                        <td className="py-2 pr-4">Totals</td>
                        <td className="py-2 pr-4">
                          {formatCurrency(totals.actual, "USD")}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(totals.discounted, "USD")}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(totals.savings, "USD")}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Lightweight FX status note (not required, but helpful) */}
                  {currency && (
                    <p className="text-xs text-gray-500 mt-3">
                      {fxStatus === "loading" &&
                        "Fetching latest exchange rates…"}
                      {fxStatus === "error" &&
                        "Could not fetch exchange rates. USD values shown; converted amounts may be missing."}
                      {fxStatus === "ready" &&
                        "Converted amounts are indicative based on current rates; billing remains in USD."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Generated Chat Message</h2>
              <button
                onClick={() => navigator.clipboard.writeText(chatMessage)}
                className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
            <div className="p-5">
              <textarea
                readOnly
                value={chatMessage}
                rows={12}
                className="w-full font-mono text-sm rounded-xl border border-gray-300 p-3 bg-gray-50 min-h-96"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
