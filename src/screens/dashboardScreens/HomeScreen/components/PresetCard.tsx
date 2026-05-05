import React, { useCallback } from "react"
import { StyleSheet } from "react-native"
import FastImage, { FastImageProps } from "react-native-fast-image"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import {
  PresetSectionItemType,
  PresetSectionShapeType,
} from "types/cms"

interface Props {
  item: PresetSectionItemType
  shapeType: PresetSectionShapeType
  isAr: boolean
  noEndMargin?: boolean
  onPress?: () => void
}

const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 5,
  backgroundColor: "#fff",
}

const getTitle = (item: PresetSectionItemType, isAr: boolean): string => {
  const direct = isAr ? item.nameAr : item.nameEn
  if (direct) return direct
  const firstService = item.services?.[0]
  if (firstService) {
    return isAr ? firstService.nameAr : firstService.nameEn
  }
  const firstCategory = item.serviceCategories?.[0]
  if (firstCategory) {
    return isAr ? firstCategory.nameAr : firstCategory.nameEn
  }
  return ""
}

const AnimatedFastImage = Animated.createAnimatedComponent(FastImage)

const FadeInImage: React.FC<FastImageProps> = (props) => {
  const opacity = useSharedValue(0)
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const onLoad = useCallback(() => {
    opacity.value = withTiming(1, { duration: 300 })
  }, [])
  return <AnimatedFastImage {...props} onLoad={onLoad} style={[props.style, animStyle]} />
}

const PresetCard: React.FC<Props> = ({ item, shapeType, isAr, noEndMargin, onPress }) => {
  const title = getTitle(item, isAr)
  const picture = isAr ? item.pictureAr : item.pictureEn
  const imgUrl = picture?.url720 || picture?.url
  const endMargin = noEndMargin ? "" : "mr-[10]"

  switch (shapeType) {
    case "squareWithOverlay":
      return (
        <DmView
          className={`${endMargin} w-[100] h-[110] rounded-10`}
          style={cardShadow}
          onPress={onPress}
        >
          <DmView className="flex-1 rounded-10 overflow-hidden">
            {!!imgUrl && (
              <FadeInImage
                source={{ uri: imgUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
            <DmView className="absolute bottom-[8] left-[8] right-[8]">
              <DmText className="text-white font-custom700 text-12 leading-[14px]">
                {title}
              </DmText>
            </DmView>
          </DmView>
        </DmView>
      )

    case "rectangleWithOverlay":
      return (
        <DmView
          className={`${endMargin} w-[210] h-[120] rounded-10`}
          style={cardShadow}
          onPress={onPress}
        >
          <DmView className="flex-1 rounded-10 overflow-hidden">
            {!!imgUrl && (
              <FadeInImage
                source={{ uri: imgUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
            <DmView className="absolute bottom-[10] left-[10] right-[10]">
              <DmText className="text-white font-custom700 text-15 leading-[18px]">
                {title}
              </DmText>
            </DmView>
          </DmView>
        </DmView>
      )

    case "doubleRectangles":
      return (
        <DmView className={`${endMargin} w-[168]`} onPress={onPress}>
          <DmView
            className="w-full h-[63] rounded-6"
            style={cardShadow}
          >
            <DmView className="flex-1 rounded-6 overflow-hidden">
              {!!imgUrl && (
                <FadeInImage
                  source={{ uri: imgUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
            </DmView>
          </DmView>
          <DmText className="mt-[6] text-black font-custom600 text-13">
            {title}
          </DmText>
        </DmView>
      )

    case "rectangleWithText":
      return (
        <DmView className={`${endMargin} w-[150]`} onPress={onPress}>
          <DmView
            className="w-full h-[90] rounded-10"
            style={cardShadow}
          >
            <DmView className="flex-1 rounded-10 overflow-hidden">
              {!!imgUrl && (
                <FadeInImage
                  source={{ uri: imgUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
            </DmView>
          </DmView>
          <DmText className="mt-[6] text-black font-custom600 text-13">
            {title}
          </DmText>
        </DmView>
      )

    default:
      return null
  }
}

export default PresetCard
