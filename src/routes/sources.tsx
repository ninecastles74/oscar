import { createFileRoute } from "@tanstack/react-router";
import { SourcesView } from "@/features/sources/sources-view";
import { OSCAR, pageTitle } from "@/lib/brand";
import { getSourcesDirectory } from "@/server/sources/functions";

export const Route = createFileRoute("/sources")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.sources) }] }),
  loader: async () => {
    const directory = await getSourcesDirectory({ data: {} });
    return { directory };
  },
  component: SourcesRoute,
});

function SourcesRoute() {
  const { directory } = Route.useLoaderData();
  return <SourcesView directory={directory} />;
}
