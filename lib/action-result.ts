export type ActionErrorCode = "validation" | "unauthorized" | "not_found" | "conflict" | "unexpected";

export type ActionResult<T = void> =
  | { ok: true; data: T | undefined; message?: string }
  | { ok: false; message: string; code?: ActionErrorCode };

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(message: string, code: ActionErrorCode = "unexpected"): ActionResult<never> {
  return { ok: false, message, code };
}
