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

function getConfidence(r: any): string {
  return (
    r?.cardIdentification?.confidenceLevel ||
    r?.coinIdentification?.confidenceLevel ||
    r?.currencyIdentification?.confidenceLevel ||
    "unknown"
  );
}
function getBundleRecommendation(r: any): {
  decision: "Sell Individually" | "Bundle";
  reason: string;
} {
  const confidence =
    r?.cardIdentification?.confidenceLevel ||
    r?.coinIdentification?.confidenceLevel ||
    r?.currencyIdentification?.confidenceLevel;

  const ready = r?.finalListing?.ready === true;
  const followUps = Array.isArray(r?.followUpSuggestions) ? r.followUpSuggestions.length : 0;

  if (confidence === "high" && ready) {
    return {
      decision: "Sell Individually",
      reason: "Clear identification and strong confidence usually perform best as single listings."
    };
  }

  if (followUps > 0) {
    return {
      decision: "Bundle",
      reason: "Uncertainty or missing details often sell better grouped with similar items."
    };
  }

  return {
    decision: "Bundle",
    reason: "When confidence or value is uncertain, bundling reduces risk and selling time."
  };
}

function getTitle(r: any): string {
  // Prefer finalListing title if present
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

function getKeyDetails(r: any): { label: string; value: string }[] {
  if (r?.cardIdentification) {
    const c = r.cardIdentification;
    return [
      { label: "Player", value: c.player || "—" },
      { label: "Set", value: c.cardSet || "—" },
      { label: "Year", value: c.year || "—" },
      { label: "Manufacturer", value: c.manufacturer || "—" },
      { label: "Card #", value: c.cardNumber || "—" },
    ];
  }
  if (r?.coinIdentification) {
    const c = r.coinIdentification;
    return [
      { label: "Country", value: c.country || "—" },
      { label: "Denomination", value: c.denomination || "—" },
      { label: "Year", value: c.year || "—" },
      { label: "Mint Mark", value: c.mintMark || "—" },
      { label: "Type", value: c.seriesOrType || "—" },
    ];
  }
  if (r?.currencyIdentification) {
    const c = r.currencyIdentification;
    return [
      { label: "Country", value: c.country || "—" },
      { label: "Denomination", value: c.denomination || "—" },
      { label: "Series/Date", value: c.seriesYearOrDate || "—" },
      { label: "Serial", value: c.serialNumber || "—" },
      { label: "Variety", value: c.notableVarietyOrStarNote || "—" },
    ];
  }
  return [];
}

export default function Home() {
  const [category, setCategory] = useState<CategoryValue>("coins");
  const [files, setFiles] = useState<File[]>([]);
  const [userDescription, setUserDescription] = useState<string>("");

  // IMPORTANT: smoke-test schema is mode-dependent, so store result as any
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
      files.forEach((f) => fd.append("image", f)); // must be "image"

      const res = await fetch("/api/analyze", { method: "POST", body: fd });

      // If server returns non-JSON, this prevents a crash and shows the raw text
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON: ${text.slice(0, 300)}`);
      }

      setRawResponse(data);

      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      if (!data?.result) {
        throw new Error("API returned success but no `result` field.");
      }

      setResult(data.result);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const title = result ? getTitle(result) : "";
  const confidence = result ? getConfidence(result) : "";
  const ready = result?.finalListing?.ready === true;
  const details = result ? getKeyDetails(result) : [];

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
            Upload photos of a coin, bill, or sports card. Get a practical ID + eBay selling guidance.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT: inputs */}
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
              <ImageUpload files={files} setFiles={setFiles} max={20} />
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

          {/* RIGHT: result */}
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
                  </div>
                </div>

                {details.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {details.map((d) => (
                      <div key={d.label} className="rounded-lg border bg-gray-50 p-2">
                        <div className="text-xs text-gray-500">{d.label}</div>
                        <div className="font-semibold text-gray-900">{d.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {result?.valueEstimation?.estimatedRawValueRange && (
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                    <div>
                      <span className="font-semibold">Estimated raw value:</span>{" "}
                      {result.valueEstimation.estimatedRawValueRange}
                    </div>
                    {result?.valueEstimation?.estimatedGradedValueRange && (
                      <div className="mt-1">
                        <span className="font-semibold">Estimated graded value:</span>{" "}
                        {result.valueEstimation.estimatedGradedValueRange}
                      </div>
                    )}
                  </div>
                )}

                {result?.finalListing && (
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-1">
                    <div>
                      <span className="font-semibold">Listing ready:</span> {ready ? "Yes" : "No"}
                    </div>
                    {result.finalListing.suggestedPriceStrategy && (
                      <div>
                        <span className="font-semibold">Strategy:</span>{" "}
                        {result.finalListing.suggestedPriceStrategy}
                      </div>
                    )}
                    {(result.finalListing.suggestedStartPrice || result.finalListing.suggestedBINPrice) && (
                      <div>
                        <span className="font-semibold">Start / BIN:</span>{" "}
                        {result.finalListing.suggestedStartPrice || "—"} /{" "}
                        {result.finalListing.suggestedBINPrice || "—"}
                      </div>
                    )}
                  </div>
                )}
{/* Bundle vs Individual Recommendation */}
{result && (() => {
  const bundle = getBundleRecommendation(result);
  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-sm">
      <div className="font-semibold mb-1">Bundle / Sell Individually</div>
      <div className="text-gray-900 font-bold">
        {bundle.decision}
      </div>
      <div className="text-gray-600 mt-1">
        {bundle.reason}
      </div>
    </div>
  );
})()}

                {Array.isArray(result?.followUpSuggestions) && result.followUpSuggestions.length > 0 && (
                  <div className="text-sm">
                    <div className="font-semibold mb-1">What to upload next</div>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {result.followUpSuggestions.map((x: string, i: number) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
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
