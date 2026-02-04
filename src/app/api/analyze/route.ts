import OpenAI from "openai";
import sharp from "sharp";
import heicConvert from "heic-convert";

export const runtime = "nodejs";

// Helper to sniff HEIC/HEIF by magic bytes (same as server.mjs)
function sniffHeic(buf: Buffer) {
  if (!buf || buf.length < 12) return false;
  // 'ftypheic' or 'ftypheif' at offset 4
  return (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70 &&
    ((buf[8] === 0x68 && buf[9] === 0x65 && buf[10] === 0x69 && buf[11] === 0x63) ||
      (buf[8] === 0x68 && buf[9] === 0x65 && buf[10] === 0x69 && buf[11] === 0x66))
  );
}

// ROI helpers (copied from server.mjs)
function toNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseMoneyRange(str: any) {
  if (!str || typeof str !== "string") return null;

  const cleaned = str.replace(/[,]/g, "").trim();
  const nums = cleaned.match(/(\d+(\.\d+)?)/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;

  if (nums.length === 1) return { low: nums[0], high: nums[0] };

  const low = Math.min(nums[0], nums[1]);
  const high = Math.max(nums[0], nums[1]);
  return { low, high };
}

// Your server.mjs computeGradingROI is incomplete; keep behavior safe & non-breaking.
function computeGradingROI(result: any, env: NodeJS.ProcessEnv = process.env) {
  const feeRate = toNum(env.EBAY_FEE_RATE, 0.135);
  const gradingAllIn = toNum(env.GRADING_ALL_IN_USD, 35);

  const rawRange = parseMoneyRange(result?.valueEstimation?.estimatedRawValueRange);
  const gradedRange = parseMoneyRange(result?.valueEstimation?.estimatedGradedValueRange);

  if (
    result?.cardIdentification?.confidenceLevel !== "high" ||
    !rawRange ||
    !gradedRange
  ) {
    return {
      ready: false,
      reason: "Needs confidenceLevel=high and both value ranges to compute ROI.",
      feeRate,
      gradingAllIn,
    };
  }

  // If you want, we can finish this later.
  return {
    ready: false,
    reason: "ROI calculation not implemented (ported as-is from smoke test).",
    feeRate,
    gradingAllIn,
    rawRange,
    gradedRange,
  };
}

// EXACT prompt builder copied from your server.mjs
function buildInstruction(mode: string) {
  if (mode === "coin") {
    return `
You are an expert coin authenticator and eBay seller.

You will receive images of the SAME coin (front/back and close-ups).
Return VALID JSON ONLY. No markdown, no extra text.

Schema:
{
  "coinIdentification": {
    "country": "",
    "denomination": "",
    "year": "",
    "mintMark": "",
    "seriesOrType": "",
    "composition": "",
    "notableVariety": "",
    "confidenceLevel": "high | medium | low",
    "uncertainties": ""
  },
  "conditionAssessment": {
    "estimatedGradeRange": "",
    "wearHighPoints": "",
    "rimCondition": "",
    "surfaceMarks": "",
    "lusterOrPatina": "",
    "cleanedOrAlteredSuspected": "yes | no | unsure",
    "notes": ""
  },
  "valueEstimation": {
    "estimatedRawValueRange": "",
    "estimatedGradedValueRange": "",
    "assumptions": "",
    "pricingConfidence": "high | medium | low"
  },
  "finalListing": {
    "ready": false,
    "suggestedTitle": "",
    "suggestedCategory": "Coins & Paper Money > Coins: US > (or appropriate category)",
    "suggestedPriceStrategy": "",
    "suggestedStartPrice": "",
    "suggestedBINPrice": "",
    "recommendedConditionLabel": "",
    "keyDetails": {
      "Country": "",
      "Denomination": "",
      "Year": "",
      "Mint Mark": "",
      "Composition": "",
      "Variety": ""
    },
    "descriptionBullets": [],
    "shippingPlan": {
      "packageMethod": "",
      "service": "",
      "insuranceSuggestion": ""
    },
    "disclosureNotes": [],
    "ebayDescription": ""
  },
  "followUpSuggestions": []
}

Rules:
- If confidenceLevel is "high": finalListing.ready MUST be true and listing fields populated.
- If confidenceLevel is "medium" or "low": finalListing.ready MUST be false, listing fields empty, and followUpSuggestions populated.
- Do not claim a rare variety unless you can clearly see the diagnostics.
- Value ranges should be conservative and based on typical sold outcomes, not asking prices.
- If cleanedOrAlteredSuspected is "yes" or "unsure", value should reflect that risk.
`;
  }

  if (mode === "currency") {
    return `
You are an expert paper currency (banknote) authenticator and eBay seller.

You will receive images of the SAME note (front/back and close-ups).
Return VALID JSON ONLY. No markdown, no extra text.

Schema:
{
  "currencyIdentification": {
    "country": "",
    "issuer": "",
    "denomination": "",
    "seriesYearOrDate": "",
    "signatureOrSealType": "",
    "serialNumber": "",
    "notableVarietyOrStarNote": "",
    "confidenceLevel": "high | medium | low",
    "uncertainties": ""
  },
  "conditionAssessment": {
    "estimatedGradeRange": "",
    "foldsAndCreases": "",
    "edgesAndCorners": "",
    "paperQuality": "",
    "stainsOrTears": "",
    "writingOrHoles": "",
    "notes": ""
  },
  "valueEstimation": {
    "estimatedRawValueRange": "",
    "assumptions": "",
    "pricingConfidence": "high | medium | low"
  },
  "finalListing": {
    "ready": false,
    "suggestedTitle": "",
    "suggestedCategory": "Coins & Paper Money > Paper Money: US > (or appropriate category)",
    "suggestedPriceStrategy": "",
    "suggestedStartPrice": "",
    "suggestedBINPrice": "",
    "recommendedConditionLabel": "",
    "keyDetails": {
      "Country": "",
      "Denomination": "",
      "Series": "",
      "Serial Number": "",
      "Variety": ""
    },
    "descriptionBullets": [],
    "shippingPlan": {
      "packageMethod": "",
      "service": "",
      "insuranceSuggestion": ""
    },
    "disclosureNotes": [],
    "ebayDescription": ""
  },
  "followUpSuggestions": []
}

Rules:
- If confidenceLevel is "high": finalListing.ready MUST be true and listing fields populated.
- If confidenceLevel is "medium" or "low": finalListing.ready MUST be false, listing fields empty, and followUpSuggestions populated.
- Do not claim “star note”, “replacement”, “rare signature”, or special variety unless clearly visible.
- Value estimates should be conservative, based on typical sold outcomes.
`;
  }

  // default: sports card mode (your prompt)
  return `
You are an expert sports card authenticator and eBay power seller.

You will receive multiple images of the SAME card (front, back, and close-ups).

Return VALID JSON ONLY.
No markdown. No commentary. No explanations outside the JSON.

Use this EXACT schema:

{
  "cardIdentification": {
    "player": "",
    "team": "",
    "sport": "",
    "manufacturer": "",
    "year": "",
    "cardSet": "",
    "cardNumber": "",
    "specialAttributes": [],
    "confidenceLevel": "high | medium | low",
    "uncertainties": ""
  },
  "conditionAssessment": {
    "visibleCondition": "",
    "cornerAssessment": "",
    "surfaceAssessment": "",
    "centeringAssessment": "",
    "edgesAssessment": "",
    "overallEstimatedCondition": ""
  },
  "valueEstimation": {
    "estimatedRawValueRange": "",
    "estimatedGradedValueRange": "",
    "assumptions": "",
    "pricingConfidence": "high | medium | low"
  },
  "finalListing": {
    "ready": false,
    "suggestedTitle": "",
    "suggestedSubtitle": "",
    "suggestedCategory": "",
    "suggestedPriceStrategy": "",
    "suggestedStartPrice": "",
    "suggestedBINPrice": "",
    "recommendedConditionLabel": "",
    "itemSpecifics": {
      "Player": "",
      "Team": "",
      "League": "",
      "Season": "",
      "Set": "",
      "Manufacturer": "",
      "Sport": "",
      "Card Number": "",
      "Autographed": "No/Yes/Unknown",
      "Graded": "No/Yes/Unknown",
      "Professional Grader": "",
      "Grade": ""
    },
    "descriptionBullets": [],
    "shippingPlan": {
      "packageMethod": "",
      "service": "",
      "insuranceSuggestion": ""
    },
    "photoChecklist": [],
    "disclosureNotes": [],
    "ebayDescription": ""
  },
  "followUpSuggestions": []
}

FINAL LISTING RULES:
- If confidenceLevel is "high":
  - finalListing.ready MUST be true
  - Populate ALL finalListing fields
  - Populate finalListing.ebayDescription as a complete eBay-ready description
- If confidenceLevel is "medium" or "low":
  - finalListing.ready MUST be false
  - All finalListing string fields MUST be empty strings
  - All finalListing array fields MUST be empty arrays
  - finalListing.ebayDescription MUST exist but be an empty string

EBAY DESCRIPTION RULES:
- Only populate ebayDescription when finalListing.ready is true
- Write plain text suitable for direct paste into eBay
- Include:
  - Short intro identifying the card
  - Condition paragraph consistent with conditionAssessment
  - What is included
  - Shipping method
  - Brief seller-style disclaimer
- Do NOT exaggerate condition or value

VALUE ESTIMATION RULES:
- Only populate valueEstimation if confidenceLevel is "high"
- Use recent typical eBay SOLD outcomes, not asking prices
- Be conservative
- Assume PSA 6–8 equivalent unless condition strongly supports otherwise
- Never assume gem mint
- If uncertain, widen ranges and lower pricingConfidence
- Never imply guaranteed value

CONDITION RULES:
- If corners show visible rounding OR surface scuffs are visible:
  - Do NOT classify as Near Mint
- When in doubt, choose the LOWER plausible condition
- Ensure condition language is consistent across all sections

IDENTIFICATION RULES:
- Do NOT invent year, set, or card number unless visible or clearly confirmed
- Only include "Rookie Card" if the card is widely recognized as a rookie AND year/set/cardNumber are confirmed
- If anything is uncertain, state it explicitly and lower confidenceLevel

FOLLOW-UP RULES:
- If confidenceLevel is "medium" or "low":
  - followUpSuggestions MUST list specific missing photos or details needed to reach "high"
- If confidenceLevel is "high":
  - followUpSuggestions MUST be an empty array
`;
}

// Same safe JSON parse logic as server.mjs
function safeJsonParse(text: string): any {
  const startTag = "<<<JSON";
  const endTag = "JSON>>>";
  const s = text.indexOf(startTag);
  const e = text.lastIndexOf(endTag);
  if (s !== -1 && e !== -1 && e > s) {
    const inside = text.slice(s + startTag.length, e).trim();
    return JSON.parse(inside);
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("Model did not return JSON.");
}

// Convert a Next.js File -> normalized JPEG buffer (same idea as server.mjs)
async function fileToJpegBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  let buf = Buffer.from(ab);

  if (sniffHeic(buf)) {
    buf = Buffer.from(
      (await heicConvert({
        buffer: buf,
        format: "JPEG",
        quality: 0.92,
      })) as Uint8Array
    );
  }

  const jpegBuf = await sharp(buf).jpeg({ quality: 92 }).toBuffer();
  return jpegBuf;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const mode = String(form.get("mode") ?? "card").toLowerCase();
    const provider = String(form.get("provider") ?? "openai");
    let userDescription = String(form.get("userDescription") ?? "").trim();

    const instruction =
      buildInstruction(mode) +
      (userDescription ? `\n\nUSER-PROVIDED DETAILS: ${userDescription}` : "");

    const files = form.getAll("image").filter(Boolean) as File[];

    if (!files.length) {
      return Response.json({ error: "No images uploaded." }, { status: 400 });
    }

    // Normalize images (HEIC->JPEG; then JPEG normalize)
    const imageBuffers: Buffer[] = [];
    for (const file of files) {
      imageBuffers.push(await fileToJpegBuffer(file));
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const aiProvider = provider === "claude" && anthropicKey ? "claude" : "openai";
    let result: any = null;

    if (aiProvider === "claude") {
      // matches your server.mjs behavior
      return Response.json(
        { error: "Anthropic Claude integration is temporarily disabled." },
        { status: 503 }
      );
    }

    if (!openaiKey) {
      return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    // EXACT: only first image used
    const dataUrl = `data:image/jpeg;base64,${imageBuffers[0].toString("base64")}`;

    // EXACT: example + json block prompt
    const example = {
      category: "coins",
      identification: {
        title: "1909 Lincoln Cent (example)",
        subtitle: null,
        confidence: "medium",
        reasons: ["Example reason"],
        key_fields: { year: "1909", mint: null },
      },
      condition: {
        guessed_grade_band: "VG–F",
        notes: ["Example note"],
        red_flags: [],
      },
      pricing: {
        recommendation: "research_comps",
        ebay_range_usd: { low: 10, high: 30 },
        suggested_format: "auction",
        suggested_start_or_bin_usd: 9.99,
        rationale: ["Example rationale"],
      },
      selling_strategy: {
        sell_as: "single",
        lotting_notes: [],
        title_template: "{YEAR} {DENOM} {TYPE} {MINT}",
        photo_checklist: ["Front", "Back", "Close-up"],
        shipping_recommendation: "Example shipping",
        warnings: [],
        next_steps: ["Example next step"],
      },
    };

    const jsonBlockPrompt =
      `Return JSON exactly like this shape:\n${JSON.stringify(example, null, 2)}\n` +
      `Return ONLY JSON.\nStart with: <<<JSON\nEnd with: JSON>>>`;

    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: instruction + " Analyze these images as described above.\n" + jsonBlockPrompt,
            },
            { type: "input_image", image_url: dataUrl, detail: "auto" },
          ],
        },
      ],
    });

    // EXACT raw output extraction style
    const outputText =
      (resp as any).output_text ||
      (resp as any).choices?.[0]?.message?.content ||
      (resp as any).choices?.[0]?.content ||
      "";

    // (your server.mjs always logs)
    console.log("RAW MODEL TEXT:\n", outputText);

    try {
      result = safeJsonParse(outputText);
    } catch {
      return Response.json(
        { error: "Could not parse JSON from OpenAI response.", raw: outputText },
        { status: 500 }
      );
    }

    // Normalize identification field for frontend compatibility
    if (!result.identification) {
      if (result.coinIdentification) result.identification = result.coinIdentification;
      else if (result.currencyIdentification) result.identification = result.currencyIdentification;
      else if (result.cardIdentification) result.identification = result.cardIdentification;
    }

    // grading ROI added only in mode=card
    if (mode === "card") {
      result.gradingROI = computeGradingROI(result);
    }

    return Response.json({ result });
  } catch (err: any) {
    console.error(err);
    return Response.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
