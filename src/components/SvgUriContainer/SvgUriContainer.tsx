import React, { useState, useEffect } from "react"
import { SvgXml } from "react-native-svg"

interface Props {
  uri: string
  width?: number
  height?: number
}

const SvgUriContainer: React.FC<Props> = ({ uri, width, height }) => {
  const [svgXml, setSvgXml] = useState<string | null>(null)

  useEffect(() => {
    if (!uri) return

    fetch(uri)
      .then((res) => res.text())
      .then((text) => {
        if (text.includes("<svg")) {
          setSvgXml(text)
        }
      })
      .catch(() => {})
  }, [uri])

  if (!svgXml) return null

  return <SvgXml xml={svgXml} width={width || 100} {...(height && { height })} />
}

export default SvgUriContainer
