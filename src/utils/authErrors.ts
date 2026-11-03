import type { TFunction } from "i18next"

/**
 * The sign-in errors that are not about the credentials: no network, too
 * many attempts, and the server failing. The sign-in screens used to call
 * every one of them "check your credentials".
 */

type RequestError = {
  status?: unknown
  originalStatus?: unknown
  retryAfterSeconds?: unknown
}

type ResponseMeta = {
  response?: { headers?: { get?: (name: string) => string | null } }
}

/**
 * The sign-in routes' 429 (backend PR #413, RateLimitInterceptor) carries
 * the wait in a Retry-After header, in seconds. RTK hands a caller only the
 * error body, so the auth endpoints' transformErrorResponse copies it onto
 * the error here. Any other error passes through unchanged.
 */
export const withRetryAfter = <E>(error: E, meta?: ResponseMeta): E => {
  if ((error as RequestError | undefined)?.status !== 429) return error
  const header = meta?.response?.headers?.get?.("Retry-After")
  const seconds = header == null ? NaN : Number(header)
  if (!Number.isFinite(seconds) || seconds <= 0) return error

  return { ...error, retryAfterSeconds: seconds }
}

const statusOf = (error: unknown): unknown =>
  (error as RequestError | null | undefined)?.status

/** Too many attempts: the sign-in rate limit. Never a credentials verdict. */
export const isTooManyAttempts = (error: unknown): boolean =>
  statusOf(error) === 429

/** A 5xx from the server, or a gateway's 5xx page (not JSON: PARSING_ERROR). */
export const isServerFailure = (error: unknown): boolean => {
  const e = error as RequestError | null | undefined
  const status = e?.status === "PARSING_ERROR" ? e?.originalStatus : e?.status
  return typeof status === "number" && status >= 500
}

/** The request never got an answer: no network, or the API unreachable. */
export const isUnreachable = (error: unknown): boolean => {
  const status = statusOf(error)
  return status === "FETCH_ERROR" || status === "TIMEOUT_ERROR"
}

/** Whole minutes to wait, rounded up as the server's own message rounds them. */
export const retryAfterMinutes = (error: unknown): number | undefined => {
  const seconds = (error as RequestError | null | undefined)?.retryAfterSeconds
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return undefined
  }
  return Math.max(1, Math.ceil(seconds / 60))
}

/**
 * The message for a sign-in failure that is not about the credentials, or
 * undefined when it is one (the caller reads the validation errors then).
 *
 * A 429 is told in the app's language from Retry-After rather than shown
 * as the server's message, which is English only ("Too many attempts.
 * Please try again in N minutes."). Without the header it says the same
 * without the wait.
 */
export const describeSignInFailure = (
  error: unknown,
  t: TFunction
): string | undefined => {
  if (isUnreachable(error)) return t("no_internet_connection")
  if (isTooManyAttempts(error)) {
    const minutes = retryAfterMinutes(error)
    return minutes === undefined
      ? t("too_many_attempts")
      : t("too_many_attempts_wait", {
          duration: t("duration_minutes", { count: minutes }),
        })
  }
  if (isServerFailure(error)) return t("server_having_trouble")
  return undefined
}
