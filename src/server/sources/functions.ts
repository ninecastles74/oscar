import { createServerFn } from "@tanstack/react-start";
import { buildSourcesDirectory } from "./directory";

/** News organisations and authors with average reliability scores. */
export const getSourcesDirectory = createServerFn({ method: "GET" }).handler(async () => {
  return buildSourcesDirectory();
});
