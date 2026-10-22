import React from "react"
import { Dimensions } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import BannerContainer, {
  BannerTab,
} from "components/BannerContainer/BannerContainer"
import { a } from "@tappler/shared/src/ds"
import styles from "./styles"

interface OffersSectionProps {
  subscriptions: any[]
  compact?: boolean
  /**
   * "banner" (default) — the red OFFERS tab treatment (BannerContainer).
   * "strip" — flush tinted footer band on the pro card, under the same red
   * OFFERS tab: no border, every sticker at the SAME fixed size, from the
   * band's start edge. The caller supplies any negative margins needed to
   * bleed to the card's edges.
   */
  variant?: "banner" | "strip"
}

const SCREEN_WIDTH = Dimensions.get("window").width

// Strip stickers are FIXED (not width-distributed) so every sticker renders at
// an identical size regardless of how many a pro has.
const STRIP_STICKER_WIDTH = 112
// The sticker art is drawn at 118.33 x 31.31, so at 112 wide it is 30 tall;
// a 40pt box left 5pt of empty band above and below every sticker.
const STRIP_STICKER_HEIGHT = 30
// The band's tint, and the stickers from its start edge (left in English,
// right in Arabic) whatever their count, wrapping when they do not fit.
// No gap between them: the art carries its own side margins, and three
// 112pt boxes only just fit a 390pt phone's band (336 of 338pt).
const STRIP_STYLE = { backgroundColor: "#FFF8F8", rowGap: 6 }

const OffersSection: React.FC<OffersSectionProps> = ({
  subscriptions,
  compact = false,
  variant = "banner",
}) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const stickerProducts = subscriptions.filter(
    (sub) => sub.product?.subType === "motivational"
  )

  if (!stickerProducts.length) {
    return null
  }

  const stickerUri = (sub: any): string | undefined =>
    isAr ? sub.product?.pictureAr : sub.product?.pictureEn

  if (variant === "strip") {
    return (
      <DmView>
        {/* The profile page's OFFERS tab (BannerContainer's, same copy), on
            the band's top edge and inset 10pt over its first sticker (#503).
            The card lost it on 2026-07-26 (11ea1f8), when its stickers left
            the banner for this band. The pro app's preview of this card
            (ProfileCardPreview) draws the same tab and band: keep in sync. */}
        <DmView style={a.px_10}>
          <BannerTab text={t("offers")} />
        </DmView>
        <DmView
          style={[a.flex_row, a.flex_wrap, a.items_center, a.py_8, a.px_10, STRIP_STYLE]}
        >
          {stickerProducts.map((sub: any, idx: number) => {
            const uri = stickerUri(sub)
            return uri ? (
              <SvgUriContainer
                key={sub.id || idx}
                width={STRIP_STICKER_WIDTH}
                height={STRIP_STICKER_HEIGHT}
                // No trimming here, deliberately. Each sticker gets the same box
                // and the SVG default (xMidYMid) places its art the same way
                // inside it; the boxes themselves start at the band's start edge
                // (product's call, 2026-10-03: stickers sit to the left however
                // many there are; they were centred before).
                //
                // autoTrimLeftPadding used to be on, and it was the reason the
                // row looked pushed left: it zeroes each file's group translate,
                // and those differ per sticker (13.4 / 17.2 / 19.6 units), so it
                // shifted every artwork left by a DIFFERENT amount. That is a
                // fix for lining stickers up against a column of text on the pro
                // profile; here it only made the stickers uneven.
                uri={uri}
              />
            ) : null
          })}
        </DmView>
      </DmView>
    )
  }

  const stickerWidth = compact
    ? 100
    : Math.min((SCREEN_WIDTH - 56) / (stickerProducts.length || 1), 120)

  return (
    <BannerContainer
      bannerText={t("offers")}
      borderRadius={compact ? 6 : 10}
      containerStyle={compact ? styles.boxCompact : styles.box}
    >
      {stickerProducts.map((sub: any, idx: number) => {
        const imageUrl = isAr
          ? sub.product?.pictureAr
          : sub.product?.pictureEn
        return imageUrl ? (
          <SvgUriContainer
            key={sub.id || idx}
            width={stickerWidth}
            {...(compact && { height: 35 })}
            uri={imageUrl}
          />
        ) : null
      })}
    </BannerContainer>
  )
}

export default OffersSection
