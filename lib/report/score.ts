const SCORE_LABELS = {
  excellent: "Excellent (Healthy & glowing)",
  good: "Good (Minor concerns)",
  moderate: "Moderate (Needs improvement)",
  concerning: "Concerning (Active issues)",
  severe: "Severe (Needs treatment focus)"
} as const;

export type SkinScoreLabel = (typeof SCORE_LABELS)[keyof typeof SCORE_LABELS];

export function normalizeSkinScore(value: number) {
  const clamped = Math.min(10, Math.max(0, value));
  return Math.round(clamped * 10) / 10;
}

export function getSkinScoreLabel(value: number): SkinScoreLabel {
  const score = normalizeSkinScore(value);

  if (score >= 9) {
    return SCORE_LABELS.excellent;
  }

  if (score >= 7) {
    return SCORE_LABELS.good;
  }

  if (score >= 5) {
    return SCORE_LABELS.moderate;
  }

  if (score >= 3) {
    return SCORE_LABELS.concerning;
  }

  return SCORE_LABELS.severe;
}

export function formatSkinScore(value: number) {
  return normalizeSkinScore(value).toFixed(1);
}

export function getActiveScorePoint(value: number) {
  const rounded = Math.round(normalizeSkinScore(value));
  return Math.min(10, Math.max(1, rounded || 1));
}

export function getSkinScoreSummary(value: number) {
  const score = normalizeSkinScore(value);
  return `Your Skin Score: ${formatSkinScore(score)} / 10 - ${getSkinScoreLabel(score)}`;
}
