import React, { useMemo, useRef, useState } from "react"
import { Dimensions, FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, StatusBar, TouchableOpacity } from "react-native"
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { parse, format } from "date-fns"
import { BlurView } from "@react-native-community/blur"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetProProfileQuery, useLazyOpenChatQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import RateComponent from "components/RateComponent/RateComponent"
import OffersSection from "components/OffersSection/OffersSection"
import PromoLine from "components/PromoLine/PromoLine"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import CachedImage from "@tappler/shared/src/components/CachedImage"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import useProSubscriptions from "hooks/useProSubscriptions"
import FastImage from "react-native-fast-image"

import CloseIcon from "assets/icons/close.svg"
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

type Props = RootStackScreenProps<"ProProfileScreen">

const ProProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId, serviceCategoryId, serviceCategories: passedServiceCategories, chatJobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const scrollY = useSharedValue(0)
  const SCREEN_WIDTH = Dimensions.get("window").width
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

  const displayName = pro?.proType === "company" ? pro?.businessName : pro?.registeredName
  const isCompany = pro?.proType === "company"
  const overallScore = pro?.reviewScore?.overallScore || 0
  const reviewsCount = pro?.reviewScore?.reviewsCount || 0
  const proServiceCat = passedServiceCategories?.[0] || pro?.serviceCategories?.[0]
  const isFeatured = proServiceCat?.isFeatured
  const { featureSubscription, promoLine, trustDocs } = useProSubscriptions({
    subscriptions: proServiceCat?.subscriptions,
    documents: pro?.documents,
  })

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
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={scrolledPastPhoto ? "dark-content" : "light-content"}
      />

      {/* Animated header — fades in when scrolled past photo */}
      <Animated.View
        style={[styles.headerZIndex, animatedStyle]}
        className="absolute w-full bg-white border-b-0.3 border-grey2 overflow-hidden"
      >
        <Animated.View
          style={[{ paddingTop: (insets.top || 35) + 4 }]}
          className="pb-[12] px-[16]"
        >
          <DmView className="flex-row items-center">
            <DmView
              className="w-[28] h-[28] rounded-full bg-white items-center justify-center mr-[12]"
              onPress={handleGoBack}
            >
              <CloseIcon fill={colors.red} />
            </DmView>
            <DmView className="flex-1">
              <DmText className="text-16 font-custom700" numberOfLines={1}>
                {displayName}
              </DmText>
              <DmView className="flex-row items-center">
                <RateComponent
                  rate={overallScore}
                  reviewsCount={reviewsCount}
                  itemSize={12}
                  showFullReviewText
                />
                {featureSubscription && (
                  <DmView style={styles.featuredMarginLeft}>
                    <SvgUriContainer
                      width={120}
                      height={30}
                      uri={isAr ? featureSubscription.product?.pictureAr : featureSubscription.product?.pictureEn}
                    />
                  </DmView>
                )}
              </DmView>
            </DmView>
          </DmView>
        </Animated.View>
      </Animated.View>

      {/* Close button — overlays photo */}
      <DmView
        className="absolute mt-[10] left-[18] w-[28] h-[28] rounded-full bg-white items-center justify-center"
        style={closeViewStyle}
        onPress={handleGoBack}
        hitSlop={HIT_SLOP_DEFAULT}
      >
        <CloseIcon fill={colors.red} />
      </DmView>


      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, backgroundColor: colors.white }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Hero photo — absolutely positioned */}
        <DmView style={[styles.heroZIndex, { height: 275 + (insets.top || 0) }]} className="absolute w-full">
          {pro.profilePhoto ? (
            <CachedImage
              uri={pro.profilePhoto}
              style={styles.fullSize}
              resizeMode="cover"
            />
          ) : (
            <DmView className="flex-1 bg-grey8 items-center justify-center">
              <DmText className="text-40 font-custom700 text-grey3">
                {displayName?.charAt(0)}
              </DmText>
            </DmView>
          )}
        </DmView>

        {/* Name + Type + Rating + Featured */}
        <DmView style={{ marginTop: 275 + (insets.top || 0), gap: 10 }} className="px-[12] py-[16]">
          <DmText className="text-22 leading-[29px] font-custom700">
            {displayName}
          </DmText>

          {/* Type badge */}
          <DmView className="flex-row items-end">
            {isCompany ? (
              <BusinessIcon width={16} height={16} />
            ) : (
              <IndividualIcon width={16} height={16} />
            )}
            <DmText className="ml-[4] text-14 leading-[18px] font-custom400">
              {t(isCompany ? "business" : "individual")}
            </DmText>
          </DmView>

          <DmView className="flex-row items-center">
            <RateComponent
              rate={overallScore}
              reviewsCount={reviewsCount}
              itemSize={14}
              showFullReviewText
            />
            {featureSubscription && (
              <DmView style={styles.featuredMarginLeft}>
                <SvgUriContainer
                  width={120}
                  height={30}
                  uri={isAr ? featureSubscription.product?.pictureAr : featureSubscription.product?.pictureEn}
                />
              </DmView>
            )}
          </DmView>

          {/* Trust badges */}
          {trustDocs.length > 0 && (
            <DmView className="flex-row items-center">
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
          <DmView className="pt-[11] pb-[8] border-t-1 border-grey53 mr-[16]">
            <DmView className="pl-[15] pr-[19]">
              <DmText className="text-14 leading-[18px] font-custom600">
                {t("about_me")}
              </DmText>
              <DmText className="mt-[11] text-13 leading-[16px] font-custom400">
                {pro.informationAbout}
              </DmText>
            </DmView>
          </DmView>
        )}

        {/* Photos of Work */}
        {pro.photosOfWork && pro.photosOfWork.length > 0 && (
          <DmView className="pt-[15] pb-[20] border-t-1 border-grey53 mr-[16]">
            <DmView className="pl-[15] pr-[19]">
              <DmText className="text-14 leading-[18px] font-custom600">
                {t("photos_of_work")}
              </DmText>
            </DmView>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingRight: 15 }}
              data={pro.photosOfWork}
              keyExtractor={(item, index) => item || String(index)}
              renderItem={({ item: url, index }) => {
                const imageSize = (SCREEN_WIDTH - 50) / 3
                return (
                  <DmView
                    className={`pt-[10] mr-[10] ${index === 0 ? "ml-[15]" : ""}`}
                    onPress={() => {
                      setViewerIndex(index)
                      setViewerVisible(true)
                    }}
                  >
                    <FastImage
                      source={{ uri: url }}
                      style={{ width: imageSize, height: imageSize, borderRadius: 3 }}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  </DmView>
                )
              }}
            />
          </DmView>
        )}

        {/* Working Hours */}
        {pro.hours && pro.hours.length > 0 && (
          <DmView className="py-[17] border-t-1 border-grey53 mr-[16]">
            <DmView className="pl-[15] pr-[19]">
              <DmText className="text-14 leading-[18px] font-custom600">
                {t("working_hours")}
              </DmText>
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
                  <DmView key={day} className="flex-row items-center pt-[10]">
                    <DmView className="mr-[8] w-[8] h-[8] rounded-full bg-red" />
                    <DmView className="flex-row">
                      <DmView className={isAr ? "w-[60]" : "w-[45]"}>
                        <DmText className="text-13 leading-[16px] font-custom400" numberOfLines={1}>
                          {t(dayAbbr).toUpperCase()}
                        </DmText>
                      </DmView>
                      <DmView className="pr-[10]">
                        <DmText className="text-13 leading-[16px] font-custom400">
                          {openingTime && closingTime
                            ? `${openingTime} - ${closingTime}`
                            : t("closed").toUpperCase()}
                        </DmText>
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
          <DmView className="pt-[15] pb-[13] border-t-1 border-grey53 mr-[16]">
            <DmView className="pl-[15] pr-[19]">
              <DmText className="text-14 leading-[18px] font-custom600">
                {t("accepted_payments")}
              </DmText>
              {pro.paymentMethods.map((method, idx) => (
                <DmView key={idx} className="flex-row items-center pt-[10]">
                  <DmView className="mr-[8] w-[8] h-[8] rounded-full bg-red" />
                  <DmText className="text-13 leading-[16px] font-custom400 capitalize">
                    {t(method)}
                  </DmText>
                </DmView>
              ))}
            </DmView>
          </DmView>
        )}

        {/* Social Media */}
        {pro.socials && pro.socials.length > 0 && (
          <DmView className="pt-[15] pb-[13] border-t-1 border-grey53 mr-[16]">
            <DmView className="pl-[15] pr-[19]">
              <DmText className="text-14 leading-[18px] font-custom600">
                {t("social_media")}
              </DmText>
              {pro.socials.map((social) => (
                <DmView key={social.id} className="flex-row items-center pt-[10]">
                  {renderSocialIcon(social.socialMedia)}
                  <DmText className="ml-[10] text-12 leading-[20px] font-plain" numberOfLines={1}>
                    {social.socialLink}
                  </DmText>
                </DmView>
              ))}
            </DmView>
          </DmView>
        )}
      </KeyboardAwareScrollView>

      {/* Photo viewer modal */}
      {pro.photosOfWork && pro.photosOfWork.length > 0 && (
        <Modal
          visible={viewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerVisible(false)}
        >
          <DmView className="flex-1" style={styles.modalOverlay}>
            <DmView
              className="absolute z-10 mt-[10] left-[18] w-[28] h-[28] rounded-full bg-white items-center justify-center"
              style={{ top: insets.top || 35 }}
              onPress={() => setViewerVisible(false)}
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon fill={colors.red} />
            </DmView>

            <DmView className="flex-1 justify-center" style={{ paddingTop: insets.top }}>
              <Carousel
                ref={carouselRef}
                width={SCREEN_WIDTH}
                height={SCREEN_WIDTH}
                data={pro.photosOfWork}
                defaultIndex={viewerIndex}
                onSnapToItem={(index) => setViewerIndex(index)}
                loop={false}
                renderItem={({ item: url }) => (
                  <CachedImage
                    uri={url}
                    style={styles.fullSize}
                    resizeMode="cover"
                  />
                )}
              />
            </DmView>

            <DmView
              className="absolute left-0 right-0 items-center justify-center"
              style={{ bottom: insets.bottom + 20 }}
            >
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={pro.photosOfWork}
                keyExtractor={(item, index) => item || String(index)}
                contentContainerStyle={{ paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexGrow: 1 }}
                renderItem={({ item: url, index: idx }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setViewerIndex(idx)
                      carouselRef.current?.scrollTo({ index: idx, animated: true })
                    }}
                    style={[
                      styles.thumbnailBase,
                      { borderColor: idx === viewerIndex ? "#fff" : "transparent" },
                    ]}
                  >
                    <CachedImage
                      uri={url}
                      style={styles.thumbnailSize}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              />
            </DmView>
          </DmView>
        </Modal>
      )}

      {/* FAB — pinned to bottom-right of screen */}
      {!!serviceCategoryId && (
        <DmView
          onPress={handleMessage}
          className="absolute w-[52] h-[52] rounded-full bg-red items-center justify-center"
          style={[styles.floatingButton, {
            bottom: (insets.bottom || 0) + 16,
            [isAr ? "left" : "right"]: 18,
          }]}
        >
          <MessagesWhiteIcon width={22} height={22} />
        </DmView>
      )}
    </SafeAreaView>
  )
}

export default ProProfileScreen
