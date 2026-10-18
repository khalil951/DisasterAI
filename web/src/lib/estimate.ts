/** The workflow answers once, at the end, so the progress shown while it runs is an ESTIMATE from typical step times. It is labelled as one. */
export interface Stage {
  key: string;
  label: string;
  weight: number; // typical seconds on the local setup, from the real runs in docs/EVIDENCE_LOG.md
  needsImage?: boolean;
}

export const STAGES: Stage[] = [
  { key: "understand", label: "Understanding the report", weight: 2 },
  { key: "vision", label: "Reading the photo", weight: 12, needsImage: true },
  { key: "guidance", label: "Finding relevant guidance", weight: 7 },
  { key: "risk", label: "Assessing the risk", weight: 4 },
  { key: "report", label: "Writing the report", weight: 5 },
  { key: "check", label: "Running the safety checks", weight: 2 },
];

export interface StageProgress {
  index: number; // the stage we estimate the run is in
  stages: Stage[];
  total: number; // estimated seconds in all
  overrun: boolean; // true when the run takes longer than the estimate
}

export function progressAt(elapsedSeconds: number, hasImage: boolean, typicalTotal?: number | null): StageProgress {
  const stages = STAGES.filter((s) => hasImage || !s.needsImage);
  const sum = stages.reduce((a, s) => a + s.weight, 0);
  const total = typicalTotal && typicalTotal > 0 ? typicalTotal : sum;
  const scale = total / sum;
  let acc = 0;
  for (let i = 0; i < stages.length; i++) {
    acc += (stages[i]?.weight ?? 0) * scale;
    if (elapsedSeconds < acc) return { index: i, stages, total, overrun: false };
  }
  return { index: stages.length - 1, stages, total, overrun: true };
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  return v.length ? (v[Math.floor(v.length / 2)] as number) : null;
}
