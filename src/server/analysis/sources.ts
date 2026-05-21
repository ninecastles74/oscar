import type { ArticleSource } from "@/types/news-platform";

/** Approved outlets used for evidence retrieval (mirrors mock-data registry). */
export const APPROVED_SOURCES: ArticleSource[] = [
  {
    id: "s1",
    name: "Reuters",
    domain: "reuters.com",
    bias: "center",
    reliability: 96,
    approved: true,
  },
  {
    id: "s2",
    name: "Associated Press",
    domain: "apnews.com",
    bias: "center",
    reliability: 95,
    approved: true,
  },
  {
    id: "s3",
    name: "BBC News",
    domain: "bbc.com",
    bias: "center",
    reliability: 92,
    approved: true,
  },
  {
    id: "s4",
    name: "The New York Times",
    domain: "nytimes.com",
    bias: "center-left",
    reliability: 88,
    approved: true,
  },
  {
    id: "s5",
    name: "The Wall Street Journal",
    domain: "wsj.com",
    bias: "center-right",
    reliability: 89,
    approved: true,
  },
  {
    id: "s6",
    name: "The Guardian",
    domain: "theguardian.com",
    bias: "center-left",
    reliability: 85,
    approved: true,
  },
  {
    id: "s7",
    name: "Financial Times",
    domain: "ft.com",
    bias: "center",
    reliability: 91,
    approved: true,
  },
  {
    id: "s8",
    name: "Bloomberg",
    domain: "bloomberg.com",
    bias: "center",
    reliability: 90,
    approved: true,
  },
  {
    id: "s9",
    name: "NPR",
    domain: "npr.org",
    bias: "center-left",
    reliability: 87,
    approved: true,
  },
  {
    id: "s10",
    name: "Al Jazeera",
    domain: "aljazeera.com",
    bias: "center-left",
    reliability: 80,
    approved: true,
  },
  {
    id: "s11",
    name: "Politico",
    domain: "politico.com",
    bias: "center",
    reliability: 82,
    approved: true,
  },
  {
    id: "s12",
    name: "Axios",
    domain: "axios.com",
    bias: "center",
    reliability: 83,
    approved: true,
  },
];

export function approvedSourceById(id: string): ArticleSource | undefined {
  return APPROVED_SOURCES.find((s) => s.id === id);
}
