import React, { useMemo, useRef, useState } from "react"
import {
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
  TouchableOpacity,
} from "react-native"
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { parse, format } from "date-fns"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { ProWorkPhotoType } from "types/pro"
import { useGetProProfileQuery, useLazyOpenChatQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import RateComponent from "components/RateComponent/RateComponent"
import OffersSection from "components/OffersSection/OffersSection"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import FeaturedSticker from "components/FeaturedSticker/FeaturedSticker"
import CachedImage from "@tappler/shared/src/components/CachedImage"
import {
  WORK_PHOTO_GAP,
  WORK_PHOTO_RADIUS,
  workPhotoHeight,
  workPhotoTileUri,
  workPhotoWidth,
} from "@tappler/shared/src/constants/workPhotoTile"
import MediaViewerModal from "@tappler/shared/src/components/MediaViewer/MediaViewerModal"
import VideoThumbnail from "@tappler/shared/src/components/MediaViewer/VideoThumbnail"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import useProSubscriptions from "hooks/useProSubscriptions"
import FastImage from "react-native-fast-image"
import Video from "react-native-video"

import CloseIcon from "assets/icons/close.svg"
import PlayIcon from "assets/icons/play.svg"
import styles from "./styles"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import FacebookIcon from "assets/icons/facebook-logo.svg"
import InstagramIcon from "assets/icons/instagram.svg"
import LinkedInIcon from "assets/icons/linkedin.svg"
import TikTokIcon from "assets/icons/tiktok.svg"
import WebsiteIcon from "assets/icons/website.svg"
import MessagesWhiteIcon from "assets/icons/messages-white.svg"
import CashIcon from "assets/icons/cash-icon.svg"
import CreditCardIcon from "assets/icons/credit-card-icon.svg"
import { AppFlatList, AppKeyboardAwareScrollView } from "components/scroll"
import { Text, a } from "@tappler/shared/src/ds"

const isVideoMedia = (media: ProWorkPhotoType) =>
  (media.mimeType ?? "").startsWith("video")

// Returns null for a video with no poster rather than falling through to the
// video's own url: FastImage cannot decode an mp4, so that fallback rendered a
// blank tile with nothing but the play badge on it. Videos uploaded since
// posters were added always have one; only older rows land here.
const thumbnailUri = (media: ProWorkPhotoType) =>
  isVideoMedia(media) ? media.posterUrl || null : workPhotoTileUri(media)

type Props = RootStackScreenProps<"ProProfileScreen">

const ProProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId, serviceCategoryId, serviceCategories: passedServiceCategories, chatJobId, foodMenu } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const scrollY = useSharedValue(0)
  const [viewerVisible, setViewerVisible] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const carouselRef = useRef<ICarouselInstance>(null)

  const { data: pro, isLoading } = useGetProProfileQuery({ proId, serviceCategoryId })
  const [openChat] = useLazyOpenChatQuery()

  const handleMessage = async () => {
    try {
      const chat = await openChat({
        categoryId: serviceCategoryId,
        recipientId: proId,
        ...(chatJobId && { jobId: chatJobId }),
      }).unwrap()
      navigation.goBack()
      setTimeout(() => {
        navigation.navigate("MessagesDetailsScreen", {
          chatPreview: { chat, notReadMessages: 0 },
        })
      }, 300)
    } catch (e) {}
  }

  // A menu service shows its approved screen name (the kitchen's name); with
  // none approved, today's business / registered name.
  const displayName =
    pro?.serviceScreenName ||
    (pro?.proType === "company" ? pro?.businessName : pro?.registeredName)
  const isCompany = pro?.proType === "company"
  const overallScore = pro?.reviewScore?.overallScore || 0
  const reviewsCount = pro?.reviewScore?.reviewsCount || 0
  const proServiceCat = passedServiceCategories?.[0] || pro?.serviceCategories?.[0]
  // Already scoped by the backend to this service and to approved items only.
  const workPhotos = useMemo(() => pro?.workPhotos ?? [], [pro?.workPhotos])

  const mediaItems = useMemo(
    () =>
      workPhotos.map((media) => ({
        type: (isVideoMedia(media) ? "video" : "photo") as "photo" | "video",
        uri: media.url,
      })),
    [workPhotos]
  )
  const isFeatured = proServiceCat?.isFeatured
  const { featureSubscription, promoLine, trustDocs } = useProSubscriptions({
    subscriptions: proServiceCat?.subscriptions,
    documents: pro?.documents,
  })
  const featuredUri = isAr
    ? featureSubscription?.product?.pictureAr
    : featureSubscription?.product?.pictureEn

  const closeViewStyle = useMemo(() => {
    return { top: insets.top || 35, zIndex: 10 }
  }, [insets])

  const [scrolledPastPhoto, setScrolledPastPhoto] = useState(false)

  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y
    scrollY.value = y
    const pastPhoto = y > 240
    if (pastPhoto !== scrolledPastPhoto) setScrolledPastPhoto(pastPhoto)
  }

  const animatedStyle = useAnimatedStyle(() => {
    const heightPercent = interpolate(scrollY.value, [240, 280], [0, 1])
    return {
      maxHeight: heightPercent <= 0 ? 0 : heightPercent * 160,
    }
  })

  const renderSocialIcon = (type: string) => {
    switch (type) {
      case "facebook":
        return <FacebookIcon />
      case "instagram":
        return <InstagramIcon />
      case "linkedin":
        return <LinkedInIcon />
      case "tiktok":
        return <TikTokIcon />
      case "website":
        return <WebsiteIcon />
      default:
        return null
    }
  }

  const handleGoBack = () => {
    navigation.goBack()
  }

  if (isLoading || !pro) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]} edges={["bottom"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={scrolledPastPhoto ? "dark-content" : "light-content"}
      />

      {/* Animated header — fades in when scrolled past photo */}
      <Animated.View
        style={[a.absolute, a.w_full, styles.animated, a.overflow_hidden, styles.headerZIndex, animatedStyle]}
      >
        <Animated.View
          style={[a.pb_12, a.px_16, { paddingTop: (insets.top || 35) + 4 }]}
        >
          <DmView style={[a.flex_row, a.items_center]}>
            <DmView
              style={[
                styles.iconWrap,
                a.items_center,
                a.justify_center,
                a.mr_12,
              ]}
              onPress={handleGoBack}
            >
              <CloseIcon fill={colors.red} />
            </DmView>
            <DmView style={a.flex_1}>
              {/* One line here: the name gives way ("...") before the
                  sticker does. */}
              <DmView style={[a.flex_row, a.items_center]}>
                <Text size={16} weight="bold" leading="legacy" style={styles.text} numberOfLines={1}>
                  {displayName}
                </Text>
                {featuredUri && (
                  <DmView style={a.ml_6}>
                    <FeaturedSticker uri={featuredUri} height={14} />
                  </DmView>
                )}
              </DmView>
              <DmView style={[a.flex_row, a.items_center]}>
                <RateComponent
                  rate={overallScore}
                  reviewsCount={reviewsCount}
                  itemSize={12}
                  showFullReviewText
                />
              </DmView>
            </DmView>
          </DmView>
        </Animated.View>
      </Animated.View>

      {/* Close button — overlays photo */}
      <DmView
        style={[a.absolute, a.mt_10, styles.iconWrap2, a.items_center, a.justify_center, closeViewStyle]}
        onPress={handleGoBack}
        hitSlop={HIT_SLOP_DEFAULT}
      >
        <CloseIcon fill={colors.red} />
      </DmView>


      <AppKeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, backgroundColor: colors.white }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Hero photo — absolutely positioned */}
        <DmView style={[a.absolute, a.w_full, styles.heroZIndex, { height: 275 + (insets.top || 0) }]}>
          {pro.profilePhoto ? (
            <CachedImage
              uri={pro.profilePhoto}
              style={styles.fullSize}
              resizeMode="cover"
              withSkeleton
            />
          ) : (
            <DmView style={[a.flex_1, styles.textWrap, a.items_center, a.justify_center]}>
              <Text size={14} weight="bold" leading="legacy" color="tertiary">
                {displayName?.charAt(0)}
              </Text>
            </DmView>
          )}
        </DmView>

        {/* Name + Type + Rating + Featured */}
        <DmView style={[a.px_12, a.py_16, { marginTop: 275 + (insets.top || 0), gap: 10 }]}>
          {/* The sticker rides at the end of the name as part of its text,
              so a name that wraps carries it onto its last line. The
              no-break space keeps it with the last word. */}
          <Text size={22} weight="bold">
            {/* Trimmed: a trailing space would open a line break before the
                no-break space that keeps the sticker with the last word. */}
            {displayName?.trim()}
            {featuredUri && (
              <>
                {"\u00A0"}
                <DmView style={styles.featuredAfterName}>
                  <FeaturedSticker uri={featuredUri} height={18} />
                </DmView>
              </>
            )}
          </Text>

          {/* Type badge */}
          <DmView style={[a.flex_row, a.items_end]}>
            {isCompany ? (
              <BusinessIcon width={16} height={16} />
            ) : (
              <IndividualIcon width={16} height={16} />
            )}
            <Text size={14} style={a.ml_4}>
              {t(isCompany ? "business" : "individual")}
            </Text>
          </DmView>

          <DmView style={[a.flex_row, a.items_center]}>
            <RateComponent
              rate={overallScore}
              reviewsCount={reviewsCount}
              itemSize={14}
              showFullReviewText
            />
          </DmView>

          {/* Trust badges */}
          {trustDocs.length > 0 && (
            <DmView style={[a.flex_row, a.items_center]}>
              {trustDocs.map((doc) => {
                const imageUrl = isAr
                  ? doc.trustDocumentData?.trustProduct?.pictureAr
                  : doc.trustDocumentData?.trustProduct?.pictureEn
                return imageUrl ? (
                  <DmView key={doc.id}>
                    <SvgUriContainer width={180} height={40} uri={imageUrl} />
                  </DmView>
                ) : null
              })}
            </DmView>
          )}

          {/* Promo line */}
          {promoLine && promoLine.promoStickerMessage && (
            <PromoLine promoMessage={promoLine.promoStickerMessage} />
          )}

          {/* OFFERS banner */}
          <OffersSection subscriptions={proServiceCat?.subscriptions || []} />
        </DmView>

        {/* About Me */}
        {!!pro.informationAbout && (
          <DmView style={[styles.boxWrap, a.pb_8, styles.sectionRule, a.mr_16]}>
            <DmView style={styles.box}>
              <Text size={14} weight="semibold">
                {t("about_me")}
              </Text>
              <Text size={13} leading="tight" style={styles.text2}>
                {pro.informationAbout}
              </Text>
            </DmView>
          </DmView>
        )}

        {/* Photos & videos of work — per service, approved only */}
        {workPhotos.length > 0 && (
          <DmView style={[styles.box2, a.pb_20, styles.sectionRule, a.mr_16]}>
            <DmView style={styles.box}>
              <Text size={14} weight="semibold">
                {t("photos_of_work")}
              </Text>
            </DmView>
            <AppFlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingRight: 15 }}
              data={workPhotos}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item, index }) => {
                // Same 4:3 tile as the pro app's galleries: 3 across, the
                // list's 15pt inset and a 10pt gap (ml-[15] on the first,
                // mr-[10] on each). Was a square, which re-cropped the
                // backend's 4:3 thumbnail a second time.
                const tileWidth = workPhotoWidth(3, 15, WORK_PHOTO_GAP)
                const tileHeight = workPhotoHeight(tileWidth)
                const isVideo = isVideoMedia(item)
                return (
                  <DmView
                    style={[
                      a.pt_10,
                      a.mr_10,
                      index === 0 && styles.containerIndex,
                    ]}
                    onPress={() => {
                      setViewerIndex(index)
                      setViewerVisible(true)
                    }}
                  >
                    {thumbnailUri(item) ? (
                      <CachedImage
                        uri={thumbnailUri(item) as string}
                        style={{
                          width: tileWidth,
                          height: tileHeight,
                          borderRadius: WORK_PHOTO_RADIUS,
                        }}
                        resizeMode="cover"
                        withSkeleton
                      />
                    ) : (
                      // No poster (pre-poster uploads): decode a frame on
                      // device, exactly as the pro app's grid does.
                      <VideoThumbnail
                        videoUri={item.url}
                        style={{
                          width: tileWidth,
                          height: tileHeight,
                          borderRadius: WORK_PHOTO_RADIUS,
                        }}
                      />
                    )}
                    {isVideo && (
                      <DmView
                        style={[a.absolute, a.items_center, a.justify_center, { width: tileWidth, height: tileHeight, top: 10 }]}
                        pointerEvents="none"
                      >
                        <PlayIcon width={28} height={28} />
                      </DmView>
                    )}
                  </DmView>
                )
              }}
            />
          </DmView>
        )}

        {/* Working Hours */}
        {pro.hours && pro.hours.length > 0 && (
          <DmView style={[styles.boxWrap2, styles.sectionRule, a.mr_16]}>
            <DmView style={styles.box}>
              <Text size={14} weight="semibold">
                {t("working_hours")}
              </Text>
              {["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => {
                const hour = pro.hours.find((h) => h.dayOfWeek?.toLowerCase() === day)
                const dayAbbr = day.substring(0, 3)
                const openingTime = hour?.openingTime
                  ? format(parse(hour.openingTime, "HH:mm", new Date()), "h:mm a")
                  : undefined
                const closingTime = hour?.closingTime
                  ? format(parse(hour.closingTime, "HH:mm", new Date()), "h:mm a")
                  : undefined
                return (
                  <DmView key={day} style={[a.flex_row, a.items_center, a.pt_10]}>
                    <DmView style={[a.mr_8, styles.box3]} />
                    <DmView style={a.flex_row}>
                      <DmView style={isAr ? styles.textWrapAr : styles.textWrapNotAr}>
                        <Text size={13} leading="tight" numberOfLines={1}>
                          {t(dayAbbr).toUpperCase()}
                        </Text>
                      </DmView>
                      <DmView style={a.pr_10}>
                        <Text size={13} leading="tight">
                          {openingTime && closingTime
                            ? `${openingTime} - ${closingTime}`
                            : t("closed").toUpperCase()}
                        </Text>
                      </DmView>
                    </DmView>
                  </DmView>
                )
              })}
            </DmView>
          </DmView>
        )}

        {/* Payment Methods */}
        {pro.paymentMethods && pro.paymentMethods.length > 0 && (
          <DmView style={[styles.boxWrap3, styles.sectionRule, a.mr_16]}>
            <DmView style={styles.box}>
              <Text size={14} weight="semibold">
                {t("accepted_payments")}
              </Text>
              {pro.paymentMethods.map((method, idx) => (
                <DmView key={idx} style={[a.flex_row, a.items_center, a.pt_10]}>
                  <DmView style={[a.mr_8, styles.box3]} />
                  <Text size={13} leading="tight" style={styles.text3}>
                    {t(method, { defaultValue: method })}
                  </Text>
                </DmView>
              ))}
            </DmView>
          </DmView>
        )}

        {/* Social Media */}
        {pro.socials && pro.socials.length > 0 && (
          <DmView style={[styles.boxWrap3, styles.sectionRule, a.mr_16]}>
            <DmView style={styles.box}>
              <Text size={14} weight="semibold">
                {t("social_media")}
              </Text>
              {pro.socials.map((social) => (
                <DmView key={social.id} style={[a.flex_row, a.items_center, a.pt_10]}>
                  {renderSocialIcon(social.socialMedia)}
                  <Text size={12} leading="loose" family="system" style={a.ml_10} numberOfLines={1}>
                    {social.socialLink}
                  </Text>
                </DmView>
              ))}
            </DmView>
          </DmView>
        )}
      </AppKeyboardAwareScrollView>

      {/* The same viewer the pro app uses, so a gallery reads identically in
          both apps — carousel, thumbnail strip, video playback and all. */}
      <MediaViewerModal
        isVisible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        mediaItems={mediaItems}
        initialIndex={viewerIndex}
      />
    </SafeAreaView>
  )
}

export default ProProfileScreen
