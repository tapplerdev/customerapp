import React from "react"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { formatMoney } from "@tappler/shared/src/helpers/money"
import RateComponent from "components/RateComponent/RateComponent"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"

import ChatBubbleIcon from "assets/icons/chat-bubble.svg"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MailIcon from "assets/icons/mail.svg"

import styles from "./styles"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import RatingSummary from "@tappler/shared/src/components/RatingSummary"
import OffersBox from "@tappler/shared/src/components/OffersBox"
import { offerStickerCell } from "@tappler/shared/src/components/OfferSticker/offerStickerCell"
import { offerStickersOf } from "@tappler/shared/src/helpers/offerSticker"
import { useFailedIcons } from "@tappler/shared/src/hooks/useFailedIcons"
// A trust sticker's slot, only as tall as its art (#522), one copy for both
// apps' cards.
import {
  TRUST_STICKER_HEIGHT,
  TRUST_STICKER_WIDTH,
} from "@tappler/shared/src/constants/trustSticker"

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

  const promoLine = subscriptions.find(
    (s: any) => s.product?.subType === "promoLine"
  )
  // The stickers as drawn (#533): icon and caption, else the picture for the
  // language, oldest first; an icon that failed to load falls back too.
  const { failedIcons, onIconError } = useFailedIcons()
  const stickers = offerStickersOf(subscriptions, isAr, failedIcons)

  return (
    <DmView
      style={[styles.container, a.pb_12, styles.cardShadow]}
      onPress={showSelectPassButtons ? undefined : onPress}
    >
      {/* Top section: photo + info */}
      <DmView style={a.flex_row}>
        {/* Profile photo */}
        <DmView>
          <DmView style={[styles.box, a.overflow_hidden]}>
            {!!photoUrl && (
              <FastImage
                source={{ uri: photoUrl }}
                style={styles.profilePhoto}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
          </DmView>
          {isFeatured && (
            <DmView style={[a.absolute, styles.boxWrap, a.self_center]}>
              <DmView
                style={[
                  styles.featuredWrap,
                  a.px_6,
                  a.items_center,
                  a.justify_center,
                  styles.featuredBadgeBorder,
                ]}
              >
                <Text size={10} weight="bold" style={styles.featured}>
                  {t("featured")}
                </Text>
              </DmView>
            </DmView>
          )}
        </DmView>

        {/* Info */}
        <DmView style={[a.flex_1, a.ml_10]}>
          <Text size={14} weight="bold" leading="tight">
            {displayName}
          </Text>

          <DmView style={[a.mt_4, a.flex_row, a.items_center]}>
            {isCompany ? (
              <BusinessIcon width={14} height={14} />
            ) : (
              <IndividualIcon width={14} height={14} />
            )}
            <Text size={10} style={a.ml_4}>
              {t(isCompany ? "business" : "individual")}
            </Text>
          </DmView>

          <DmView style={a.mt_6}>
            {/* One red star and "4.5 of 5 (12 Reviews)" (#522); a pro
                with no reviews keeps "New on Tappler". */}
            {reviewsCount > 0 ? (
              <RatingSummary
                rate={overallScore}
                reviewsCount={reviewsCount}
                size={11}
              />
            ) : (
              <RateComponent
                rate={overallScore}
                reviewsCount={reviewsCount}
                itemSize={12}
              />
            )}
          </DmView>

          {/* Description */}
          {!!informationAbout && (
            <Text size={10} leading="loose" style={a.mt_6} numberOfLines={2}>
              {informationAbout}
            </Text>
          )}

          {/* Offer badge + amount */}
          {showOfferBadge && (
            <DmView
              style={[a.mt_8, a.flex_row, a.items_center, a.justify_between]}
            >
              <DmView style={[a.flex_row, a.items_center]}>
                <DmView
                  style={[
                    a.px_8,
                    styles.offerAmountWrap,
                    a.mr_6,
                    styles.offerBadgeBorder,
                    { borderColor: colors.red },
                  ]}
                >
                  <Text size={12} weight="medium" leading="legacy">
                    {t("offer_amount")}
                  </Text>
                </DmView>
                <Text size={14} weight="bold" leading="legacy">
                  {offerAmount
                    ? `${formatMoney(offerAmount)} ${t("EGP")}`
                    : t("no_offer_yet")}
                </Text>
              </DmView>

              {unreadCount > 0 && (
                <DmView>
                  <MailIcon width={22} height={16} />
                  <DmView
                    style={[
                      a.absolute,
                      styles.textWrap,
                      a.items_center,
                      a.justify_center,
                    ]}
                  >
                    <Text
                      size={9}
                      weight="bold"
                      leading="legacy"
                      color="inverse"
                    >
                      {unreadCount}
                    </Text>
                  </DmView>
                </DmView>
              )}
            </DmView>
          )}
        </DmView>
      </DmView>

      {/* Opportunity notes bubble with triangle pointer */}
      {showOpportunityNotes && !!opportunityNotes && (
        <DmView style={[a.mt_4, { position: "relative" }]}>
          <ChatBubbleIcon
            width="100%"
            height={undefined}
            style={{ aspectRatio: 340.5 / 63.727 }}
            preserveAspectRatio="none"
          />
          <DmView
            style={[a.absolute, styles.textWrap2, a.px_18, a.justify_center]}
          >
            <Text size={12} leading={px(18)} numberOfLines={2}>
              {opportunityNotes}
            </Text>
          </DmView>
        </DmView>
      )}

      {/* Trust badges: no box round them, each slot as tall as its art
          (#522; the art is 143 x 19, so 150 wide is 20 tall), so two sit
          side by side on a 375pt phone; a third wraps. */}
      {trustDocs.length > 0 && (
        <DmView style={[a.mt_10, styles.trustRow]}>
          {trustDocs.map((doc) => {
            const imageUrl = isAr
              ? doc.trustDocumentData?.trustProduct?.pictureAr
              : doc.trustDocumentData?.trustProduct?.pictureEn
            return (
              <DmView key={doc.id}>
                {imageUrl ? (
                  <SvgUriContainer
                    width={TRUST_STICKER_WIDTH}
                    height={TRUST_STICKER_HEIGHT}
                    uri={imageUrl}
                  />
                ) : (
                  <Text
                    size={10}
                    weight="semibold"
                    leading="legacy"
                    color="tertiary"
                  >
                    {isAr
                      ? doc.trustDocumentData?.trustProduct?.descriptionAr
                      : doc.trustDocumentData?.trustProduct?.descriptionEn ||
                        t("background_checked")}
                  </Text>
                )}
              </DmView>
            )
          })}
        </DmView>
      )}

      {/* The OFFERS box (#522): the red tab over a white bordered box, the
          stickers in thirds, or halves for a pair, from the start edge
          (#525), thin dividers between them, after the trust stickers as on the pro's
          own card. It replaces the pink footer band. Each is the icon
          above its caption (#533), or the product's single picture,
          centred, untrimmed: the CMS template's group translate is what
          centres the drawing in its box (see OffersSection's strip). */}
      {stickers.length > 0 && (
        <OffersBox style={a.mt_12}>
          {stickers.map((item) =>
            offerStickerCell(item, SvgUriContainer, onIconError)
          )}
        </OffersBox>
      )}

      {/* Promo line */}
      {promoLine && promoLine.promoStickerMessage && (
        <PromoLine promoMessage={promoLine.promoStickerMessage} />
      )}

      {/* SELECT ME / PASS buttons */}
      {showSelectPassButtons && !isRejected && (
        <DmView style={[a.mt_12, a.flex_row, a.items_center]}>
          <DmView style={[a.flex_1, a.mr_8, styles.buttonShadow]}>
            <Button
              title={t("select_me").toUpperCase()}
              onPress={onSelect}
              size={px(38)}
              shape="r10"
              variant="bordered"
              label={12}
              labelWeight="semibold"
              labelLeading="legacy"
              labelColor="primary"
            />
          </DmView>
          <DmView style={[a.flex_1, styles.buttonShadow]}>
            <Button
              title={t("pass").toUpperCase()}
              onPress={onPass}
              size={px(38)}
              shape="r10"
              variant="bordered"
              label={12}
              labelWeight="semibold"
              labelLeading="legacy"
            />
          </DmView>
        </DmView>
      )}

      {/* Rejected label */}
      {isRejected && (
        <DmView style={a.mt_10}>
          <Text
            size={11}
            weight="medium"
            leading="legacy"
            color="tertiary"
            style={styles.italic}
          >
            {t("passed")}
          </Text>
        </DmView>
      )}
    </DmView>
  )
}

export default ProCardBase
