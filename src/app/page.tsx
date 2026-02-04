"use client";

import { useMemo, useState } from "react";
import ImageUpload from "../components/ImageUpload";

const CATEGORIES = [
  { value: "coins", label: "Coins", mode: "coin" },
  { value: "bills", label: "Bills", mode: "currency" },
  { value: "sports_cards", label: "Sports Cards", mode: "card" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];
type ModeValue = (typeof CATEGORIES)[number]["mode"];

/** Detect which schema we got back */
function schemaType(r: any): "smoke" | "simple" | "unknown" {
  if (!r || typeof r !== "object") return "unknown";
  if (r.cardIdentification || r.coinIdentification || r.currencyIdentification || r.finalListing || r.valueEstimation) return "smoke";
  if (r.identification || r.pricing || r.selling_strategy) return "simple";
  return "unknown";
}

function getTitle(r: any): string {
  const t = schemaType(r);

  if (t === "simple") {
    return r?.identification?.title || "Result";
  }

  // smoke-test schema
  if (r?.finalListing?.suggestedTitle) return String(r.finalListing.suggestedTitle);

  if (r?.cardIdentification) {
    const ci = r.cardIdentification;
    return `${ci.year || ""} ${ci.manufacturer || ""} ${ci.cardSet || ""} ${ci.player || ""}`.trim() || "Sports Card";
  }
  if (r?.coinIdentification) {
    const ci = r.coinIdentification;
    return `${ci.year || ""} ${ci.country || ""} ${ci.denomination || ""} ${ci.seriesOrType || ""}`.trim() || "Coin";
  }
  if (r?.currencyIdentification) {
    const cu = r.currencyIdentification;
    return `${cu.seriesYearOrDate || ""} ${cu.country || ""} ${cu.denomination || ""}`.trim() || "Currency";
  }

  return "Result";
}

function getConfidence(r: any): string {
  const t = schemaType(r);

  if (t === "simple") {
    return r?.identification?.confidence || "unknown";
  }

  return (
    r?.cardIdentification?.confidenceLevel ||
    r?.coinIdentification?.confidenceLevel ||
    r?.currencyIdentification?.confidenceLevel ||
    "unknown"
  );
}

function getPriceLine(r: any): string | null {
  const t = schemaType(r);

  if (t === "simple") {
    const low = r?.pricing?.ebay_range_usd?.low;
    const high = r?.pricing?.ebay_range_usd?.high;
    const fmt = r?.pricing?.suggested_format ? String(r.pricing.suggested_format).replace(/_/g, " ") : null;
    const start = r?.pricing?.suggested_start_or_bin_usd;
    if (low != null && high != null) {
      const startText = start != null ? ` • Suggested ${fmt || "format"}: $${Number(start).toFixed(0)}` : "";
      return `Estimated eBay range: $${Number(low).toFixed(0)}–$${Number(high).toFixed(0)}${startText}`;
    }
    return null;
  }

  // smoke-test schema
  const raw = r?.valueEstimation?.estimatedRawValueRange;
  const graded = r?.valueEstimation?.estimatedGradedValueRange;
  if (raw && graded) return `Estimated raw: ${raw} • Estimated graded: ${graded}`;
  if (raw) return `Estimated raw: ${raw}`;
  return null;
}

function getBundleRecommendation(r: any): { decision: "Sell Individually" | "Bundle"; reason: string } {
  const t = schemaType(r);

  // Simple schema: use confidence + suggested strategy
  if (t === "simple") {
    const conf = r?.identification?.confidence;
    const rec = r?.pricing?.recommendation;
    if (conf === "high" && rec === "list_on_ebay") {
      return { decision: "Sell Individually", reason: "High confidence + eBay-ready guidance suggests listing this item alone for best return." };
    }
    return { decision: "Bundle", reason: "When confidence/value is uncertain, bundling with similar items reduces risk and can improve sell-through." };
  }

  // Smoke schema: use confidenceLevel + finalListing.ready + followups
  const conf =
    r?.cardIdentification?.confidenceLevel ||
    r?.coinIdentification?.confidenceLevel ||
    r?.currencyIdentification?.confidenceLevel;

  const ready = r?.finalListing?.ready === true;
  const followUps = Array.isArray(r?.followUpSuggestions) ? r.followUpSuggestions.length : 0;

  if (conf === "high" && ready) {
    return { decision: "Sell Individually", reason: "Clear ID + listing ready usually performs best as a single listing." };
  }
  if (followUps > 0) {
    return { decision: "Bundle", reason: "Uncertainty/missing details often sell better when grouped with similar items." };
  }
  return { decision: "Bundle", reason: "When details are unclear, bundling reduces time-to-sell and downside risk." };
}

export default function Home() {
  const [category, setCategory] = useState<CategoryValue>("coins");
  const [files, setFiles] = useState<File[]>([]);
  const [userDescription, setUserDescription] = useState<string>("");

  // Store whatever the API returns
  const [result, setResult] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: ModeValue = useMemo(
    () => CATEGORIES.find((c) => c.value === category)?.mode ?? "card",
    [category]
  );

  function resetAll() {
    setCategory("coins");
    setFiles([]);
    setUserDescription("");
    setResult(null);
    setRawResponse(null);
    setError(null);
    setLoading(false);
  }

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawResponse(null);

    try {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("provider", "openai");
      if (userDescription.trim()) fd.append("userDescription", userDescription.trim());
      files.forEach((f) => fd.append("image", f));

      const res = await fetch("/api/analyze", { method: "POST", body: fd });

      // Read text first so we can show non-JSON errors cleanly
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
      }

      setRawResponse(data);

      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      if (!data?.result) throw new Error("API returned success but missing `result`.");

      setResult(data.result);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const title = result ? getTitle(result) : "";
  const confidence = result ? getConfidence(result) : "";
  const priceLine = result ? getPriceLine(result) : null;
  const bundle = result ? getBundleRecommendation(result) : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/collector-hero.jpeg"
          alt="Collector Hero"
          className="w-full object-cover max-h-72 mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.07)]"
        />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-16">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Rookie Collector</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload photos of a coin, bill, or sports card. Get an ID + practical eBay selling guidance.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold mb-2">1) Upload</div>

            <label htmlFor="category-select" className="block text-sm font-semibold mb-1">Category</label>
            <select
              id="category-select"
              className="w-full border rounded-lg p-2 bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryValue)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold mt-4 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border rounded-lg p-2 bg-white min-h-[90px]"
              placeholder="Anything you know (year, mint mark, player, set, serial, etc.)"
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
            />

            <div className="mt-4">
              <ImageUpload files={files} setFiles={setFiles} max={6} />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                onClick={handleAnalyze}
                disabled={files.length === 0 || loading}
              >
                {loading ? "Analyzing…" : "Analyze"}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
                onClick={resetAll}
                disabled={loading}
                type="button"
              >
                Reset
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          {/* RIGHT */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold mb-2">2) Result</div>

            {!result ? (
              <div className="text-sm text-gray-600">
                Your analysis will appear here.
                {rawResponse && (
                  <div className="mt-3">
                    <details>
                      <summary className="cursor-pointer text-sm text-gray-700">
                        Debug: raw API response
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(rawResponse, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-bold">{title}</div>
                  <div className="mt-1 text-sm">
                    <span className="font-semibold">Confidence:</span>{" "}
                    <span className={confidence === "high" ? "text-green-700" : "text-orange-700"}>
                      {confidence}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      (schema: {schemaType(result)})
                    </span>
                  </div>
                </div>

                {priceLine && (
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                    {priceLine}
                  </div>
                )}

                {bundle && (
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                    <div className="font-semibold mb-1">Bundle / Sell Individually</div>
                    <div className="font-bold">{bundle.decision}</div>
                    <div className="text-gray-600 mt-1">{bundle.reason}</div>
                  </div>
                )}

                <details>
                  <summary className="cursor-pointer text-sm text-gray-700">Show raw JSON</summary>
                  <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
