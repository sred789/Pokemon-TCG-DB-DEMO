// Demo data client. There is NO backend: requests are served by an in-browser router over a
// localStorage-backed store (see src/demo/). The hook layer (hooks.ts) is unchanged — it still
// calls apiGet/apiSend, which now delegate to the demo router instead of fetch().

import { handle } from "../demo/router";
import { ApiError } from "./errors";

export { ApiError };

export function apiGet<T = unknown>(path: string): Promise<T> {
  return handle("GET", path) as Promise<T>;
}

export function apiSend<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  return handle(method, path, body) as Promise<T>;
}
