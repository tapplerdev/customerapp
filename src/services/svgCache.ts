/**
 * Session-lifetime cache for remote SVG artwork (subscription stickers, trust
 * badges). SvgUriContainer used to fetch(uri) on EVERY mount — with FlashList
 * recycling that meant re-downloading the same sticker every time a card
 * scrolled back into view, and first paint always popped in late.
 *
 * peekSvg   — synchronous cache read, lets components render cached art in the
 *             same frame as the card (no pop-in).
 * loadSvg   — fetch once, dedupe concurrent requests for the same uri.
 * prefetchSvgs — fire a batch warm-up (SearchAnimationScreen gates the first
 *             screen on this; ProsListingScreen warms whole pages after).
 */

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

export const peekSvg = (uri?: string | null): string | null =>
  (uri && cache.get(uri)) || null

export const loadSvg = (uri: string): Promise<string | null> => {
  if (!uri) return Promise.resolve(null)
  const hit = cache.get(uri)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(uri)
  if (pending) return pending

  const request = fetch(uri)
    .then((res) => res.text())
    .then((text) => {
      if (text.includes("<svg")) {
        cache.set(uri, text)
        return text
      }
      return null
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(uri)
    })

  inflight.set(uri, request)
  return request
}

export const prefetchSvgs = (
  uris: Array<string | undefined | null>
): Promise<void> => {
  const unique = [...new Set(uris.filter(Boolean) as string[])]
  return Promise.all(unique.map((uri) => loadSvg(uri))).then(() => undefined)
}

/**
 * All remote SVG urls a pro card can render, in the CURRENT language only:
 * motivational subscription stickers (OffersSection) + approved trust badges.
 * Loosely typed on purpose — callers hold ProType but this only touches the
 * exact accessors the card renderers use.
 */
export const collectProStickerUrls = (
  pros: any[],
  isAr: boolean,
  limit?: number
): Array<string | undefined> => {
  const urls: Array<string | undefined> = []
  const slice = limit != null ? pros.slice(0, limit) : pros
  slice.forEach((pro: any) => {
    pro?.serviceCategories?.[0]?.subscriptions?.forEach((sub: any) => {
      if (sub?.product?.subType === "motivational") {
        urls.push(isAr ? sub.product?.pictureAr || sub.product?.pictureEn : sub.product?.pictureEn)
      }
    })
    pro?.documents?.forEach((doc: any) => {
      if (doc?.type === "trust" && doc?.status === "approved") {
        const tp = doc.trustDocumentData?.trustProduct
        urls.push(isAr ? tp?.pictureAr || tp?.pictureEn : tp?.pictureEn)
      }
    })
  })
  return urls
}
