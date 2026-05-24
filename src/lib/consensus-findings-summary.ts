import type { StoryConsensusReport } from "@/types/news-platform";

/** Narrative paragraph summarizing cross-source consensus findings for the cluster. */
export function buildConsensusFindingsSummary(
  report: Pick<
    StoryConsensusReport,
    | "articleCount"
    | "sourceCount"
    | "consensusScore"
    | "disputeScore"
    | "uncertaintyScore"
    | "storyConfidence"
    | "overlappingClaims"
    | "disputedClaims"
    | "omittedContext"
    | "narrativeDifferences"
    | "emotionalFramingDifferences"
  >,
): string {
  const sentences: string[] = [];

  if (report.consensusScore >= 75) {
    sentences.push(
      `OSCAR compared ${report.articleCount} articles from ${report.sourceCount} outlets and found strong cross-source agreement on the core claims (${report.consensusScore}% consensus).`,
    );
  } else if (report.consensusScore >= 50) {
    sentences.push(
      `OSCAR compared ${report.articleCount} articles from ${report.sourceCount} outlets and found moderate agreement (${report.consensusScore}% consensus), with meaningful differences in how outlets frame and support key claims.`,
    );
  } else {
    sentences.push(
      `OSCAR compared ${report.articleCount} articles from ${report.sourceCount} outlets and found limited agreement (${report.consensusScore}% consensus); treat single-source assertions with extra caution.`,
    );
  }

  if (report.overlappingClaims.length > 0) {
    const top = report.overlappingClaims[0];
    sentences.push(
      `${report.overlappingClaims.length} claim group${report.overlappingClaims.length === 1 ? "" : "s"} appear in multiple outlets${top ? `, including shared reporting around “${top.canonicalText.slice(0, 90)}${top.canonicalText.length > 90 ? "…" : ""}”.` : "."}`,
    );
  } else {
    sentences.push(
      "Few claims clearly overlap across outlets, so the story lacks a single shared factual spine in extracted coverage.",
    );
  }

  if (report.disputedClaims.length > 0) {
    sentences.push(
      `${report.disputedClaims.length} claim group${report.disputedClaims.length === 1 ? "" : "s"} show material disagreement between sources (dispute score ${report.disputeScore}%), meaning outlets contradict or qualify the same point differently.`,
    );
  } else {
    sentences.push(
      `No major cross-source factual disputes were flagged among aligned claims (dispute score ${report.disputeScore}%).`,
    );
  }

  if (report.omittedContext.length > 0) {
    sentences.push(
      `${report.omittedContext.length} context gap${report.omittedContext.length === 1 ? "" : "s"} indicate that some outlets omit details others include, which raises uncertainty (${report.uncertaintyScore}%).`,
    );
  } else {
    sentences.push(
      `Omitted-context signals are relatively low (${report.uncertaintyScore}% uncertainty score).`,
    );
  }

  if (report.narrativeDifferences.length > 0 || report.emotionalFramingDifferences.length > 0) {
    const cues: string[] = [];
    if (report.narrativeDifferences.length > 0) {
      cues.push("story emphasis and lead claims");
    }
    if (report.emotionalFramingDifferences.length > 0) {
      cues.push("tone and emotional framing");
    }
    sentences.push(
      `Beyond raw agreement, outlets diverge on ${cues.join(" and ")}, so the same event can read differently depending on the source.`,
    );
  }

  sentences.push(
    `Taken together, overall story confidence is ${report.storyConfidence}% — reflecting agreement, dispute, ambiguity, and missing context across the cluster.`,
  );

  return sentences.join(" ");
}
