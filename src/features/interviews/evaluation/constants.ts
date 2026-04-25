export const DEFAULT_COMPETENCIES = [
  { key: "communication", label: "Communication", weight: 1.2 },
  { key: "problem_solving", label: "Problem Solving", weight: 1.5 },
  { key: "technical_depth", label: "Technical Depth", weight: 1.8 },
  { key: "collaboration", label: "Collaboration", weight: 1 },
] as const;

export const FEEDBACK_DECISIONS = ["pass", "reject", "hold", "review"] as const;
export const NOTE_VISIBILITY = ["shared", "private"] as const;
