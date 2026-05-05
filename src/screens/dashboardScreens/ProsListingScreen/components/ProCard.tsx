import React from "react"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"
import { TourGuideZone } from "rn-tourguide"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { ProType } from "types/pro"
import RateComponent from "components/RateComponent/RateComponent"
import OffersSection from "components/OffersSection/OffersSection"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"

import LocationIcon from "assets/icons/location-red.svg"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MessagesRedIcon from "assets/icons/messages-red.svg"
import ReplyIcon from "assets/icons/reply.svg"

import styles from "./styles"

function formatResponseTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60))
    return `Responds in about ${minutes} min`
  }
  if (hours < 24) {
    const h = Math.round(hours)
    return `Responds in about ${h} ${h === 1 ? "hour" : "hours"}`
  }
  const days = Math.round(hours / 24)
  return `Responds in about ${days} ${days === 1 ? "day" : "days"}`
}

interface Props {
  pro: ProType
  isSelected: boolean
  onSelect: (pro: ProType) => void
  onMessage?: (pro: ProType) => void
  onPressProfile?: (pro: ProType) => void
  isTourTarget?: boolean
}

const ProCard: React.FC<Props> = ({ pro, isSelected, onSelect, onMessage, onPressProfile, isTourTarget }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const displayName = pro.businessName || pro.registeredName
  const location = [pro.address?.city, pro.address?.governorate]
    .filter(Boolean)
    .join(", ")
  const photoUrl = pro.profilePhoto150 || pro.profilePhoto
  const hasPhoto = !!photoUrl

  const isFeatured = pro.serviceCategories?.[0]?.isFeatured
  const isCompany = pro.proType === "company"

  const overallScore = pro.reviewScore?.overallScore || 0
  const reviewsCount = pro.reviewScore?.reviewsCount || 0

  const subscriptions = pro.serviceCategories?.[0]?.subscriptions || []

  const trustDocs = pro.documents?.filter(
    (d) => d.type === "trust" && d.status === "approved"
  ) || []

  const innerCard = (
    <DmView
      className="bg-white rounded-20 px-[15] pt-[15] pb-[12]"
      style={styles.cardShadow}
    >
      {/* Top section: photo + info — tappable for profile */}
      <DmView className="flex-row" onPress={() => onPressProfile?.(pro)}>
        {/* Profile photo */}
        <DmView>
          <DmView
            className="w-[85] h-[85] rounded-2 overflow-hidden bg-grey8"
          >
            {hasPhoto && (
              <FastImage
                source={{ uri: photoUrl }}
                style={styles.profilePhoto}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
          </DmView>
          {isFeatured && (
            <DmView className="absolute top-[-8] self-center">
              <DmView
                className="h-[18] px-[6] rounded-5 bg-yellow items-center justify-center"
                style={styles.featuredBadgeBorder}
              >
                <DmText className="text-10 leading-[13px] font-custom700 uppercase">
                  {t("featured")}
                </DmText>
              </DmView>
            </DmView>
          )}
        </DmView>

        {/* Info */}
        <DmView className="flex-1 ml-[10]">
          {/* Name */}
          <DmText className="text-14 leading-[17px] font-custom700 text-black">
            {displayName}
          </DmText>

          {/* Type + Location */}
          <DmView className="mt-[4] flex-row items-center">
            {isCompany ? (
              <BusinessIcon width={14} height={14} />
            ) : (
              <IndividualIcon width={14} height={14} />
            )}
            <DmText className="ml-[4] text-10 leading-[13px] font-custom400">
              {t(isCompany ? "business" : "individual")}
            </DmText>
            {!!location && (
              <>
                <DmView className="mx-[6]">
                  <LocationIcon width={10} height={10} />
                </DmView>
                <DmText
                  className="text-10 leading-[13px] font-custom400 flex-shrink"
                  numberOfLines={1}
                >
                  {location}
                </DmText>
              </>
            )}
          </DmView>

          {/* Rating */}
          <DmView className="mt-[6]">
            <RateComponent
              rate={overallScore}
              reviewsCount={reviewsCount}
              itemSize={12}
            />
          </DmView>

          {/* Response time */}
          {pro.responseTimeHours != null && (
            <DmView className="flex-row mt-[4]">
              <ReplyIcon width={14} height={14} />
              <DmText className="ml-[4] text-10 leading-[13px] font-custom600" style={{ alignSelf: "flex-end" }}>
                {formatResponseTime(pro.responseTimeHours)}
              </DmText>
            </DmView>
          )}

          {/* Description */}
          {!!pro.informationAbout && (
            <DmText
              className="mt-[6] text-10 leading-[13px] font-custom400"
              numberOfLines={2}
            >
              {pro.informationAbout}
            </DmText>
          )}
        </DmView>
      </DmView>

      {/* Trust badges */}
      {trustDocs.length > 0 && (
        <DmView className="mt-[10] flex-row flex-wrap">
          {trustDocs.map((doc) => {
            const imageUrl = isAr
              ? doc.trustDocumentData?.trustProduct?.pictureAr
              : doc.trustDocumentData?.trustProduct?.pictureEn
            return (
              <DmView key={doc.id} className="mr-[10]">
                {imageUrl ? (
                  <SvgUriContainer width={160} height={40} uri={imageUrl} />
                ) : (
                  <DmText className="text-10 font-custom600 text-grey3">
                    {isAr
                      ? doc.trustDocumentData?.trustProduct?.descriptionAr
                      : doc.trustDocumentData?.trustProduct?.descriptionEn
                      || t("background_checked")}
                  </DmText>
                )}
              </DmView>
            )
          })}
        </DmView>
      )}

      {/* OFFERS banner */}
      <DmView className="mt-[16]">
        <OffersSection
          subscriptions={subscriptions}
          compact
        />
      </DmView>

      {/* Promo line */}
      {subscriptions.find((s: any) => s.product?.subType === "promoLine")?.promoStickerMessage && (
        <PromoLine
          promoMessage={subscriptions.find((s: any) => s.product?.subType === "promoLine").promoStickerMessage}
          className="mt-[8]"
        />
      )}

      {/* Buttons: Chat + Select */}
      <DmView className="mt-[12] flex-row items-center">
        <DmView
          className="h-[34] rounded-10 items-center justify-center"
          style={[styles.buttonShadow, { flex: 1 }]}
          onPress={() => onMessage?.(pro)}
        >
          <MessagesRedIcon width={18} height={18} />
        </DmView>
        <DmView
          className="ml-[8] h-[34] rounded-10 items-center justify-center"
          style={[
            styles.buttonShadow,
            {
              flex: 2,
              borderColor: isSelected ? colors.red : "#CC0000",
              backgroundColor: isSelected ? colors.red : "#FFEBEBB2",
            },
          ]}
          onPress={() => onSelect(pro)}
        >
          <DmText className={`text-13 font-custom500 ${isSelected ? "text-white" : "text-black"}`}>
            {isSelected ? t("selected") : t("select_me")}
          </DmText>
        </DmView>
      </DmView>
    </DmView>
  )

  return (
    <DmView className="mx-[16] mb-[12]">
      {isTourTarget ? (
        <TourGuideZone zone={1} shape="rectangle" borderRadius={20} text="">
          {innerCard}
        </TourGuideZone>
      ) : (
        innerCard
      )}
    </DmView>
  )
}

export default React.memo(ProCard)
