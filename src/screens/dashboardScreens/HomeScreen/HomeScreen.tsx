import React, { useCallback } from "react"
import { ScrollView } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import SearchBar from "components/SearchBar"

import { useGetActivePresetQuery, useGetServicesQuery } from "services/api"
import { RootStackParamList } from "navigation/types"
import { PresetSectionItemType, ServiceType } from "types/cms"

import HomeHeader from "./components/HomeHeader"
import PresetSection from "./components/PresetSection"
import HomeSkeletonScreen from "screens/HomeSkeletonScreen/HomeSkeletonScreen"

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
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <HomeHeader />
        <SearchBar onFilterPress={() => navigation.navigate("CategoriesScreen")} />
        <DmView className="h-[12]" />

        {!sections || sections.length === 0 ? (
          <DmView className="flex-1 items-center justify-center px-[40]">
            <DmText className="text-16 font-custom600 text-grey3 text-center">
              {isError
                ? "Failed to load home content"
                : "No content available yet"}
            </DmText>
            <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
              {isError
                ? "Please check your connection and try again."
                : "An admin needs to publish an active CMS preset."}
            </DmText>
          </DmView>
        ) : (
          <ScrollView
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
          </ScrollView>
        )}
      </SafeAreaView>
    </Animated.View>
  )
}

export default HomeScreen
