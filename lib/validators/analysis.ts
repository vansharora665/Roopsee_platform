import { z } from "zod";

export const skinScoreLabelSchema = z.enum([
  "Excellent (Healthy & glowing)",
  "Good (Minor concerns)",
  "Moderate (Needs improvement)",
  "Concerning (Active issues)",
  "Severe (Needs treatment focus)"
]);

export const overallSeveritySchema = z.enum(["None", "Mild", "Moderate", "Severe"]);
export const oilLevelsSchema = z.enum(["Low", "Medium", "High"]);
export const hydrationSchema = z.enum(["Low", "Good"]);
export const textureSchema = z.enum(["Smooth", "Uneven"]);
export const toneSchema = z.enum(["Even", "Uneven"]);

const skinScoreValueSchema = z
  .number()
  .min(0)
  .max(10)
  .refine((value) => Number.isInteger(value * 10), "Skin score must use at most one decimal place");

export const analysisOutputSchema = z
  .object({
    skin_score: z
      .object({
        score: skinScoreValueSchema,
        label: skinScoreLabelSchema
      })
      .strict(),
    overall_skin_profile: z
      .object({
        skin_type: z.string().trim().min(1),
        condition: z.string().trim().min(1),
        overall_severity: overallSeveritySchema
      })
      .strict(),
    key_skin_concerns: z
      .object({
        primary: z.array(z.string().trim().min(1)).max(5),
        secondary: z.array(z.string().trim().min(1)).max(5)
      })
      .strict(),
    positive_findings: z.array(z.string().trim().min(1)).max(6),
    primary_observations: z
      .object({
        oil_levels: oilLevelsSchema,
        hydration: hydrationSchema,
        texture: textureSchema,
        tone: toneSchema
      })
      .strict()
  })
  .strict();

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "skin_score",
    "overall_skin_profile",
    "key_skin_concerns",
    "positive_findings",
    "primary_observations"
  ],
  properties: {
    skin_score: {
      type: "object",
      additionalProperties: false,
      required: ["score", "label"],
      properties: {
        score: {
          type: "number",
          minimum: 0,
          maximum: 10
        },
        label: {
          type: "string",
          enum: skinScoreLabelSchema.options
        }
      }
    },
    overall_skin_profile: {
      type: "object",
      additionalProperties: false,
      required: ["skin_type", "condition", "overall_severity"],
      properties: {
        skin_type: {
          type: "string"
        },
        condition: {
          type: "string"
        },
        overall_severity: {
          type: "string",
          enum: overallSeveritySchema.options
        }
      }
    },
    key_skin_concerns: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "secondary"],
      properties: {
        primary: {
          type: "array",
          items: {
            type: "string"
          }
        },
        secondary: {
          type: "array",
          items: {
            type: "string"
          }
        }
      }
    },
    positive_findings: {
      type: "array",
      items: {
        type: "string"
      }
    },
    primary_observations: {
      type: "object",
      additionalProperties: false,
      required: ["oil_levels", "hydration", "texture", "tone"],
      properties: {
        oil_levels: {
          type: "string",
          enum: oilLevelsSchema.options
        },
        hydration: {
          type: "string",
          enum: hydrationSchema.options
        },
        texture: {
          type: "string",
          enum: textureSchema.options
        },
        tone: {
          type: "string",
          enum: toneSchema.options
        }
      }
    }
  }
} as const;
