import React from "react"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"

import { DmText, DmView, ActionBtn } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import RateComponent from "components/RateComponent/RateComponent"
import OffersSection from "components/OffersSection/OffersSection"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"

import ChatBubbleIcon from "assets/icons/chat-bubble.svg"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MailIcon from "assets/icons/mail.svg"

import styles from "./styles"

interface ProCardBaseProps {
  // Pro data
  displayName: string
  photoUrl?: string
  isCompany: boolean
  overallScore: number
  reviewsCount: number
  isFeatured?: boolean
  informationAbout?: string
  trustDocs?: any[]
  subscriptions?: any[]

  // Offer data (optional)
  offerAmount?: number | null
  opportunityNotes?: string
  unreadCount?: number

  // Actions
  onPress?: () => void
  onSelect?: () => void
  onPass?: () => void

  // Display options
  showOfferBadge?: boolean
  showSelectPassButtons?: boolean
  showOpportunityNotes?: boolean
  isRejected?: boolean
  isAr?: boolean
}

const ProCardBase: React.FC<ProCardBaseProps> = ({
  displayName,
  photoUrl,
  isCompany,
  overallScore,
  reviewsCount,
  isFeatured,
  informationAbout,
  trustDocs = [],
  subscriptions = [],

  offerAmount,
  opportunityNotes,
  unreadCount = 0,

  onPress,
  onSelect,
  onPass,

  showOfferBadge = false,
  showSelectPassButtons = false,
  showOpportunityNotes = false,
  isRejected = false,
  isAr = false,
}) => {
  const { t } = useTranslation()

  const promoLine = subscriptions.find((s: any) => s.product?.subType === "promoLine")

  return (
    <DmView
      className="bg-white rounded-20 px-[15] pt-[15] pb-[12]"
      style={styles.cardShadow}
      onPress={showSelectPassButtons ? undefined : onPress}
    >
      {/* Top section: photo + info */}
      <DmView className="flex-row">
        {/* Profile photo */}
        <DmView>
          <DmView className="w-[85] h-[85] rounded-2 overflow-hidden bg-grey8">
            {!!photoUrl && (
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
          <DmText className="text-14 leading-[17px] font-custom700 text-black">
            {displayName}
          </DmText>

          <DmView className="mt-[4] flex-row items-center">
            {isCompany ? (
              <BusinessIcon width={14} height={14} />
            ) : (
              <IndividualIcon width={14} height={14} />
            )}
            <DmText className="ml-[4] text-10 leading-[13px] font-custom400">
              {t(isCompany ? "business" : "individual")}
            </DmText>
          </DmView>

          <DmView className="mt-[6]">
            <RateComponent
              rate={overallScore}
              reviewsCount={reviewsCount}
              itemSize={12}
            />
          </DmView>

          {/* Description */}
          {!!informationAbout && (
            <DmText
              className="mt-[6] text-10 leading-[15px] font-custom400"
              numberOfLines={2}
            >
              {informationAbout}
            </DmText>
          )}

          {/* Offer badge + amount */}
          {showOfferBadge && (
            <DmView className="mt-[8] flex-row items-center justify-between">
              <DmView className="flex-row items-center">
                <DmView
                  className="px-[8] py-[3] mr-[6]"
                  style={[styles.offerBadgeBorder, { borderColor: colors.red }]}
                >
                  <DmText className="text-12 font-custom500">
                    {t("offer_amount")}
                  </DmText>
                </DmView>
                <DmText className="text-14 font-custom700 text-black">
                  {offerAmount ? `${offerAmount} EGP` : t("no_offer_yet")}
                </DmText>
              </DmView>

              {unreadCount > 0 && (
                <DmView>
                  <MailIcon width={22} height={16} />
                  <DmView className="absolute top-[-8] right-[-8] w-[18] h-[18] rounded-full bg-red items-center justify-center">
                    <DmText className="text-9 font-custom700 text-white">
                      {unreadCount}
                    </DmText>
                  </DmView>
                </DmView>
              )}
            </DmView>
          )}
        </DmView>
      </DmView>

      {/* Opportunity notes bubble with triangle pointer */}
      {showOpportunityNotes && !!opportunityNotes && (
        <DmView className="mt-[4]" style={{ position: "relative" }}>
          <ChatBubbleIcon width="100%" height={undefined} style={{ aspectRatio: 340.5 / 63.727 }} preserveAspectRatio="none" />
          <DmView className="absolute left-0 right-0 top-[12] bottom-0 px-[18] justify-center">
            <DmText className="text-12 leading-[18px] font-custom400 text-black" numberOfLines={2}>
              {opportunityNotes}
            </DmText>
          </DmView>
        </DmView>
      )}

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

      {/* Promo line */}
      {promoLine && promoLine.promoStickerMessage && (
        <PromoLine
          promoMessage={promoLine.promoStickerMessage}
          className="mt-[8]"
        />
      )}

      {/* OFFERS banner */}
      <DmView className="mt-[16]">
        <OffersSection
          subscriptions={subscriptions}
          compact
        />
      </DmView>

      {/* SELECT ME / PASS buttons */}
      {showSelectPassButtons && !isRejected && (
        <DmView className="mt-[12] flex-row items-center">
          <DmView className="flex-1 mr-[8]" style={styles.buttonShadow}>
            <ActionBtn
              title={t("select_me").toUpperCase()}
              onPress={onSelect}
              variant="bordered"
              className="h-[38] rounded-10"
              textClassName="text-12 font-custom600 text-black"
            />
          </DmView>
          <DmView className="flex-1" style={styles.buttonShadow}>
            <ActionBtn
              title={t("pass").toUpperCase()}
              onPress={onPass}
              variant="bordered"
              className="h-[38] rounded-10"
              textClassName="text-12 font-custom600"
            />
          </DmView>
        </DmView>
      )}

      {/* Rejected label */}
      {isRejected && (
        <DmView className="mt-[10]">
          <DmText className="text-11 font-custom500 text-grey3" style={styles.italic}>
            {t("passed")}
          </DmText>
        </DmView>
      )}
    </DmView>
  )
}

export default ProCardBase
