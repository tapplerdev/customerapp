import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import { RootStackScreenProps } from "navigation/types"
import { useLazyGetProsForCategoryQuery, useLazyGetServiceByIdQuery } from "services/api"

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
  const [getServiceById] = useLazyGetServiceByIdQuery()
  const hasNavigated = useRef(false)

  useEffect(() => {
    const { categoryId, serviceId, placeOfService, address } = nextParams
    const skipAddress = placeOfService === "remoteOrOnline" || placeOfService === "fixedLocations"
    const customerAddress = skipAddress ? undefined : address?.coords ? { latitude: address.coords.lat, longitude: address.coords.lon } : undefined

    const minDelay = new Promise((resolve) => setTimeout(resolve, 3000))
    const fetchPros = getPros({ categoryId, placeOfService, customerAddress }).unwrap()
    // Prefetch service data (questions/filters) in parallel — cached by RTK Query for ProsListingScreen
    getServiceById(serviceId)

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
