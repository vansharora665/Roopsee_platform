import { z } from "zod";

import { analysisOutputSchema } from "@/lib/validators/analysis";

const requiredString = z.string().trim().min(1);

export const draftRoutineStepSchema = z
  .object({
    step: requiredString,
    usage_amount: requiredString,
    why: requiredString
  })
  .strict();

export const ingredientSlotSchema = z
  .object({
    purpose: requiredString,
    hero_ingredients: z.array(requiredString).min(1),
    supporting_ingredients: z.array(requiredString).default([]),
    notes: z.string().trim().default("")
  })
  .strict();

export const productMatchingSchema = z
  .object({
    target_concerns: z.array(requiredString).default([]),
    avoid_ingredients: z.array(requiredString).default([]),
    preferred_textures: z.array(requiredString).default([]),
    notes: z.string().trim().default("")
  })
  .strict();

export const doctorHandoffSchema = z
  .object({
    summary: z.string().trim().default(""),
    review_focus: z.array(requiredString).default([])
  })
  .strict();

export const recommendedProductObjectSchema = z
  .object({
    brand: requiredString,
    product_name: requiredString,
    rationale: z.string().trim().default("")
  })
  .strict();

export const recommendedProductSchema = z.union([
  recommendedProductObjectSchema,
  requiredString
]);

export const recommendedProductsSchema = z
  .object({
    cleanser: recommendedProductSchema.nullable().default(null),
    sunscreen: recommendedProductSchema.nullable().default(null),
    moisturizer: recommendedProductSchema.nullable().default(null),
    repair_serum: recommendedProductSchema.nullable().default(null)
  })
  .strict();

export const ingredientPlanSchema = z
  .object({
    cleanser: ingredientSlotSchema,
    sunscreen: ingredientSlotSchema,
    moisturizer: ingredientSlotSchema,
    repair_serum: ingredientSlotSchema
  })
  .strict();

export const routinePlanSchema = z
  .object({
    morning: z.array(draftRoutineStepSchema).min(1),
    night: z.array(draftRoutineStepSchema).min(1)
  })
  .strict();

export const reportDraftSchema = z
  .object({
    analysis: analysisOutputSchema,
    ingredient_plan: ingredientPlanSchema,
    routine_plan: routinePlanSchema,
    product_matching: productMatchingSchema,
    doctor_handoff: doctorHandoffSchema,
    recommended_products: recommendedProductsSchema.optional()
  })
  .strict();

export type DraftRoutineStep = z.infer<typeof draftRoutineStepSchema>;
export type IngredientSlot = z.infer<typeof ingredientSlotSchema>;
export type IngredientPlan = z.infer<typeof ingredientPlanSchema>;
export type RoutinePlan = z.infer<typeof routinePlanSchema>;
export type ProductMatchingPlan = z.infer<typeof productMatchingSchema>;
export type DoctorHandoff = z.infer<typeof doctorHandoffSchema>;
export type RecommendedProductObject = z.infer<typeof recommendedProductObjectSchema>;
export type RecommendedProduct = z.infer<typeof recommendedProductSchema>;
export type RecommendedProducts = z.infer<typeof recommendedProductsSchema>;
export type ReportDraft = z.infer<typeof reportDraftSchema>;
