import type { ManualSubmission, UserAnalysisRequest } from "@/types/news-platform";

const submissions = new Map<string, ManualSubmission>();
const requests = new Map<string, UserAnalysisRequest>();

export function saveSubmission(submission: ManualSubmission): void {
  submissions.set(submission.id, submission);
}

export function getSubmission(id: string): ManualSubmission | undefined {
  return submissions.get(id);
}

export function saveRequest(request: UserAnalysisRequest): void {
  requests.set(request.id, request);
}

export function getRequest(id: string): UserAnalysisRequest | undefined {
  return requests.get(id);
}

export function updateSubmission(submission: ManualSubmission): void {
  submissions.set(submission.id, submission);
}

export function updateRequest(request: UserAnalysisRequest): void {
  requests.set(request.id, request);
}
