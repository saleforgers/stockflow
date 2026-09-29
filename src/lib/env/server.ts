import "server-only";

import { parseAuthenticationEnvironment, parseServerEnvironment } from "./schema";

let cachedEnvironment: ReturnType<typeof parseServerEnvironment> | undefined;
let cachedAuthenticationEnvironment: ReturnType<typeof parseAuthenticationEnvironment> | undefined;

export function getServerEnvironment() {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}

export function getAuthenticationEnvironment() {
  cachedAuthenticationEnvironment ??= parseAuthenticationEnvironment(process.env);
  return cachedAuthenticationEnvironment;
}
