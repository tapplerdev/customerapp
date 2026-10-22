import React, { useCallback } from "react"
import Animated, { FadeIn } from "react-native-reanimated"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DmView } from "@tappler/shared/src/components/UI"

import SearchBar from "components/SearchBar"

import { useGetActivePresetQuery, useGetServicesQuery } from "services/api"
import { RootStackParamList } from "navigation/types"
import { PresetSectionItemType, ServiceType } from "types/cms"

import HomeHeader from "./components/HomeHeader"
import PresetSection from "./components/PresetSection"
import HomeSkeletonScreen from "screens/HomeSkeletonScreen/HomeSkeletonScreen"
import { AppScrollView } from "components/scroll"
import { Text, a as atoms } from "@tappler/shared/src/ds"
import styles from "./styles"

const HomeScreen: React.FC = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { data: preset, isLoading, isError } = useGetActivePresetQuery()
  const { data: servicesData } = useGetServicesQuery()

  const handleItemPress = useCallback((item: PresetSectionItemType) => {
    // Case 1: Main category — look up full service (with categories) from /services
    const presetService = item.services?.[0]
    if (presetService) {
      const fullService = servicesData?.data?.find((s) => s.id === presetService.id)
      if (fullService && fullService.categories?.length) {
        navigation.navigate("SubCategoriesScreen", { service: fullService })
        return
      }
    }

    // Case 2: Direct subcategory item (from "subCategories" dataSource sections)
    const subCategory = item.serviceCategories?.[0]
    if (subCategory) {
      const syntheticService: ServiceType = {
        id: subCategory.serviceId || 0,
        nameEn: subCategory.nameEn,
        nameAr: subCategory.nameAr,
        categories: item.serviceCategories || [],
      }
      navigation.navigate("SubCategoriesScreen", { service: syntheticService })
      return
    }
  }, [navigation, servicesData])

  const sections = preset?.sections
    ?.slice()
    .sort((a, b) => a.order - b.order)

  if (isLoading) {
    return <HomeSkeletonScreen />
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <SafeAreaView edges={["top"]} style={[atoms.flex_1, styles.safeArea]}>
        <HomeHeader />
        <SearchBar
          onPress={() => navigation.navigate("TapplyAIScreen")}
          onFilterPress={() => navigation.navigate("CategoriesScreen")}
        />
        <DmView style={styles.box} />

        {!sections || sections.length === 0 ? (
          <DmView style={[atoms.flex_1, atoms.items_center, atoms.justify_center, atoms.px_40]}>
            <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
              {isError
                ? "Failed to load home content"
                : "No content available yet"}
            </Text>
            <Text size={12} leading="legacy" color="tertiary" align="center" style={atoms.mt_8}>
              {isError
                ? "Please check your connection and try again."
                : "An admin needs to publish an active CMS preset."}
            </Text>
          </DmView>
        ) : (
          <AppScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {sections.map((section) => (
              <PresetSection
                key={section.id}
                section={section}
                isAr={isAr}
                onItemPress={handleItemPress}
              />
            ))}
          </AppScrollView>
        )}
      </SafeAreaView>
    </Animated.View>
  )
}

export default HomeScreen
