import React, { useState, useEffect } from "react"
import { SvgXml } from "react-native-svg"

import { loadSvg, peekSvg } from "services/svgCache"
import { autoTrimSvgLeftPadding } from "@tappler/shared/src/helpers/svgTrim"

interface Props {
  uri: string
  width?: number
  height?: number
  /** Normalise the per-sticker offset the CMS export bakes in, so a row of
   *  them stops looking ragged. See @tappler/shared svgTrim. */
  autoTrimLeftPadding?: boolean
  /** Also left-ALIGN the artwork in its box, rather than leaving it centred.
   *  Only for stickers that line up against a column of text. In a centred or
   *  justify-around row this pushes everything off to one side. */
  pinLeft?: boolean
}

/**
 * Remote SVG renderer backed by the session svgCache. A cached uri renders in
 * the SAME frame as its parent (critical under FlashList recycling, where the
 * uri prop changes on scroll — reading peekSvg at render time means a warmed
 * sticker never flashes blank). Uncached uris fetch once, deduped globally.
 */
const SvgUriContainer: React.FC<Props> = ({
  uri,
  width,
  height,
  autoTrimLeftPadding = false,
  pinLeft = false,
}) => {
  const [loaded, setLoaded] = useState<{ uri: string; xml: string } | null>(
    () => {
      const hit = peekSvg(uri)
      return hit ? { uri, xml: hit } : null
    }
  )

  // Render-time cache read wins over stale state from a recycled mount
  const xml = loaded && loaded.uri === uri ? loaded.xml : peekSvg(uri)

  useEffect(() => {
    if (!uri || peekSvg(uri)) return
    let alive = true
    loadSvg(uri).then((res) => {
      if (alive && res) setLoaded({ uri, xml: res })
    })
    return () => {
      alive = false
    }
  }, [uri])

  if (!xml) return null

  const processedXml = autoTrimLeftPadding
    ? autoTrimSvgLeftPadding(xml, { pinLeft })
    : xml

  return (
    <SvgXml xml={processedXml} width={width || 100} {...(height && { height })} />
  )
}

export default SvgUriContainer
