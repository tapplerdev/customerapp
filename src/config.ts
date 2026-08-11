import { API_URL as ENV_API_URL } from "@env"

const FALLBACK_API_URL = "https://seashell-app-go8ox.ondigitalocean.app/api"

// Fallback = deployed DO backend (dev), so a missing .env never strands the
// app on a dead placeholder host.
//
// It is LOUD on purpose. @env is inlined at BUILD time, so a Metro started
// without --reset-cache after an .env change keeps the old value — and if that
// value was empty, the app silently talks to the deployed backend while you
// believe it is on localhost. That failure looks like "the socket never
// connects" and "nothing live-updates", with nothing in the logs pointing at
// the cause. Half an hour went into diagnosing exactly that.
if (!ENV_API_URL) {
  console.warn(
    `[config] API_URL missing from @env — falling back to ${FALLBACK_API_URL}. ` +
      `If you meant to point at localhost, restart Metro with --reset-cache.`
  )
}

export const API_URL = ENV_API_URL || FALLBACK_API_URL
