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
}

const SCREEN_WIDTH = Dimensions.get("window").width

const OffersSection: React.FC<OffersSectionProps> = ({
  subscriptions,
  className = "",
  compact = false,
}) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const stickerProducts = subscriptions.filter(
    (sub) => sub.product?.subType === "motivational"
  )

  if (!stickerProducts.length) {
    return null
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
