import React, { useState, useEffect } from "react"
import { SvgXml } from "react-native-svg"

import { loadSvg, peekSvg } from "services/svgCache"

interface Props {
  uri: string
  width?: number
  height?: number
}

/**
 * Remote SVG renderer backed by the session svgCache. A cached uri renders in
 * the SAME frame as its parent (critical under FlashList recycling, where the
 * uri prop changes on scroll — reading peekSvg at render time means a warmed
 * sticker never flashes blank). Uncached uris fetch once, deduped globally.
 */
const SvgUriContainer: React.FC<Props> = ({ uri, width, height }) => {
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

  return <SvgXml xml={xml} width={width || 100} {...(height && { height })} />
}

export default SvgUriContainer
