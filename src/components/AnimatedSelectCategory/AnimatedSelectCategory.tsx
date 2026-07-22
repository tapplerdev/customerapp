import React, { useMemo } from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import clsx from "clsx"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import colors from "@tappler/shared/src/styles/colors"
import { Dimensions, I18nManager } from "react-native"

// Ported from proapp (menu section tabs with the sliding red underline);
// SCREEN_WIDTH helper replaced with Dimensions since customerapp has no
// helpers/helpers module.
const SCREEN_WIDTH = Dimensions.get("window").width

interface Props {
  categories: string[]
  setSelectedCategory: (item: number) => void
  className?: string
  textClassName?: string
  showLines?: boolean
}

const AnimatedSelectCategory: React.FC<Props> = ({
  categories,
  setSelectedCategory,
  className,
  textClassName,
  showLines = true,
}) => {
  const leftOffset = useSharedValue(0)

  const itemWidth = useMemo(() => {
    return SCREEN_WIDTH / Math.max(categories.length, 3)
  }, [categories])

  const anim = useAnimatedStyle(() => {
    return {
      height: 2,
      backgroundColor: colors.red,
      width: itemWidth,
      transform: [
        {
          translateX: withTiming(leftOffset.value),
        },
      ],
    }
  }, [categories])

  const handlePress = (idx: number) => {
    leftOffset.value = idx * itemWidth * (I18nManager.isRTL ? -1 : 1)
    setSelectedCategory(idx)
  }

  return (
    <DmView className={clsx("", className)}>
      <DmView className="flex-row items-center">
        {categories.map((item, idx) => (
          <DmView
            key={idx}
            style={{ width: itemWidth }}
            onPress={() => handlePress(idx)}
          >
            <DmText
              className={clsx(
                textClassName ||
                  "text-11 leading-[14px] font-custom600 text-center"
              )}
              numberOfLines={1}
            >
              {item}
            </DmText>
          </DmView>
        ))}
      </DmView>
      {showLines && (
        <DmView className="mt-[4.5] justify-center">
          <DmView className="absolute w-full h-[1] bg-grey29" />
          <Animated.View style={anim} />
        </DmView>
      )}
    </DmView>
  )
}

export default AnimatedSelectCategory
