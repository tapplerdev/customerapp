import React, { useCallback, useRef, useState } from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import clsx from "clsx"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import colors from "@tappler/shared/src/styles/colors"
import { LayoutChangeEvent, ScrollView } from "react-native"

// Ported from proapp (menu section tabs with the sliding red underline).
//
// Tabs used to be SCREEN_WIDTH / count, so every label was squeezed into an
// equal slice and clipped with numberOfLines={1} — five sections gave each
// ~78pt and "Main Course" rendered as "Main Cour...". A menu has as many
// sections as the kitchen decides, so no fixed division survives contact with
// real data.
//
// Now each tab is as wide as its own label and the row scrolls horizontally.
// The underline follows measured layout rather than an index times a constant,
// which is what makes variable widths possible — and it means RTL needs no
// sign-flipping either, since onLayout already reports flipped coordinates.
interface Props {
  categories: string[]
  setSelectedCategory: (item: number) => void
  className?: string
  textClassName?: string
  showLines?: boolean
}

type TabLayout = { x: number; width: number }

const AnimatedSelectCategory: React.FC<Props> = ({
  categories,
  setSelectedCategory,
  className,
  textClassName,
  showLines = true,
}) => {
  const scrollRef = useRef<ScrollView>(null)
  const layouts = useRef<TabLayout[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const left = useSharedValue(0)
  const width = useSharedValue(0)

  const anim = useAnimatedStyle(() => ({
    height: 2,
    backgroundColor: colors.red,
    width: withTiming(width.value),
    transform: [{ translateX: withTiming(left.value) }],
  }))

  const applyUnderline = useCallback(
    (idx: number) => {
      const l = layouts.current[idx]
      if (!l) return
      left.value = l.x
      width.value = l.width
    },
    [left, width]
  )

  const handleLayout = useCallback(
    (idx: number) => (e: LayoutChangeEvent) => {
      const { x, width: w } = e.nativeEvent.layout
      layouts.current[idx] = { x, width: w }
      // The first tab has no measurements when it is first selected, so the
      // underline is placed once its own layout arrives.
      if (idx === activeIdx) applyUnderline(idx)
    },
    [activeIdx, applyUnderline]
  )

  const handlePress = (idx: number) => {
    setActiveIdx(idx)
    applyUnderline(idx)
    // Keep the chosen tab on screen — with scrolling tabs the one you tapped
    // can be at the edge, and the next one along is often off it.
    const l = layouts.current[idx]
    if (l) {
      scrollRef.current?.scrollTo({ x: Math.max(0, l.x - 40), animated: true })
    }
    setSelectedCategory(idx)
  }

  return (
    <DmView className={clsx("", className)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14 }}
      >
        <DmView>
          <DmView className="flex-row items-center">
            {categories.map((item, idx) => (
              <DmView
                key={idx}
                className="px-[12] py-[4]"
                onLayout={handleLayout(idx)}
                onPress={() => handlePress(idx)}
              >
                {/* No numberOfLines — the tab is sized to the label now, so
                    there is nothing to truncate. */}
                <DmText
                  className={clsx(
                    textClassName ||
                      "text-11 leading-[14px] font-custom600 text-center"
                  )}
                >
                  {item}
                </DmText>
              </DmView>
            ))}
          </DmView>
          {/* Just the moving bar, and it is the LAST thing in the strip so it
              lands directly on the container's bottom divider — the red reads
              as the live segment of that line rather than a second line
              hovering above it. Inside the scroll view so it travels with its
              tab; a baseline drawn here would only span the content width, so
              the container supplies that. */}
          {showLines && (
            <DmView className="mt-[9]">
              <Animated.View style={anim} />
            </DmView>
          )}
        </DmView>
      </ScrollView>
    </DmView>
  )
}

export default AnimatedSelectCategory
