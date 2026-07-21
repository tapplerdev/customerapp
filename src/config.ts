import { API_URL as ENV_API_URL } from "@env"

// Fallback = deployed DO backend (dev), so a missing .env never strands the
// app on a dead placeholder host
export const API_URL = ENV_API_URL || "https://seashell-app-go8ox.ondigitalocean.app/api"
