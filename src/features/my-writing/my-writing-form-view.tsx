import { OSCAR } from "@/lib/brand";
import { UserAnalysisForm } from "@/features/analysis/user-analysis-form";

export function MyWritingFormView() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <UserAnalysisForm
        mode="writing"
        badge={OSCAR.myWriting}
        title={OSCAR.myWritingScore}
        description="Upload your draft, essay, or op-ed. OSCAR scores your writing the same way it scores news — claims, evidence, consensus signals, and reliability — so you can see where your piece lands."
      />
    </main>
  );
}
