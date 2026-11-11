import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import FastImage from "react-native-fast-image"

import { RootStackScreenProps } from "navigation/types"
import {
  useLazyGetProsForCategoryQuery,
  useLazyGetServiceByIdQuery,
} from "services/api"
import { collectProStickerUrls, prefetchSvgs } from "services/svgCache"
import { offeredPlaceOfService } from "utils/placeOfService"
import { listingPlace, pickedVenue } from "utils/fixedLocation"

import LogoIconEn from "assets/icons/logo-en.svg"
import LogoIconAr from "assets/icons/logo-ar.svg"
import searchAnimation from "assets/animations/search-animation.json"
import styles from "./styles"

type Props = RootStackScreenProps<"SearchAnimationScreen">

const SearchAnimationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { nextParams } = route.params
  const { i18n } = useTranslation()
  const LogoIcon = i18n.language === "ar" ? LogoIconAr : LogoIconEn
  const [getPros] = useLazyGetProsForCategoryQuery()
  const [getService] = useLazyGetServiceByIdQuery()
  const hasNavigated = useRef(false)

  useEffect(() => {
    const { categoryId, serviceId, placeOfService, address } = nextParams

    const minDelay = new Promise((resolve) => setTimeout(resolve, 3000))
    // AWAIT the service payload too — it decides isFoodCategory (hasMenu), so
    // the listing must have it BEFORE it renders. Otherwise food cards flash as
    // normal pros (registered name, no screen name / distance / capability
    // badges, "Select me" button) until it loads. Cache-served instantly on
    // repeat searches; only the first search pays the fetch (well under 3s).
    const fetchService = getService(serviceId, true)
      .unwrap()
      .catch(() => null)
    // A seeded place of service (Repost, Find other pros: the old job's) is
    // checked against the category before anything is fetched with it: one
    // staff have since taken off the category lists nobody and is never
    // asked again (utils/placeOfService). Only a seed waits for the service;
    // a fresh search fetches both side by side, as before.
    // The old job's venue (a fixed-location request) is kept only while the
    // category still lists it, and only with its place (utils/fixedLocation).
    const listingParams = placeOfService
      ? fetchService.then((service) => {
          const category = service?.categories?.find((c) => c.id === categoryId)
          const place = offeredPlaceOfService(placeOfService, category)
          return {
            ...nextParams,
            placeOfService: place,
            fixedLocationId: category
              ? pickedVenue(nextParams.fixedLocationId, place, category)
              : nextParams.fixedLocationId,
          }
        })
      : Promise.resolve(nextParams)

    // Once the pros payload lands, warm the FIRST screen's artwork inside the
    // animation window so cards arrive fully dressed (no sticker pop-in):
    // sticker/trust SVGs into svgCache (awaited, capped so a slow CDN can't
    // hold the lottie hostage) + first photos into FastImage's disk cache
    // (fire-and-forget — preload has no completion signal).
    const fetchPros = listingParams.then((params) => {
      // A fixed location only with its venue, never with the address; online
      // without the address (utils/fixedLocation). A repost of a job with no
      // venue used to send fixedLocations alone, which the server refuses.
      return getPros({
        categoryId,
        ...listingPlace({
          placeOfService: params.placeOfService,
          fixedLocationId: params.fixedLocationId,
          coords: address?.coords,
        }),
      })
        .unwrap()
        .then((res) => {
          const pros = res?.data ?? []
          pros.slice(0, 6).forEach((p) => {
            const photos = [p.profilePhoto150, p.profilePhoto].filter(
              Boolean
            ) as string[]
            if (photos.length) FastImage.preload(photos.map((uri) => ({ uri })))
          })
          const svgWarm = prefetchSvgs(
            collectProStickerUrls(pros, i18n.language === "ar", 6)
          )
          const cap = new Promise((resolve) => setTimeout(resolve, 1200))
          return Promise.race([svgWarm, cap])
        })
    })

    // Only while this screen is still on top: a replace without a target
    // replaces whatever IS on top, so after a back (Android's button; the iOS
    // swipe is off for this route) it would swap out the screen underneath.
    // The listing gets the checked place of service, whatever happened to the
    // pros (listingParams itself never fails: a failed service keeps the seed).
    const goToListing = () =>
      listingParams.then((params) => {
        if (hasNavigated.current || !navigation.isFocused()) return
        hasNavigated.current = true
        navigation.replace("ProsListingScreen", params)
      })
    Promise.all([minDelay, fetchPros, fetchService])
      .then(goToListing)
      .catch(goToListing)
  }, [])

  return (
    <View style={styles.container}>
      <LottieView
        source={searchAnimation}
        autoPlay
        loop
        style={styles.lottieSize}
      />

      {/* Tappler logo at bottom */}
      <View style={styles.logoPosition}>
        <LogoIcon width={120} height={25} />
      </View>
    </View>
  )
}

export default SearchAnimationScreen
