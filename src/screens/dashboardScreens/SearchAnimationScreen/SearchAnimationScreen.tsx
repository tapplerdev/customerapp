import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import FastImage from "react-native-fast-image"

import { RootStackScreenProps } from "navigation/types"
import { api, useLazyGetProsForCategoryQuery } from "services/api"
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
  const prefetchService = api.usePrefetch("getServiceById")
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
    // Prefetch service data (questions/filters) in parallel — cached by RTK Query
    // for ProsListingScreen. ifOlderThan bounds staleness: fresh cache (<2min) is
    // served instantly (no heavy re-download per search), older data refetches
    // (getServiceById has no invalidation tags, so age is the only freshness).
    prefetchService(serviceId, { ifOlderThan: 120 })

    Promise.all([minDelay, fetchPros]).then(() => {
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
