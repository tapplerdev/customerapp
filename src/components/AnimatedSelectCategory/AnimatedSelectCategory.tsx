import React, { useCallback, useRef, useState } from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import {
  withType,
  type SizeBringsLeading,
} from "@tappler/shared/src/components/classNameSlots"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import colors from "@tappler/shared/src/styles/colors"
import { LayoutChangeEvent } from "react-native"
import type { ScrollView, StyleProp } from "react-native"
import { AppScrollView } from "components/scroll"
import {
  Text,
  a,
  px,
  type DsTextProps,
  type DsTextStyle,
  type TextSizeOrPx,
  type TextType,
} from "@tappler/shared/src/ds"
import styles from "./styles"

/** A tab's title unless the caller says otherwise: 11, semibold, centred, leading 14. */
const CATEGORY_TEXT = {
  size: 11,
  leading: px(14),
  weight: "semibold",
  align: "center",
} as const satisfies TextType

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
  /** The titles' spacing and colour, after their own. */
  textStyle?: StyleProp<DsTextStyle & NoShorthands>
  /** The titles' typography, over their own (default 11, semibold, centred, leading 14). */
  textType?: Partial<TextType> & SizeBringsLeading
  showLines?: boolean
}

type TabLayout = { x: number; width: number }

const AnimatedSelectCategory: React.FC<Props> = ({
  categories,
  setSelectedCategory,
  textStyle,
  textType,
  showLines = true,
}) => {
  // The caller's textType over the titles' own, key by key.
  const categoryText = withType<TextType>(
    CATEGORY_TEXT,
    textType
  ) as DsTextProps<TextSizeOrPx>
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
    <DmView>
      <AppScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14 }}
      >
        <DmView>
          <DmView style={[a.flex_row, a.items_center]}>
            {categories.map((item, idx) => (
              <DmView
                key={idx}
                style={[a.px_12, a.py_4]}
                onLayout={handleLayout(idx)}
                onPress={() => handlePress(idx)}
              >
                {/* No numberOfLines — the tab is sized to the label now, so
                    there is nothing to truncate. */}
                <Text {...categoryText} style={textStyle}>
                  {item}
                </Text>
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
            <DmView style={styles.animatedWrap}>
              <Animated.View style={anim} />
            </DmView>
          )}
        </DmView>
      </AppScrollView>
    </DmView>
  )
}

export default AnimatedSelectCategory
