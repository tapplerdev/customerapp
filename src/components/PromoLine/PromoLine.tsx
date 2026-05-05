import React from "react"
import { DmText } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import colors from "@tappler/shared/src/styles/colors"
import BannerContainer from "components/BannerContainer/BannerContainer"

interface PromoLineProps {
  promoMessage: string
  className?: string
}

const PromoLine: React.FC<PromoLineProps> = ({
  promoMessage,
  className = "",
}) => {
  const { t } = useTranslation()

  return (
    <BannerContainer
      bannerText={t("offer")}
      className={className}
      borderRadius={6}
      containerStyle={{
        backgroundColor: colors.pink5,
      }}
    >
      <DmText className="text-black text-12 leading-[16px] font-custom600 text-center">
        {promoMessage}
      </DmText>
    </BannerContainer>
  )
}

export default PromoLine
