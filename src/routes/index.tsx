import { createFileRoute } from "@tanstack/react-router";
import { LandingView } from "@/app/landing-view";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veridict — AI-powered news verification" },
      { name: "description", content: "Two ways to verify the news: monitor the top 100 stories or analyze any article you paste." },
    ],
  }),
  component: LandingView,
});
