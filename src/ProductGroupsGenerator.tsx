import React, { useMemo, useReducer, useRef } from "react";

/** ----------------------- Types ----------------------- */
type Option = {
  id: number;
  name: string;
  values: string[]; // ordered, unique
  productStyle: string; // "Product Page Style Name"
  collectionStyle: string; // "Collection Page Style Name"
  valueCountInput: string;
};

type Combo = {
  id: string; // tuple.join("|")
  tuple: string[]; // length === options.length
  label: string; // `${productName} ${tuple.join(" ")}`
  url: string; // user input
};

type RecordRow = {
  label: string;
  url: string;
  tuple: string[];
  handle: string;
};

type GroupProduct = {
  value: string; // the value along this group’s varying option
  label: string;
  url: string;
  handle: string;
  tuple: string[];
};

type Group = {
  optionIndex: number;
  optionName: string;
  groupKey: string; // hash of fixed assignments
  groupName: string;
  products: GroupProduct[]; // ordered by the declared value order for optionIndex
};

/** ----------------------- Constants ----------------------- */

// You can tweak these to your team’s style name catalogs later:
const PRODUCT_PAGE_STYLES = [
  "Default Product Style",
  "Style A",
  "Style B",
  "Style C",
];
const COLLECTION_PAGE_STYLES = [
  "Default Collection Style",
  "Collection A",
  "Collection B",
  "Collection C",
];

/** ----------------------- State ----------------------- */

type State = {
  productName: string;
  numOptions: number; // 2..6
  numOptionsInput: string; //editable string for UI
  options: Option[];
  combinations: Combo[];
  fieldErrors: Map<string, string>; // combo.id -> error message for URL
  errors: string[]; // aggregated for banner
  richHtml: string;
};

type Action =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_NUM_OPTIONS_INPUT"; value: string }
  | { type: "APPLY_NUM_OPTIONS" }
  | { type: "BUILD_OPTIONS" }
  | {
      type: "SET_OPTION_META";
      index: number;
      name?: string;
      productStyle?: string;
      collectionStyle?: string;
    }
  | { type: "SET_OPTION_VALUE_COUNT_INPUT"; index: number; value: string }
  | { type: "APPLY_OPTION_VALUE_COUNT"; index: number }
  | {
      type: "SET_OPTION_VALUES";
      index: number;
      values: string[];
    }
  | { type: "BUILD_COMBINATIONS" }
  | { type: "SET_COMBO_URL"; id: string; url: string }
  | { type: "SET_FIELD_ERROR"; id: string; message?: string }
  | { type: "SET_ERRORS"; list: string[] }
  | { type: "SET_RICH_HTML"; html: string }
  | { type: "RESET_PREVIEW_AND_EXPORTS" };

const initialState: State = {
  productName: "",
  numOptions: 2,
  numOptionsInput: "2",
  options: [],
  combinations: [],
  fieldErrors: new Map(),
  errors: [],
  richHtml: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, productName: action.value };
    case "SET_NUM_OPTIONS_INPUT": {
      return { ...state, numOptionsInput: action.value };
    }
    case "APPLY_NUM_OPTIONS": {
      const parsed = parseInt(state.numOptionsInput || "", 10);
      const next = Number.isFinite(parsed)
        ? Math.max(2, Math.min(6, parsed))
        : state.numOptions;
      return { ...state, numOptions: next, numOptionsInput: String(next) };
    }
    case "BUILD_OPTIONS": {
      const opts: Option[] = Array.from({ length: state.numOptions }).map(
        (_, i) => ({
          id: i,
          name: "",
          values: [],
          productStyle: PRODUCT_PAGE_STYLES[0],
          collectionStyle: COLLECTION_PAGE_STYLES[0],
          valueCountInput: "0", // NEW
        })
      );
      return {
        ...state,
        options: opts,
        combinations: [],
        fieldErrors: new Map(),
        errors: [],
        richHtml: "",
      };
    }
    case "SET_OPTION_VALUE_COUNT_INPUT": {
      const next = state.options.map((o, idx) =>
        idx === action.index ? { ...o, valueCountInput: action.value } : o
      );
      return { ...state, options: next };
    }
    case "APPLY_OPTION_VALUE_COUNT": {
      const next = state.options.map((o, idx) => {
        if (idx !== action.index) return o;
        const parsed = parseInt(o.valueCountInput || "", 10);
        const count = Number.isFinite(parsed)
          ? Math.max(1, Math.min(50, parsed))
          : o.values.length;
        const values = (o.values || []).slice(0, count);
        while (values.length < count) values.push("");
        return { ...o, values, valueCountInput: String(count) };
      });
      return { ...state, options: next };
    }
    case "SET_OPTION_META": {
      const next = state.options.map((o, idx) =>
        idx === action.index
          ? {
              ...o,
              name: action.name ?? o.name,
              productStyle: action.productStyle ?? o.productStyle,
              collectionStyle: action.collectionStyle ?? o.collectionStyle,
            }
          : o
      );
      return { ...state, options: next };
    }
    case "SET_OPTION_VALUES": {
      const next = state.options.map((o, idx) =>
        idx === action.index ? { ...o, values: action.values } : o
      );
      return { ...state, options: next };
    }
    case "BUILD_COMBINATIONS": {
      const { ok, errors } = validateConfig(state);
      if (!ok) return { ...state, errors };

      const strict = validateValueSlotsFilled(state);
      if (!strict.ok) return { ...state, errors: strict.errors };

      const combos = buildCombinations(state.productName.trim(), state.options);
      return {
        ...state,
        combinations: combos,
        fieldErrors: new Map(),
        errors: [],
        richHtml: "",
      };
    }
    case "SET_COMBO_URL": {
      const combos = state.combinations.map((c) =>
        c.id === action.id ? { ...c, url: action.url } : c
      );
      return { ...state, combinations: combos };
    }
    case "SET_FIELD_ERROR": {
      const next = new Map(state.fieldErrors);
      if (!action.message) next.delete(action.id);
      else next.set(action.id, action.message);
      return { ...state, fieldErrors: next };
    }
    case "SET_ERRORS":
      return { ...state, errors: action.list };
    case "SET_RICH_HTML":
      return { ...state, richHtml: action.html };
    case "RESET_PREVIEW_AND_EXPORTS":
      return { ...state, richHtml: "" };
  }
}

/** ----------------------- Helpers ----------------------- */

function trimDedupePreserveOrder(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function validateConfig(s: State): { ok: boolean; errors: string[] } {
  const errs: string[] = [];
  if (!s.productName.trim()) errs.push("Product name is required.");
  if (!s.options.length) errs.push("Click “Build options” first.");
  s.options.forEach((o, i) => {
    if (!o.name.trim()) errs.push(`Option ${i + 1}: name is required.`);
    const vals = trimDedupePreserveOrder(o.values || []);
    if (!vals.length) errs.push(`Option ${i + 1}: add at least one value.`);
    if (!o.productStyle) errs.push(`Option ${i + 1}: select Product Style.`);
    if (!o.collectionStyle)
      errs.push(`Option ${i + 1}: select Collection Style.`);
  });
  return { ok: errs.length === 0, errors: errs };
}

function validateValueSlotsFilled(s: State): { ok: boolean; errors: string[] } {
  const errs: string[] = [];
  s.options.forEach((o, i) => {
    const parsed = parseInt(o.valueCountInput || "", 10);
    const expected = Number.isFinite(parsed)
      ? Math.max(1, Math.min(50, parsed))
      : o.values.length;

    // only look at the first `expected` slots (these are created by APPLY_OPTION_VALUE_COUNT)
    const filled = (o.values || [])
      .slice(0, expected)
      .filter((v) => v.trim() !== "").length;
    if (filled < expected) {
      errs.push(
        `Option ${i + 1}: fill all value fields (${filled}/${expected}).`
      );
    }
  });
  return { ok: errs.length === 0, errors: errs };
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return [];
  return arrays.reduce<T[][]>(
    (acc, arr) =>
      acc
        .map((a) => arr.map((b) => a.concat([b])))
        .reduce((a, b) => a.concat(b), []),
    [[]]
  );
}

function buildCombinations(productName: string, options: Option[]): Combo[] {
  const arrays = options.map((o) => trimDedupePreserveOrder(o.values));
  const tuples = cartesianProduct(arrays);
  return tuples.map((tuple) => {
    const label = [productName, ...tuple].filter(Boolean).join(" ").trim();
    const id = tuple.join("|");
    return { id, tuple, label, url: "" };
  });
}

// URL normalize + handle extraction
function normalizeUrlMaybe(u: string): string {
  let val = (u || "").trim();
  if (!val) return "";
  if (!/^https?:\/\//i.test(val)) val = "https://" + val;
  try {
    const url = new URL(val);
    return url.toString();
  } catch {
    return val; // leave for detailed validator to flag
  }
}

function extractHandleFromShopifyUrl(u: string): {
  ok: boolean;
  handle?: string;
  message?: string;
} {
  const raw = normalizeUrlMaybe(u);
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, "");
    // /products/<handle>
    const m1 = path.match(/\/products\/([^/]+)$/i);
    if (m1) return { ok: true, handle: decodeURIComponent(m1[1]) };
    // /collections/<collection>/products/<handle>
    const m2 = path.match(/\/collections\/[^/]+\/products\/([^/]+)$/i);
    if (m2) return { ok: true, handle: decodeURIComponent(m2[1]) };
    return {
      ok: false,
      message:
        "URL must be /products/<handle> or /collections/<collection>/products/<handle>",
    };
  } catch {
    return { ok: false, message: "Invalid URL." };
  }
}

function validateAllUrls(combos: Combo[]): {
  ok: boolean;
  perField: Map<string, string>;
  errors: string[];
} {
  const perField = new Map<string, string>();
  const errors: string[] = [];
  combos.forEach((c) => {
    const v = c.url.trim();
    if (!v) {
      perField.set(c.id, "URL required.");
      return;
    }
    const res = extractHandleFromShopifyUrl(v);
    if (!res.ok) perField.set(c.id, res.message || "Invalid URL.");
  });
  if (perField.size) errors.push("Fix URL errors highlighted below.");
  return { ok: perField.size === 0, perField, errors };
}

function toRecords(combos: Combo[]): RecordRow[] {
  return combos.map((c) => {
    const norm = normalizeUrlMaybe(c.url);
    const { ok, handle } = extractHandleFromShopifyUrl(norm);
    return {
      label: c.label,
      url: norm,
      tuple: c.tuple,
      handle: ok ? (handle as string) : "",
    };
  });
}

/**
 * Grouping rule (no nearest-match):
 * For each dimension d, for each fixed assignment of the other (n-1) options,
 * create one group with products that vary only on option d.
 * Each product appears in exactly n groups (one per dimension).
 */
function buildGroups(
  records: RecordRow[],
  options: Option[],
  productName: string
): Group[] {
  const n = options.length;
  if (!n) return [];
  // Index by tuple string for O(1) lookup
  const byTuple = new Map<string, RecordRow>();
  records.forEach((r) => byTuple.set(r.tuple.join("|"), r));

  const groups: Group[] = [];

  for (let d = 0; d < n; d++) {
    const otherIdx = options.map((_, i) => i).filter((i) => i !== d);

    // For every fixed assignment of other options
    // Build arrays of their values (ordered)
    const otherArrays = otherIdx.map((i) =>
      trimDedupePreserveOrder(options[i].values)
    );
    const otherTuples = cartesianProduct(otherArrays);

    for (const otherVals of otherTuples) {
      // Compose a base tuple with placeholders
      const base: string[] = Array(n).fill("");
      otherIdx.forEach((i, k) => (base[i] = otherVals[k]));

      const varyingValues = trimDedupePreserveOrder(options[d].values);
      const products: GroupProduct[] = [];

      for (const v of varyingValues) {
        const t = base.slice();
        t[d] = v;
        const rec = byTuple.get(t.join("|"));
        if (!rec) continue; // should not happen since combinations are exhaustive
        products.push({
          value: v,
          label: rec.label,
          url: rec.url,
          handle: rec.handle,
          tuple: rec.tuple,
        });
      }

      // Stable group key & human name
      const kv: string[] = [];
      otherIdx.forEach((i, k) =>
        kv.push(`${options[i].name}: ${otherVals[k]}`)
      );
      const groupName = `${options[d].name} Group for ${kv.join(
        ", "
      )} — ${productName}`;
      const groupKey = `d=${d}|${otherIdx
        .map((i, k) => `${i}:${otherVals[k]}`)
        .join("|")}`;

      groups.push({
        optionIndex: d,
        optionName: options[d].name,
        groupKey,
        groupName,
        products,
      });
    }
  }

  return groups;
}

/** ----------------------- CSV ----------------------- */

function escapeCsvCell(s: string) {
  const needsQuote = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needsQuote ? `"${v}"` : v;
}

function toCsvString(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
}

function buildRowsVSK(
  groups: Group[],
  options: Option[],
  productName: string
): string[][] {
  const header = [
    "Group Name",
    "Option Name",
    "Option Value",
    "Product Name",
    "Product Handle",
    "Product URL",
    "Product Page Style Name",
    "Collection Page Style Name",
  ];
  const out: string[][] = [header];
  for (const g of groups) {
    const opt = options[g.optionIndex];
    for (const p of g.products) {
      out.push([
        g.groupName,
        opt.name,
        p.value,
        p.label,
        p.handle,
        p.url,
        opt.productStyle,
        opt.collectionStyle,
      ]);
    }
  }
  return out;
}

// VKCL = VSK + Category Name
function buildRowsVKCL(
  groups: Group[],
  options: Option[],
  productName: string
): string[][] {
  const base = buildRowsVSK(groups, options, productName);
  const header = base[0].slice();
  header.push("Category Name");
  const out = [header];
  for (let i = 1; i < base.length; i++) {
    const row = base[i].slice();
    row.push(""); // placeholder if you want to fill categories later
    out.push(row);
  }
  return out;
}

/** ----------------------- Rich Output ----------------------- */

function toHtml(
  groups: Group[],
  options: Option[],
  productName: string
): string {
  // Summary
  const optsSummary = options
    .map(
      (o) =>
        `<li><strong>${escapeHtml(o.name)}:</strong> ${escapeHtml(
          o.values.join(", ")
        )}</li>`
    )
    .join("");

  let html = `
  <div>
    <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
    <p><strong>Options:</strong></p>
    <ul>${optsSummary}</ul>
  </div>`;

  // Sections per option (grouped)
  const byOption = new Map<number, Group[]>();
  groups.forEach((g) => {
    const arr = byOption.get(g.optionIndex) || [];
    arr.push(g);
    byOption.set(g.optionIndex, arr);
  });

  for (const [optIndex, list] of byOption) {
    const optName = options[optIndex].name;
    html += `<h3 style="margin-top:1rem">${escapeHtml(optName)} Groups</h3>`;
    // Keep groups in a stable order by their groupName
    const sorted = list
      .slice()
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
    for (const g of sorted) {
      html += `<div style="border:1px dashed #ddd;padding:.75rem;border-radius:.5rem;margin:.5rem 0">
        <div><strong>${escapeHtml(g.groupName)}</strong></div>
        <ol style="margin:.5rem 0 .25rem 1rem">`;
      for (const p of g.products) {
        const hasUrl = (p.url || "").trim().length > 0;
        const linkHtml = hasUrl
          ? `<a href="${escapeAttr(
              p.url
            )}" target="_blank" rel="noopener">${escapeHtml(p.label)}</a>`
          : `<span>${escapeHtml(p.label)}</span>`;
        html += `<li>${escapeHtml(p.value)} — ${linkHtml}</li>`;
      }
      html += `</ol></div>`;
    }
  }

  return html;
}

function toPlainText(html: string): string {
  // very light strip for copying; this is fine for our case
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(ul|ol|p|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}

async function copyHtmlAndText(html: string) {
  const text = toPlainText(html);
  if (navigator.clipboard && "write" in navigator.clipboard) {
    const blobHtml = new Blob([html], { type: "text/html" });
    const blobText = new Blob([text], { type: "text/plain" });
    const item = new ClipboardItem({
      "text/html": blobHtml,
      "text/plain": blobText,
    });
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/** ----------------------- UI ----------------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
) {
  const { invalid, className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        "w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
        invalid
          ? "border-red-500 ring-red-200"
          : "border-gray-300 ring-blue-200",
        className || "",
      ].join(" ")}
    />
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
) {
  const { invalid, className = "", children, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        "w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
        invalid
          ? "border-red-500 ring-red-200"
          : "border-gray-300 ring-blue-200",
        className || "",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

export default function ProductGroupsGenerator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);

  const canBuildOptions = state.numOptions >= 2 && state.numOptions <= 6;
  const canBuildCombos = useMemo(() => {
    const { ok } = validateConfig(state);
    return ok;
  }, [state.productName, state.options, state.numOptions]);

  const onValidateAll = () => {
    const { ok, perField, errors } = validateAllUrls(state.combinations);
    dispatch({ type: "SET_ERRORS", list: errors });
    // apply field errors
    const nextErrors = new Map<string, string>();
    perField.forEach((msg, id) => nextErrors.set(id, msg));
    // clear others that are fine
    state.combinations.forEach((c) => {
      if (!perField.has(c.id)) nextErrors.delete(c.id);
    });
    // set individually so controlled inputs re-render correctly
    state.combinations.forEach((c) =>
      dispatch({
        type: "SET_FIELD_ERROR",
        id: c.id,
        message: perField.get(c.id) || undefined,
      })
    );
    return ok;
  };

  const onExport = (variant: "VSK" | "VKCL") => {
    if (!onValidateAll()) return;
    const records = toRecords(state.combinations);
    // ensure no missing handles
    if (records.some((r) => !r.handle)) {
      dispatch({
        type: "SET_ERRORS",
        list: ["Fix URL errors highlighted below."],
      });
      return;
    }
    const groups = buildGroups(
      records,
      state.options,
      state.productName.trim()
    );
    const rows =
      variant === "VSK"
        ? buildRowsVSK(groups, state.options, state.productName.trim())
        : buildRowsVKCL(groups, state.options, state.productName.trim());
    const csv = toCsvString(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = downloadLinkRef.current!;
    a.href = url;
    a.download = `${state.productName || "groups"}-${variant}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const onGenerateRich = () => {
    const records = toRecords(state.combinations);

    const groups = buildGroups(
      records,
      state.options,
      state.productName.trim()
    );
    const html = toHtml(groups, state.options, state.productName.trim());
    dispatch({ type: "SET_RICH_HTML", html });
  };

  const onCopyRich = async () => {
    if (!state.richHtml) return;
    await copyHtmlAndText(state.richHtml);
    alert("Copied!");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Product Groups Generator
          </h1>
          <hr style={{ margin: "1em 0" }} />
          <p className="text-gray-600 text-sm">
            Build multi-option setups using only product groups by specifying
            options and option values. Also get ready-to-import CSVs for VSK and
            VKCL, and a ready-to-paste guide for intercom chat with Rich HTML
            formatiing.
          </p>
        </div>
      </div>

      {/* Config card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <FieldLabel>Product name</FieldLabel>
            <TextInput
              value={state.productName}
              onChange={(e) =>
                dispatch({ type: "SET_NAME", value: e.currentTarget.value })
              }
              placeholder="e.g., Premium Tee"
            />
          </div>
          <div>
            <FieldLabel># of options (2–6)</FieldLabel>
            <TextInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={state.numOptionsInput}
              onChange={(e) =>
                dispatch({
                  type: "SET_NUM_OPTIONS_INPUT",
                  value: e.currentTarget.value,
                })
              }
              onBlur={() => dispatch({ type: "APPLY_NUM_OPTIONS" })}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!canBuildOptions}
              onClick={() => {
                dispatch({ type: "APPLY_NUM_OPTIONS" });
                dispatch({ type: "BUILD_OPTIONS" });
              }}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              Build options
            </button>
          </div>
        </div>
      </section>

      {/* Options builder */}
      {state.options.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Options</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {state.options.map((o, idx) => (
              <div key={o.id} className="rounded-xl border border-gray-200 p-4">
                <div className="grid gap-3">
                  <div>
                    <FieldLabel>Option name</FieldLabel>
                    <TextInput
                      value={o.name}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_OPTION_META",
                          index: idx,
                          name: e.currentTarget.value,
                        })
                      }
                      placeholder={`e.g., Color`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Product Page Style</FieldLabel>
                      <Select
                        value={o.productStyle}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_OPTION_META",
                            index: idx,
                            productStyle: e.currentTarget.value,
                          })
                        }
                      >
                        {PRODUCT_PAGE_STYLES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Collection Page Style</FieldLabel>
                      <Select
                        value={o.collectionStyle}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_OPTION_META",
                            index: idx,
                            collectionStyle: e.currentTarget.value,
                          })
                        }
                      >
                        {COLLECTION_PAGE_STYLES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-1">
                      <FieldLabel># of values</FieldLabel>
                      <TextInput
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={o.valueCountInput}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_OPTION_VALUE_COUNT_INPUT",
                            index: idx,
                            value: e.currentTarget.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() =>
                          dispatch({
                            type: "APPLY_OPTION_VALUE_COUNT",
                            index: idx,
                          })
                        }
                        className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
                      >
                        Build Option Values
                      </button>
                    </div>
                  </div>

                  {o.values.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {o.values.map((v, i) => (
                        <TextInput
                          key={i}
                          value={v}
                          onChange={(e) => {
                            const next = o.values.slice();
                            next[i] = e.currentTarget.value;
                            dispatch({
                              type: "SET_OPTION_VALUES",
                              index: idx,
                              values: next,
                            });
                          }}
                          placeholder={`Value ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            {state.errors.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <ul className="list-disc pl-5">
                  {state.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              disabled={!canBuildCombos}
              onClick={() => {
                state.options.forEach((_, i) =>
                  dispatch({ type: "APPLY_OPTION_VALUE_COUNT", index: i })
                );
                dispatch({ type: "BUILD_COMBINATIONS" });
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              Build combinations
            </button>
          </div>
        </section>
      )}

      {/* Combinations (Label + URL only, no checklist) */}
      {state.combinations.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Combinations
          </h2>

          {state.errors.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <ul className="list-disc pl-5">
                {state.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3">
            {state.combinations.map((c) => {
              const err = state.fieldErrors.get(c.id);
              return (
                <div
                  key={c.id}
                  className="grid gap-2 rounded-xl border border-gray-200 p-3 md:grid-cols-[1fr,1fr]"
                >
                  <div className="flex items-center">
                    <span className="truncate text-sm font-medium text-gray-800">
                      {c.label}
                    </span>
                  </div>
                  <div>
                    <TextInput
                      placeholder="https://example.com/products/handle"
                      value={c.url}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_COMBO_URL",
                          id: c.id,
                          url: e.currentTarget.value,
                        })
                      }
                      onBlur={(e) => {
                        const res = extractHandleFromShopifyUrl(
                          e.currentTarget.value
                        );
                        dispatch({
                          type: "SET_FIELD_ERROR",
                          id: c.id,
                          message: res.ok
                            ? undefined
                            : res.message || "Invalid URL.",
                        });
                      }}
                      invalid={!!err}
                    />
                    {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const ok = onValidateAll();
                if (!ok) return;
                alert("Looks good! You can export or generate rich output.");
              }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700"
            >
              Validate all URLs
            </button>

            <button
              type="button"
              onClick={() => onExport("VSK")}
              className="rounded-xl bg-gray-800 px-4 py-2 text-white shadow hover:bg-black"
            >
              Export CSV (VSK)
            </button>
            <button
              type="button"
              onClick={() => onExport("VKCL")}
              className="rounded-xl bg-gray-800 px-4 py-2 text-white shadow hover:bg-black"
            >
              Export CSV (VKCL)
            </button>

            <button
              type="button"
              onClick={onGenerateRich}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
            >
              Generate Rich Output
            </button>
            <button
              type="button"
              onClick={onCopyRich}
              disabled={!state.richHtml}
              className="rounded-xl bg-white px-4 py-2 text-gray-800 shadow hover:bg-gray-50 disabled:opacity-50"
            >
              Copy Rich Output
            </button>
            {/* hidden anchor for CSV downloads */}
            <a ref={downloadLinkRef} className="hidden" />
          </div>
        </section>
      )}

      {/* Rich preview */}
      {state.richHtml && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Preview</h2>
          <div
            className="prose max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
            dangerouslySetInnerHTML={{ __html: state.richHtml }}
          />
        </section>
      )}
    </div>
  );
}
