import React, { useRef, useState } from "react"
import { LayoutChangeEvent, PanResponder, View } from "react-native"

interface Props {
  /** Lower/upper bounds of the track. */
  min: number
  max: number
  /** Current selected low/high values (clamped to [min, max]). */
  low: number
  high: number
  step?: number
  onChange: (low: number, high: number) => void
  /** Filled track + thumbs colour (defaults to near-black). */
  color?: string
  /** Background (unfilled) track colour. */
  trackColor?: string
}

const THUMB = 22
const TRACK_H = 3

// Two-handle range slider (black), built on PanResponder so it needs no native
// module and styles freely. Kept LTR internally — numeric ranges read min→max
// left→right in both languages; the From/To inputs above it handle RTL.
const RangeSlider: React.FC<Props> = ({
  min,
  max,
  low,
  high,
  step = 1,
  onChange,
  color = "#1A1A1A",
  trackColor = "#D9D9D9",
}) => {
  const [width, setWidth] = useState(0)
  const span = max - min || 1

  // Latest values read inside the (once-created) PanResponders via refs.
  const widthRef = useRef(0)
  widthRef.current = width
  const lowRef = useRef(low)
  lowRef.current = low
  const highRef = useRef(high)
  highRef.current = high
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const startVal = useRef(0)

  const usable = () => Math.max(1, widthRef.current - THUMB)
  const valToX = (v: number) => ((v - min) / span) * usable()
  const xToVal = (x: number) => {
    const clamped = Math.max(0, Math.min(usable(), x))
    const raw = min + (clamped / usable()) * span
    return Math.max(min, Math.min(max, Math.round(raw / step) * step))
  }

  const makePan = (which: "low" | "high") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startVal.current = which === "low" ? lowRef.current : highRef.current
      },
      onPanResponderMove: (_, g) => {
        const next = xToVal(valToX(startVal.current) + g.dx)
        if (which === "low") {
          onChangeRef.current(
            Math.max(min, Math.min(next, highRef.current - step)),
            highRef.current
          )
        } else {
          onChangeRef.current(
            lowRef.current,
            Math.min(max, Math.max(next, lowRef.current + step))
          )
        }
      },
    })

  const lowPan = useRef(makePan("low")).current
  const highPan = useRef(makePan("high")).current

  const lowX = valToX(low)
  const highX = valToX(high)

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: THUMB, justifyContent: "center" }}
    >
      {/* Background track */}
      <View
        style={{
          position: "absolute",
          left: THUMB / 2,
          right: THUMB / 2,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: trackColor,
        }}
      />
      {/* Filled (selected) segment */}
      <View
        style={{
          position: "absolute",
          left: THUMB / 2 + lowX,
          width: Math.max(0, highX - lowX),
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: color,
        }}
      />
      {/* Handles */}
      <View
        {...lowPan.panHandlers}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        style={{
          position: "absolute",
          left: lowX,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: color,
        }}
      />
      <View
        {...highPan.panHandlers}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        style={{
          position: "absolute",
          left: highX,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export default RangeSlider
