export type ScoreSource = "computed" | "registry" | "database";

export interface OrganizationDirectoryRow {
  sourceId: string;
  organizationId: string;
  name: string;
  domain: string;
  bias: string;
  approved: boolean;
  averageScore: number;
  rollingAverage: number | null;
  articlesScored: number;
  scoreSource: ScoreSource;
  trend: string | null;
}

export interface AuthorDirectoryRow {
  authorId: string;
  displayName: string;
  outlet: string | null;
  averageScore: number;
  rollingAverage: number | null;
  articlesScored: number;
  scoreSource: ScoreSource;
  trend: string | null;
}

export interface SourcesDirectory {
  organizations: OrganizationDirectoryRow[];
  authors: AuthorDirectoryRow[];
  meta: {
    organizationCount: number;
    authorCount: number;
    computedOrganizationCount: number;
    computedAuthorCount: number;
    supabaseMerged: boolean;
    usingMockAuthors: boolean;
    feedOrganizationsAdded?: number;
    feedAuthorsAdded?: number;
    feedArticlesSeen?: number;
  };
}
