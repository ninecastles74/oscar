import { createServerFn } from "@tanstack/react-start";
import { buildSourcesDirectory } from "./directory";

/** News organisations and authors with average reliability scores. */
export const getSourcesDirectory = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await buildSourcesDirectory();
  } catch (err) {
    console.error(
      "[getSourcesDirectory] handler failed:",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});
