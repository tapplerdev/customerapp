import React from "react"
import { Dimensions } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import BannerContainer from "components/BannerContainer/BannerContainer"

interface OffersSectionProps {
  subscriptions: any[]
  className?: string
  compact?: boolean
  /**
   * "banner" (default) — the red OFFERS tab treatment (BannerContainer).
   * "strip" — flush tinted footer band on the pro card: no tab, no border,
   * every sticker at the SAME fixed size, evenly spaced. The caller supplies
   * any negative margins needed to bleed to the card's edges.
   */
  variant?: "banner" | "strip"
}

const SCREEN_WIDTH = Dimensions.get("window").width

// Strip stickers are FIXED (not width-distributed) so every sticker renders at
// an identical size regardless of how many a pro has.
const STRIP_STICKER_WIDTH = 112
const STRIP_STICKER_HEIGHT = 40
const STRIP_BACKGROUND = "#FFF8F8"

const OffersSection: React.FC<OffersSectionProps> = ({
  subscriptions,
  className = "",
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
      <DmView
        className={`flex-row items-center justify-around py-[8] px-[10] ${className}`}
        style={{ backgroundColor: STRIP_BACKGROUND }}
      >
        {stickerProducts.map((sub: any, idx: number) => {
          const uri = stickerUri(sub)
          return uri ? (
            <SvgUriContainer
              key={sub.id || idx}
              width={STRIP_STICKER_WIDTH}
              height={STRIP_STICKER_HEIGHT}
              uri={uri}
            />
          ) : null
        })}
      </DmView>
    )
  }

  const stickerWidth = compact
    ? 100
    : Math.min((SCREEN_WIDTH - 56) / (stickerProducts.length || 1), 120)

  return (
    <BannerContainer
      bannerText={t("offers")}
      className={`${compact ? "mx-0" : "mx-[10]"} ${className}`}
      borderRadius={compact ? 6 : 10}
      containerClassName={
        compact
          ? "px-[8] py-[0] flex-row items-center justify-around"
          : "py-[2] flex-row flex-wrap items-center justify-around"
      }
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
