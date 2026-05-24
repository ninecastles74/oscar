import { createFileRoute } from "@tanstack/react-router";
import { LandingView } from "@/app/landing-view";
import { defaultSiteTitle } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: defaultSiteTitle() },
      { name: "description", content: "Two ways to verify the news: monitor the top 100 stories or analyze any article you paste." },
    ],
  }),
  component: LandingView,
});
