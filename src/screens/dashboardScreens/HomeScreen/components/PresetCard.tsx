import React, { useCallback } from "react"
import { StyleSheet } from "react-native"
import FastImage, { FastImageProps } from "react-native-fast-image"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated"

import { DmView } from "@tappler/shared/src/components/UI"

import {
  PresetSectionItemType,
  PresetSectionShapeType,
} from "types/cms"
import { Text, a, px } from "@tappler/shared/src/ds"
import { presetCardStyles } from "./styles"

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

  switch (shapeType) {
    case "squareWithOverlay":
      return (
        <DmView
          style={[!noEndMargin && a.mr_10, presetCardStyles.container, cardShadow]}
          onPress={onPress}
        >
          <DmView style={[a.flex_1, presetCardStyles.box, a.overflow_hidden]}>
            {!!imgUrl && (
              <FadeInImage
                source={{ uri: imgUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
            <DmView style={[a.absolute, presetCardStyles.textWrap]}>
              <Text size={12} weight="bold" leading={px(14)} color="inverse">
                {title}
              </Text>
            </DmView>
          </DmView>
        </DmView>
      )

    case "rectangleWithOverlay":
      return (
        <DmView
          style={[!noEndMargin && a.mr_10, presetCardStyles.container2, cardShadow]}
          onPress={onPress}
        >
          <DmView style={[a.flex_1, presetCardStyles.box, a.overflow_hidden]}>
            {!!imgUrl && (
              <FadeInImage
                source={{ uri: imgUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
            <DmView style={[a.absolute, presetCardStyles.textWrap2]}>
              <Text size={15} weight="bold" leading={px(18)} color="inverse">
                {title}
              </Text>
            </DmView>
          </DmView>
        </DmView>
      )

    case "doubleRectangles":
      return (
        <DmView style={[!noEndMargin && a.mr_10, presetCardStyles.container3]} onPress={onPress}>
          <DmView
            style={[a.w_full, presetCardStyles.boxWrap, cardShadow]}
          >
            <DmView style={[a.flex_1, presetCardStyles.box2, a.overflow_hidden]}>
              {!!imgUrl && (
                <FadeInImage
                  source={{ uri: imgUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
            </DmView>
          </DmView>
          <Text size={13} weight="semibold" leading="legacy" style={a.mt_6}>
            {title}
          </Text>
        </DmView>
      )

    case "rectangleWithText":
      return (
        <DmView style={[!noEndMargin && a.mr_10, presetCardStyles.container4]} onPress={onPress}>
          <DmView
            style={[a.w_full, presetCardStyles.boxWrap2, cardShadow]}
          >
            <DmView style={[a.flex_1, presetCardStyles.box, a.overflow_hidden]}>
              {!!imgUrl && (
                <FadeInImage
                  source={{ uri: imgUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
            </DmView>
          </DmView>
          <Text size={13} weight="semibold" leading="legacy" style={a.mt_6}>
            {title}
          </Text>
        </DmView>
      )

    default:
      return null
  }
}

export default PresetCard
