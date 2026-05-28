import type { StoryConsensusReport } from "@/types/news-platform";
import { geminiGenerateContent } from "../ai/gemini-client";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import type { StoryConsensusInput } from "./types";

/**
 * Add Gemini-researched executive summary to story consensus (live API + Google Search).
 */
export async function enrichStoryConsensusWithGemini(
  report: StoryConsensusReport,
  input: StoryConsensusInput,
): Promise<StoryConsensusReport> {
  if (!isGoogleAiConfigured()) return report;

  const claimLines = input.articles
    .flatMap((a) => a.report.claims.slice(0, 4))
    .map((c) => `- ${c.text} (${c.verdict}, ${c.confidence}%)`)
    .slice(0, 12)
    .join("\n");

  const articleLines = input.articles
    .map((a) => `- ${a.sourceName}: ${a.title}`)
    .join("\n");

  const result = await geminiGenerateContent({
    useGoogleSearch: true,
    system: "You are OSCAR, a cross-source news consensus analyst. Use Google Search for current context.",
    user: `Story: ${input.title}

Articles:
${articleLines}

Per-article claims:
${claimLines}

Scores: consensus ${report.consensusScore}, dispute ${report.disputeScore}, uncertainty ${report.uncertaintyScore}.

Write a 3-5 sentence executive summary of cross-source agreement, disputes, and what a reader should believe. Be specific.`,
  });

  if (!result?.text) return report;

  return {
    ...report,
    summary: `${report.summary} AI research summary: ${result.text.trim().slice(0, 800)}`,
    findingsSummary: `${report.findingsSummary ?? ""} [Live Gemini story research applied.]`.trim(),
  };
}
