// Deterministic seed values + helpers shared by cluster/story/claim generators.

export const CATEGORIES = [
  "Politics", "World", "Business", "Technology", "Science", "Health", "Climate", "Markets",
];

export const HEADLINES = [
  "Central banks signal coordinated pause on rate hikes amid easing inflation",
  "New climate accord adds binding emissions targets for shipping sector",
  "Researchers report breakthrough in room-temperature superconductor verification",
  "AI chip export controls expanded; semiconductor stocks slide on news",
  "Major data breach exposes records of 40 million banking customers",
  "Pacific typhoon makes landfall; thousands evacuated from coastal regions",
  "Trade negotiations resume between EU and Mercosur after two-year pause",
  "New peer-reviewed study links microplastics to cardiovascular events",
  "Global shipping disruption continues as canal traffic remains constrained",
  "Tech giant unveils foundation model with 10x context window",
  "UN report: refugee numbers reach record high amid regional conflicts",
  "Energy ministers meet to discuss winter supply contingencies",
  "Court rules on landmark antitrust case against major platform",
  "Mars sample return mission cleared for next phase",
  "Pharma giant reports positive Phase 3 results for Alzheimer's therapy",
  "Election watchdog flags coordinated disinformation campaign",
  "Cyberattack disrupts hospital operations across three states",
  "Container shipping rates surge 40% on rerouted trade lanes",
  "Quantum computing milestone announced by research consortium",
  "Wildfire season begins early as drought conditions persist",
  "Diplomatic talks ease border tensions after week of escalation",
  "Housing affordability index hits decade low in major metros",
  "Streaming giant raises subscription prices, loses 2M subscribers",
  "Vaccine trial shows promise against drug-resistant tuberculosis",
];

export const CLAIMS_POOL = [
  "Inflation has dropped below the 2% target in the last quarter",
  "The agreement is legally binding on all signatories",
  "The verification was confirmed by three independent labs",
  "Export restrictions cover all advanced GPU shipments",
  "No customer passwords were exposed in the breach",
  "Evacuations were ordered for 250,000 residents",
  "The deal includes tariff reductions on agricultural goods",
  "The study sample included over 50,000 participants",
  "Traffic is at 30% of normal capacity",
  "The model uses 70% less energy than the prior generation",
  "Refugee arrivals doubled compared to last year",
  "Reserves are sufficient for the entire winter",
  "The ruling sets a precedent for future cases",
  "Launch is scheduled within 18 months",
  "The therapy showed a 35% reduction in cognitive decline",
];

export function pick<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i * 7) % arr.length]);
  return out;
}

export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
