import { z } from "zod";

export const AnalyzeResultSchema = z.object({
  category: z.string(),
  identification: z.object({
    title: z.string(),
    subtitle: z.string().nullable(),
    confidence: z.string(),
    reasons: z.array(z.string()),
    key_fields: z.record(z.string(), z.string().nullable()),
  }),
  condition: z.object({
    guessed_grade_band: z.string(),
    notes: z.array(z.string()),
    red_flags: z.array(z.string()),
  }),
  pricing: z.object({
    recommendation: z.string(),
    ebay_range_usd: z.object({ low: z.number(), high: z.number() }),
    suggested_format: z.string(),
    suggested_start_or_bin_usd: z.number(),
    rationale: z.array(z.string()),
  }),
  selling_strategy: z.object({
    sell_as: z.string(),
    lotting_notes: z.array(z.string()),
    title_template: z.string(),
    photo_checklist: z.array(z.string()),
    shipping_recommendation: z.string(),
    warnings: z.array(z.string()),
    next_steps: z.array(z.string()),
  }),
});

export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;
