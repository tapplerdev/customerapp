import React from "react"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"
import { View } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"
import type { CoachMarkTarget } from "@tappler/shared/src/components/CoachMark"
import colors from "@tappler/shared/src/styles/colors"
import { ProType } from "types/pro"
import RateComponent from "components/RateComponent/RateComponent"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"

import LocationIcon from "assets/icons/location-red.svg"
import DeliveryTruckIcon from "assets/icons/delivery-truck.svg"
import PickupBagIcon from "assets/icons/pickup-bag.svg"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MessagesRedIcon from "assets/icons/messages-red.svg"
import ReplyIcon from "assets/icons/reply.svg"

import styles from "./styles"
import { Text, a } from "@tappler/shared/src/ds"
import RatingSummary from "@tappler/shared/src/components/RatingSummary"
import OffersBox, {
  OFFER_STICKER_HEIGHT,
} from "@tappler/shared/src/components/OffersBox"

// A trust sticker's slot, as tall as its art (143 x 19 at 150 wide). KEEP IN
// SYNC with ProCardBase and the pro app's ProfileCardPreview.
const TRUST_STICKER_WIDTH = 150
const TRUST_STICKER_HEIGHT = 20

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
  // The first card of the listing carries the "best deal" tip's CoachMark target.
  tourTarget?: CoachMarkTarget
  // Food (hasMenu) listing: shortlisting doesn't apply — the select button
  // becomes a solid "Food Menu" action instead
  foodMode?: boolean
  onViewMenu?: (pro: ProType) => void
}

const ProCard: React.FC<Props> = ({ pro, isSelected, onSelect, onMessage, onPressProfile, tourTarget, foodMode, onViewMenu }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  // Food results show the pro's APPROVED screen name (brand), falling back to
  // business/registered name; other categories keep the current name.
  const displayName = foodMode
    ? pro.screenName || pro.businessName || pro.registeredName
    : pro.businessName || pro.registeredName

  const distanceLabel =
    foodMode && pro.distanceKm != null
      ? pro.distanceKm < 1
        ? t("meters_away", { value: Math.round(pro.distanceKm * 1000) })
        : t("km_away", { value: pro.distanceKm.toFixed(1) })
      : null

  // Capability badges (food only): both modes → two neutral pills; a single
  // mode → an accented "only" pill so the constraint stands out.
  const modeBadges: {
    label: string
    accent: boolean
    mode: "delivery" | "pickup"
  }[] = !foodMode
    ? []
    : pro.isDeliveryEnabled && pro.isPickupEnabled
      ? [
          { label: t("delivery"), accent: false, mode: "delivery" },
          { label: t("pickup"), accent: false, mode: "pickup" },
        ]
      : pro.isPickupEnabled
        ? [{ label: t("pickup_only"), accent: true, mode: "pickup" }]
        : pro.isDeliveryEnabled
          ? [{ label: t("delivery_only"), accent: true, mode: "delivery" }]
          : []
  // Nested: ProAddressDto wraps an AddressDto. Read flat, this was always
  // undefined and the card silently rendered no location.
  const location = [pro.address?.address?.city, pro.address?.address?.governorate]
    .filter(Boolean)
    .join(", ")
  const photoUrl = pro.profilePhoto150 || pro.profilePhoto
  const hasPhoto = !!photoUrl

  const isFeatured = pro.serviceCategories?.[0]?.isFeatured
  const isCompany = pro.proType === "company"

  const overallScore = pro.reviewScore?.overallScore || 0
  const reviewsCount = pro.reviewScore?.reviewsCount || 0

  const subscriptions = pro.serviceCategories?.[0]?.subscriptions || []
  const motivational = subscriptions.filter((s: any) => s.product?.subType === "motivational")

  const trustDocs = pro.documents?.filter(
    (d) => d.type === "trust" && d.status === "approved"
  ) || []

  const innerCard = (
    <DmView
      style={[styles.list, a.pb_12, styles.cardShadow]}
    >
      {/* Top section: photo + info — tappable for profile */}
      <DmView style={a.flex_row} onPress={() => onPressProfile?.(pro)}>
        {/* Profile photo */}
        <DmView>
          <DmView
            style={[styles.box, a.overflow_hidden]}
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
            <DmView style={[a.absolute, styles.boxWrap, a.self_center]}>
              <DmView
                style={[styles.featuredWrap, a.px_6, a.items_center, a.justify_center, styles.featuredBadgeBorder]}
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
          {/* Name */}
          <Text size={14} weight="bold" leading="tight">
            {displayName}
          </Text>

          {/* Type + Location */}
          <DmView style={[a.mt_4, a.flex_row, a.items_center]}>
            {isCompany ? (
              <BusinessIcon width={14} height={14} />
            ) : (
              <IndividualIcon width={14} height={14} />
            )}
            <Text size={10} style={a.ml_4}>
              {t(isCompany ? "business" : "individual")}
            </Text>
            {!!location && (
              <>
                <DmView style={a.mx_6}>
                  <LocationIcon width={10} height={10} />
                </DmView>
                <Text
                  size={10}
                  style={styles.text}
                  numberOfLines={1}
                >
                  {location}
                </Text>
              </>
            )}
          </DmView>

          {/* Rating */}
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

          {/* Response time */}
          {pro.responseTimeHours != null && (
            <DmView style={[a.flex_row, a.mt_4]}>
              <ReplyIcon width={14} height={14} />
              <Text size={10} weight="semibold" style={[a.ml_4, { alignSelf: "flex-end" }]}>
                {formatResponseTime(pro.responseTimeHours)}
              </Text>
            </DmView>
          )}

          {/* Distance + fulfillment badges (food only) — one wrapping row */}
          {(!!distanceLabel || modeBadges.length > 0) && (
            <DmView style={[a.flex_row, a.items_center, a.flex_wrap, a.mt_6]}>
              {!!distanceLabel && (
                <DmView style={[a.flex_row, a.items_center, a.mr_6, a.mb_4, a.px_8, a.py_4, styles.row]}>
                  <LocationIcon width={11} height={11} />
                  <Text size={10} weight="bold" style={a.ml_4}>
                    {distanceLabel}
                  </Text>
                </DmView>
              )}
              {modeBadges.map((badge, i) => {
                const Icon =
                  badge.mode === "delivery" ? DeliveryTruckIcon : PickupBagIcon
                return (
                  <DmView
                    key={i}
                    style={[
                      a.flex_row,
                      a.items_center,
                      a.mr_6,
                      a.mb_4,
                      a.px_8,
                      a.py_4,
                      styles.container,
                      badge.accent ? styles.containerAccent : styles.containerNotAccent,
                    ]}
                  >
                    <Icon
                      width={12}
                      height={12}
                      color={badge.accent ? colors.white : colors.grey13}
                    />
                    <Text
                      size={10}
                      weight="bold"
                      color={badge.accent ? "inverse" : "primary"}
                      style={a.ml_4}
                    >
                      {badge.label}
                    </Text>
                  </DmView>
                )
              })}
            </DmView>
          )}

          {/* Description */}
          {!!pro.informationAbout && (
            <Text
              size={10}
              style={a.mt_6}
              numberOfLines={2}
            >
              {pro.informationAbout}
            </Text>
          )}
        </DmView>
      </DmView>

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
                  <Text size={10} weight="semibold" leading="legacy" color="tertiary">
                    {isAr
                      ? doc.trustDocumentData?.trustProduct?.descriptionAr
                      : doc.trustDocumentData?.trustProduct?.descriptionEn
                      || t("background_checked")}
                  </Text>
                )}
              </DmView>
            )
          })}
        </DmView>
      )}

      {/* The OFFERS box (#522): the red tab over a white bordered box, the
          stickers spread evenly with thin dividers, after the trust
          stickers as on the pro's own card. It replaces the pink footer
          band. Each is the product's single picture, centred. */}
      {motivational.length > 0 && (
        <OffersBox style={a.mt_12}>
          {motivational.map((sub: any, idx: number) => {
            const uri = isAr ? sub.product?.pictureAr : sub.product?.pictureEn
            return uri ? (
              <SvgUriContainer
                key={sub.id || idx}
                width="100%"
                height={OFFER_STICKER_HEIGHT}
                uri={uri}
              />
            ) : null
          })}
        </OffersBox>
      )}

      {/* Promo line */}
      {subscriptions.find((s: any) => s.product?.subType === "promoLine")?.promoStickerMessage && (
        <PromoLine
          promoMessage={subscriptions.find((s: any) => s.product?.subType === "promoLine").promoStickerMessage}
        />
      )}

      {/* Buttons: Chat + Select */}
      <DmView style={[a.mt_12, a.flex_row, a.items_center]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center, styles.buttonShadow, { flex: 1 }]}
          onPress={() => onMessage?.(pro)}
        >
          <MessagesRedIcon width={18} height={18} />
        </DmView>
        {foodMode ? (
          <DmView
            style={[a.ml_8, styles.iconWrap, a.items_center, a.justify_center, 
              styles.buttonShadow,
              { flex: 2, borderColor: colors.red, backgroundColor: colors.red },
            ]}
            onPress={() => onViewMenu?.(pro)}
          >
            <Text size={13} weight="semibold" leading="legacy" color="inverse">
              {t("food_menu")}
            </Text>
          </DmView>
        ) : (
          <DmView
            style={[a.ml_8, styles.iconWrap, a.items_center, a.justify_center, 
              styles.buttonShadow,
              {
                flex: 2,
                borderColor: isSelected ? colors.red : "#CC0000",
                backgroundColor: isSelected ? colors.red : "#FFEBEBB2",
              },
            ]}
            onPress={() => onSelect(pro)}
          >
            <Text size={13} weight="medium" leading="legacy" color={isSelected ? "inverse" : "primary"}>
              {isSelected ? t("selected") : t("select_me")}
            </Text>
          </DmView>
        )}
      </DmView>
    </DmView>
  )

  return (
    <DmView style={[a.mx_16, a.mb_12]}>
      {tourTarget ? (
        // onLayout keeps the View from being flattened away on Android, which
        // the target's measureInWindow needs (see CoachMark).
        <View ref={tourTarget.ref} onLayout={tourTarget.onLayout}>
          {innerCard}
        </View>
      ) : (
        innerCard
      )}
    </DmView>
  )
}

export default React.memo(ProCard)
