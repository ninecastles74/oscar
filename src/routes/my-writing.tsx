import { createFileRoute } from "@tanstack/react-router";
import { MyWritingFormView } from "@/features/my-writing/my-writing-form-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/my-writing")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.myWriting) }] }),
  component: MyWritingFormView,
});
