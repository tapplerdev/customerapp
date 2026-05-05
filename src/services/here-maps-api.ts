import { HERE_MAPS_API_KEY } from "@env"
import { MapLocationResult, MapPosition } from "services/map-types"

const EGYPT_LOCATION = "26.8206,30.8025"
const EGYPT_COUNTRY_CODE = "EGY"

export const searchAddress = async (
  query: string,
  limit?: number,
  lang?: string
) => {
  const language = lang || "en-US"
  try {
    const reqUrl = `https://discover.search.hereapi.com/v1/discover?q=${query}&lang=${language}&apiKey=${HERE_MAPS_API_KEY}&at=${EGYPT_LOCATION}&in=countryCode:${EGYPT_COUNTRY_CODE}&limit=${limit || 5}`
    const res = await fetch(reqUrl)
    const jsonData = await res.json()
    return (jsonData.items as MapLocationResult[]) || []
  } catch (e) {
    console.log("searchAddress error: ", e)
    return []
  }
}

export const searchAddressByPosition = async (
  position: MapPosition,
  limit?: number,
  lang?: string
) => {
  const language = lang || "en-US"
  try {
    const reqUrl = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${position.lat},${position.lng}&lang=${language}&apiKey=${HERE_MAPS_API_KEY}&limit=${limit || 5}`
    const res = await fetch(reqUrl)
    const jsonData = await res.json()
    return (jsonData.items as MapLocationResult[]) || []
  } catch (e) {
    console.log("searchAddressByPosition error: ", e)
    return []
  }
}
