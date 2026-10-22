import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { ServiceCategoryType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { useServiceAddressFlow } from "hooks/useServiceAddressFlow"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import { AppFlatList } from "components/scroll"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
        <DmView style={[a.flex_row, a.items_center, a.justify_between, styles.row]}>
          <Text size={12} weight="medium" leading="legacy" style={a.flex_1}>
            {name}
          </Text>
          <ChevronRightIcon
            width={16}
            height={16}
            color={colors.black}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.mr_16, a.border_b_1, styles.box]} />
      </DmView>
    )
  }

  const serviceName = isAr ? service.nameAr : service.nameEn

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_20, styles.row2, a.pb_20]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {serviceName}
          </Text>
        </DmView>
        <DmView style={styles.box2} />
      </DmView>
      <DmView style={styles.box3} />

      {/* Subcategories list */}
      <AppFlatList
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
