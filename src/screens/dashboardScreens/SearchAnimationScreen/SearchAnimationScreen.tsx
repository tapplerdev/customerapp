import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import FastImage from "react-native-fast-image"

import { RootStackScreenProps } from "navigation/types"
import { useLazyGetProsForCategoryQuery, useLazyGetServiceByIdQuery } from "services/api"
import { collectProStickerUrls, prefetchSvgs } from "services/svgCache"

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
    const skipAddress = placeOfService === "remoteOrOnline" || placeOfService === "fixedLocations"
    const customerAddress = skipAddress ? undefined : address?.coords ? { latitude: address.coords.lat, longitude: address.coords.lon } : undefined

    const minDelay = new Promise((resolve) => setTimeout(resolve, 3000))
    // Once the pros payload lands, warm the FIRST screen's artwork inside the
    // animation window so cards arrive fully dressed (no sticker pop-in):
    // sticker/trust SVGs into svgCache (awaited, capped so a slow CDN can't
    // hold the lottie hostage) + first photos into FastImage's disk cache
    // (fire-and-forget — preload has no completion signal).
    const fetchPros = getPros({ categoryId, placeOfService, customerAddress })
      .unwrap()
      .then((res) => {
        const pros = res?.data ?? []
        pros.slice(0, 6).forEach((p) => {
          const photos = [p.profilePhoto150, p.profilePhoto].filter(Boolean) as string[]
          if (photos.length) FastImage.preload(photos.map((uri) => ({ uri })))
        })
        const svgWarm = prefetchSvgs(
          collectProStickerUrls(pros, i18n.language === "ar", 6)
        )
        const cap = new Promise((resolve) => setTimeout(resolve, 1200))
        return Promise.race([svgWarm, cap])
      })
    // AWAIT the service payload too — it decides isFoodCategory (hasMenu), so
    // the listing must have it BEFORE it renders. Otherwise food cards flash as
    // normal pros (registered name, no screen name / distance / capability
    // badges, "Select me" button) until it loads. Cache-served instantly on
    // repeat searches; only the first search pays the fetch (well under 3s).
    const fetchService = getService(serviceId, true).unwrap().catch(() => null)

    Promise.all([minDelay, fetchPros, fetchService]).then(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true
        navigation.replace("ProsListingScreen", nextParams)
      }
    }).catch(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true
        navigation.replace("ProsListingScreen", nextParams)
      }
    })
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
