import "server-only";

import { parseServerEnvironment } from "./schema";

let cachedEnvironment: ReturnType<typeof parseServerEnvironment> | undefined;

export function getServerEnvironment() {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
