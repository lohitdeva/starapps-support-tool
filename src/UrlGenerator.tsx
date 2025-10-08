import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Types ---------- */
type LinksJson = {
  apps: Record<string, Record<string, any>>;
};

//Overrides for JSON keys
const LABELS: Record<string, string> = {
  admin: "Admin Panel",
  vsk: "Color Swatch King: Variants",
  vkcl: "SA Variants: Combined Listings",
  via: "SA Variant Image Automator",
  ata: "Variant Alt Text King: SEO",
  vtk: "Variant Title King: Color, SKU",
  vdk: "Variant Descriptions King",
  uk: "Urgency King Low Stock Counter",
  "product-edit": "Product Edit Page",
  "variant-edit": "Variant Edit Page",
  markets: "Markets",
  themes: "Themes",
  preferences: "Preferences",
  "theme-specific-links": "Theme-specific Pages",
  "theme-code": "Theme Source Code",
  "theme-editor": "Theme Editor",
  "theme-editor-app-embeds": "App Embeds Page (Theme Editor)",
  "theme-editor-product-edit": "Product Template Page (Theme Editor)",
  settings: "Settings",
  shopify_tier: "Shopify Subscription Tier",
  billing: "Billing",
  accounts: "Accounts",
  apps: "Apps",
  home: "Dashboard",
  "swatch-settings": "Swatch Settings",
  "product-page-settings": "Product Page Settings",
  "collection-page-settings": "Collection Page Settings",
  "group-settings": "Product Group Settings",
  "product-groups": "Product Groups",
  "product-group-search": "Product Groups Search",
  "product-group-edit": "Product Group Edit",
  "app-settings": "App Settings",
  "manage-app-embeds": "Manage App Embeds (Theme Console)",
  "customize-styles": "Customize Styles",
  "customize-styles-products": "Customize Styles — Products",
  "customize-styles-products-edit": "Edit Product Style",
  "customize-styles-collections": "Customize Styles — Collections",
  "customize-styles-collections-edit": "Edit Collection Style",
  localization: "Localization",
  "low-stock-alert": "Low Stock Alert",
  pricing: "Pricing",
  "product-split": "Product Split",
  "setup-videos": "Setup Videos",
};

//Overrides for placeholder variable names
const VAR_LABELS: Record<string, string> = {
  product_id: "Product ID",
  variant_id: "Variant ID",
  theme_id: "Theme ID",
  product_handle: "Product Handle",
  group_id: "Group ID",
  preset_id: "Swatch Preset ID",
};

// Normalize to "/store/<handle>" path for Shopify 2.0 URL
function resolveStorePrefix(input: string) {
  if (!input) return "";
  let val = input.trim();
  try {
    if (val.startsWith("http://") || val.startsWith("https://")) {
      const u = new URL(val);
      if (u.hostname.includes("admin.shopify.com"))
        return u.pathname.replace(/\/?$/, "");
      if (u.hostname.endsWith("myshopify.com")) {
        const handle = u.hostname.replace(".myshopify.com", "");
        return `/store/${handle}`;
      }
    }
  } catch {}
  if (val.startsWith("/")) return val.replace(/\/?$/, "");
  if (val.includes("admin.shopify.com")) return "";
  if (val.includes(".")) {
    const handle = val.split(".")[0];
    return `/store/${handle}`;
  }
  return `/store/${val}`;
}

// Extract pure handle (for Shopify 1.0 URL)
function resolveHandle(input: string) {
  if (!input) return "";
  let val = input.trim();
  try {
    if (val.startsWith("http://") || val.startsWith("https://")) {
      const u = new URL(val);
      if (u.hostname.includes("admin.shopify.com")) {
        const m = u.pathname.match(/\/store\/([^/]+)/);
        return m ? m[1] : "";
      }
      if (u.hostname.endsWith("myshopify.com"))
        return u.hostname.replace(".myshopify.com", "");
    }
  } catch {}
  if (val.startsWith("/")) {
    const m = val.match(/\/store\/([^/]+)/);
    return m ? m[1] : "";
  }
  if (val.includes(".")) return val.split(".")[0];
  return val;
}

const PLACEHOLDER_RE = /\{([^}]+)\}/g;
const extractPlaceholders = (s: string) => {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(s)) !== null) found.add(m[1]);
  return Array.from(found);
};

function fillPlaceholders(path: string, values: Record<string, string>) {
  return path.replace(PLACEHOLDER_RE, (_, key) =>
    encodeURIComponent((values[key] || "").trim())
  );
}

function isObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** ---------- UI Helpers ---------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 " +
        (props.className || "")
      }
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 " +
        (props.className || "")
      }
    />
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl shadow p-6">{children}</div>;
}

/** ---------- Main Component ---------- */

export default function UrlGenerator() {
  const [links, setLinks] = useState<LinksJson | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // User inputs
  const [storeInput, setStoreInput] = useState("");
  const [rootKey, setRootKey] = useState<string>("");
  const [levels, setLevels] = useState<
    Array<{ label: string; key: string; value: string }>
  >([]);
  const [currentPath, setCurrentPath] = useState<string>("");

  // Placeholder values
  const [phValues, setPhValues] = useState<Record<string, string>>({});

  // Copy feedback
  const [copied, setCopied] = useState<"v2" | "v1" | null>(null);
  const copyTimer = useRef<number | null>(null);

  const [submitted, setSubmitted] = useState(false);

  // derived requirements
  const handle = useMemo(() => resolveHandle(storeInput), [storeInput]);
  const haveRoot = !!rootKey;
  const havePath = !!currentPath; // becomes string when a leaf is selected
  const requiredPlaceholders = useMemo(
    () => extractPlaceholders(currentPath),
    [currentPath]
  );

  const missingPlaceholders = requiredPlaceholders.filter(
    (k) => !phValues[k] || phValues[k].trim() === ""
  );

  const missingSet = useMemo(
    () => new Set(missingPlaceholders),
    [missingPlaceholders]
  );

  const isComplete =
    !!handle && haveRoot && havePath && missingPlaceholders.length === 0;

  // Simple error flags for UI (only show after "Generate" click)
  const showErrors = submitted;
  const errors = {
    store: showErrors && !handle,
    root: showErrors && !haveRoot,
    path: showErrors && haveRoot && !havePath,
    placeholders:
      showErrors &&
      havePath &&
      requiredPlaceholders.length > 0 &&
      missingPlaceholders.length > 0,
  };

  // Load links.json (supports ?json= override like your original)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const params = new URLSearchParams(location.search);
      const override = params.get("json");
      const urls = override ? [override] : ["/links.json", "links.json"]; // try both roots
      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as LinksJson;
          if (!cancelled) setLinks(data);
          return;
        } catch (e) {
          // try next
        }
      }
      if (!cancelled)
        setLoadErr(
          "Couldn’t load links.json. Load page via HTTP or pass ?json=<url>."
        );
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset cascading when root changes
  useEffect(() => {
    setLevels([]);
    setCurrentPath("");
    setPhValues({});
  }, [rootKey]);

  // Compute current node from links + selections
  const currentObj = useMemo(() => {
    if (!links || !rootKey) return null;
    let node: any = links.apps?.[rootKey];
    for (const lvl of levels) {
      if (!node) break;
      node = node[lvl.value];
    }
    return node;
  }, [links, rootKey, levels]);

  // When currentObj becomes a string → it’s a path; when object → add next select
  useEffect(() => {
    if (!currentObj) {
      setCurrentPath("");
      setPhValues({});
      return;
    }
    if (typeof currentObj === "string") {
      setCurrentPath(currentObj);
      const phs = extractPlaceholders(currentObj);
      setPhValues((prev) => {
        const next: Record<string, string> = {};
        phs.forEach((k) => (next[k] = prev[k] || ""));
        return next;
      });
    } else if (isObject(currentObj)) {
      setCurrentPath("");
      setPhValues({});
    }
  }, [currentObj]);

  // Derived: placeholders for the selected path
  const placeholders = useMemo(
    () => extractPlaceholders(currentPath),
    [currentPath]
  );

  // Result URLs
  const resultV2 = useMemo(() => {
    if (!isComplete) return "";
    const finalPath = fillPlaceholders(currentPath, phValues);
    const storePrefix = resolveStorePrefix(storeInput);
    if (!storePrefix) return ""; // extra guard
    return `https://admin.shopify.com${storePrefix}${finalPath}`;
  }, [isComplete, currentPath, phValues, storeInput]);

  const resultV1 = useMemo(() => {
    if (!isComplete) return "";
    const finalPath = fillPlaceholders(currentPath, phValues);
    const cleanPath = finalPath.startsWith("/") ? finalPath : `/${finalPath}`;
    return `https://${handle}.myshopify.com/admin${cleanPath}`;
  }, [isComplete, currentPath, phValues, handle]);

  async function copyText(v: string, which: "v2" | "v1") {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      // best-effort fallback
      const ta = document.createElement("textarea");
      ta.value = v;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(which);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 1200);
  }

  /** ---------- Render ---------- */

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        {/* Top controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Store domain / handle</FieldLabel>
            <TextInput
              id="storeInput"
              placeholder="e.g. cool-store, cool-store.myshopify.com, or https://admin.shopify.com/store/cool-store"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              className={
                errors.store ? "border-red-500 ring-2 ring-red-200" : ""
              }
            />
            {errors.store && (
              <p className="text-sm text-red-600 mt-1">
                Enter a store handle or admin URL.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Page Root Type</FieldLabel>
            <Select
              id="rootSelect"
              value={rootKey}
              onChange={(e) => {
                const nextRoot = e.target.value;
                setLevels([]);
                setCurrentPath("");
                setPhValues({});
                setRootKey(nextRoot);
              }}
              aria-invalid={errors.root || undefined}
              className={
                errors.root ? "border-red-500 ring-2 ring-red-200" : ""
              }
            >
              <option value="" disabled>
                {links ? "Choose a root" : "Loading roots…"}
              </option>
              {links &&
                Object.keys(links.apps || {}).map((k) => (
                  <option key={k} value={k}>
                    {LABELS[k]}
                  </option>
                ))}
            </Select>
            {errors.root && (
              <p className="text-sm text-red-600 mt-1">
                Choose a starting section.
              </p>
            )}
          </div>
        </div>

        {/* Load error (file://, CORS, etc.) */}
        {loadErr && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3">
            <div className="font-medium">
              Couldn't load <code>links.json</code>.
            </div>
            <div className="text-sm mt-1">
              Serve over HTTP or pass <code>?json=&lt;url&gt;</code> to
              override.
            </div>
          </div>
        )}

        {/* Cascading selectors */}
        {rootKey && isObject(links?.apps?.[rootKey]) && (
          <div className="mt-4 space-y-3">
            {levels.map((lvl, idx) => {
              // compute options for this level based on parent object
              let parent: any = links!.apps[rootKey];
              for (let i = 0; i < idx; i++) {
                if (!isObject(parent)) break;
                parent = parent?.[levels[i].value];
              }
              if (!isObject(parent)) return null;
              const options = Object.keys(parent);

              return (
                <div key={idx}>
                  <FieldLabel>{`Level ${idx + 1}${
                    idx === 0 ? ` (${rootKey})` : ""
                  }`}</FieldLabel>
                  <Select
                    value={lvl.value}
                    onChange={(e) => {
                      const next = e.target.value;
                      const newLevels = levels.slice(0, idx + 1);
                      newLevels[idx] = {
                        label: lvl.label,
                        key: lvl.key,
                        value: next,
                      };
                      setLevels(newLevels);
                    }}
                    aria-invalid={errors.path || undefined}
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {options.map((k) => (
                      <option key={k} value={k}>
                        {LABELS[k]}
                      </option>
                    ))}
                  </Select>
                  {errors.path && (
                    <p className="text-sm text-red-600 mt-1">
                      Keep selecting until a final page (a link) is chosen.
                    </p>
                  )}
                </div>
              );
            })}

            {/* Add/Update the next selector or finalize when the current is object */}
            <NextSelector
              key={rootKey}
              rootKey={rootKey}
              links={links!}
              levels={levels}
              setLevels={setLevels}
            />
          </div>
        )}

        {/* Placeholder inputs */}
        {requiredPlaceholders.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {requiredPlaceholders.map((name) => {
              const isMissing = submitted && missingSet.has(name);
              return (
                <div key={name}>
                  <FieldLabel>{VAR_LABELS[name]}</FieldLabel>
                  <TextInput
                    id={`ph-${name}`}
                    placeholder={`Enter ${VAR_LABELS[name]}`}
                    value={phValues[name] || ""}
                    onChange={(e) =>
                      setPhValues((prev) => ({
                        ...prev,
                        [name]: e.target.value,
                      }))
                    }
                    aria-invalid={isMissing || undefined}
                    className={
                      isMissing ? "border-red-500 ring-2 ring-red-200" : ""
                    }
                  />
                  {submitted && missingPlaceholders.length > 0 && (
                    <p className="text-sm text-red-600 mt-2">
                      Please fill:{" "}
                      {missingPlaceholders
                        .map((n) => VAR_LABELS[n] ?? n)
                        .join(", ")}
                      .
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Generate */}
        <div className="mt-6">
          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 shadow hover:opacity-90"
            type="button"
            onClick={() => {
              setSubmitted(true);
              if (!isComplete) {
                if (!handle) document.getElementById("storeInput")?.focus();
                else if (!haveRoot)
                  document.getElementById("rootSelect")?.focus();
                else if (!currentPath)
                  document.querySelector("select")?.focus();
                else if (missingPlaceholders.length) {
                  document
                    .getElementById(`ph-${missingPlaceholders[0]}`)
                    ?.focus();
                }
                return;
              }
            }}
          >
            Generate URLs
          </button>
        </div>

        {/* Results */}
        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>
              Updated Shopify Admin URL{" "}
              <span className="text-gray-500">(Shopify 2.0)</span>
            </FieldLabel>
            <div className="flex gap-2">
              <TextInput
                readOnly
                value={resultV2}
                placeholder="Your Shopify 2.0 URL will appear here"
              />
              <button
                type="button"
                disabled={!isComplete}
                className={
                  "rounded-xl border border-gray-300 px-3 py-2 " +
                  (!isComplete
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50")
                }
                onClick={() => copyText(resultV2, "v2")}
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>
              Legacy Shopify Admin URL{" "}
              <span className="text-gray-500">(Shopify 1.0)</span>
            </FieldLabel>
            <div className="flex gap-2">
              <TextInput
                readOnly
                value={resultV1}
                placeholder="Your Shopify 1.0 URL will appear here"
              />
              <button
                type="button"
                disabled={!isComplete}
                className={
                  "rounded-xl border border-gray-300 px-3 py-2 " +
                  (!isComplete
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50")
                }
                onClick={() => copyText(resultV1, "v1")}
              >
                Copy
              </button>
            </div>
          </div>

          {copied && <p className="text-sm text-green-600">Copied!</p>}
        </div>

        {/* Tiny hint */}
        <p className="text-sm text-gray-500 mt-6">
          If additional variables like{" "}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-xs">
            Product Handle
          </span>{" "}
          or{" "}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-xs">
            Theme ID
          </span>{" "}
          are required, additional inputs will trigger automatically.
        </p>
      </Card>
    </div>
  );
}

/** Adds the next selector level (or starts the first) */
function NextSelector({
  rootKey,
  links,
  levels,
  setLevels,
}: {
  rootKey: string;
  links: LinksJson;
  levels: Array<{ label: string; key: string; value: string }>;
  setLevels: React.Dispatch<
    React.SetStateAction<Array<{ label: string; key: string; value: string }>>
  >;
}) {
  // Find the object for the "next" level
  let node: any = links.apps[rootKey];
  for (const lvl of levels) {
    if (!isObject(node)) {
      node = undefined;
      break;
    }
    node = node?.[lvl.value];
  }

  if (!isObject(node)) return null;

  const options = Object.keys(node as Record<string, any>);

  return (
    <div>
      <FieldLabel>{`Level ${levels.length + 1}${
        levels.length ? "" : ` (${rootKey})`
      }`}</FieldLabel>
      <Select
        value=""
        onChange={(e) => {
          const value = e.target.value;
          setLevels((prev) => [
            ...prev,
            {
              label: `Level ${prev.length + 1}`,
              key: `level-${prev.length}`,
              value,
            },
          ]);
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {options.map((k) => (
          <option key={k} value={k}>
            {LABELS[k]}
          </option>
        ))}
      </Select>
    </div>
  );
}
