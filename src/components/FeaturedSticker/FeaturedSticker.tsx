import React from "react"
import { StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { DmView } from "@tappler/shared/src/components/UI"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"

// The Featured Pro pictures (the product's pictureEn / pictureAr) draw a
// 65 x 16 badge on a larger canvas: 86.57 x 18 in English, 86.57 x 19 in
// Arabic, with the badge ~10.79 units in from the left and 1 / 1.5 down, so
// there is empty space on every side. This window shows just the badge, so
// any gap beside it is the caller's. The cleaned files parked for upload keep
// the same canvas and offsets, so the window stays right after that upload;
// only art drawn without the margins would need it removed. Same component
// as proapp's.
const ART = {
  en: { width: 86.57, height: 18, badgeX: 10.786, badgeY: 1 },
  ar: { width: 86.57, height: 19, badgeX: 10.785, badgeY: 1.499 },
}
const BADGE = { width: 65, height: 16 }

interface Props {
  uri: string
  /** The badge's height on screen; its width follows (65:16). */
  height: number
}

const FeaturedSticker: React.FC<Props> = ({ uri, height }) => {
  const { i18n } = useTranslation()
  const art = i18n.language === "ar" ? ART.ar : ART.en
  const scale = height / BADGE.height
  const artWidth = art.width * scale
  const artHeight = art.height * scale

  return (
    <DmView style={[styles.window, { width: BADGE.width * scale, height }]}>
      <DmView
        style={{
          width: artWidth,
          height: artHeight,
          transform: [
            { translateX: -art.badgeX * scale },
            { translateY: -art.badgeY * scale },
          ],
        }}
      >
        <SvgUriContainer uri={uri} width={artWidth} height={artHeight} />
      </DmView>
    </DmView>
  )
}

const styles = StyleSheet.create({
  // The art is never mirrored, so the window is cut from its left edge in
  // both layout directions, whatever the language and I18nManager say.
  window: { overflow: "hidden", direction: "ltr" },
})

export default FeaturedSticker
