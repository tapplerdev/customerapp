import React from "react"
import { FlatList } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { ServiceCategoryType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { useServiceAddressFlow } from "hooks/useServiceAddressFlow"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"

type Props = RootStackScreenProps<"SubCategoriesScreen">

const SubCategoriesScreen: React.FC<Props> = ({ route, navigation }) => {
  const { service } = route.params
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  // The whole "pick an address for this category → go to results" flow (modal,
  // proceed, PickAddress/MySavedAddresses return-listeners) lives in the hook
  // so CategoriesScreen can open the same sheet in place.
  const { openAddressFor, addressModal } = useServiceAddressFlow()

  const handleGoBack = () => navigation.goBack()

  const renderItem = ({ item }: { item: ServiceCategoryType }) => {
    const name = isAr ? item.nameAr : item.nameEn
    return (
      <DmView onPress={() => openAddressFor(item, service)}>
        <DmView className="flex-row items-center justify-between px-[19] py-[17]">
          <DmText className="flex-1 text-12 font-custom500 text-black leading-[15]">
            {name}
          </DmText>
          <ChevronRightIcon
            width={16}
            height={16}
            color={colors.black}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="mr-[16] border-b-1 border-grey8" />
      </DmView>
    )
  }

  const serviceName = isAr ? service.nameAr : service.nameEn

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[20] pt-[17] pb-[20]">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black leading-[19]">
            {serviceName}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[1] bg-grey4" />

      {/* Subcategories list */}
      <FlatList
        data={service.categories}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
      />

      {addressModal}
    </SafeAreaView>
  )
}

export default SubCategoriesScreen
