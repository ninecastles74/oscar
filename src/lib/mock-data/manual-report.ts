import { CLAIMS } from "./claims";
import { SOURCES } from "./sources";
import type { Claim, Source } from "./types";

export interface ManualReport {
  title: string;
  url: string;
  overallConfidence: number;
  summary: string;
  claims: Claim[];
  sources: Source[];
}

export const MANUAL_SAMPLE_REPORT: ManualReport = {
  title: "Analysis: Pasted article",
  url: "https://example.com/article",
  overallConfidence: 72,
  summary:
    "The article makes 6 verifiable claims. 4 are supported by multiple independent sources, 1 is disputed, and 1 lacks corroboration. The framing omits regional context that materially changes interpretation.",
  claims: Object.values(CLAIMS).slice(0, 6),
  sources: SOURCES.slice(0, 5),
};
