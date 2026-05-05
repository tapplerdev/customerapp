import React, { useCallback, useMemo, useRef, useState } from "react"
import { FlatList, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import Animated, { FadeIn } from "react-native-reanimated"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetServicesQuery } from "services/api"
import { ServiceType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SearchIcon from "assets/icons/search-red.svg"
import CloseIcon from "assets/icons/close.svg"

type Props = RootStackScreenProps<"CategoriesScreen">

const CategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const fontStyles = takeFontStyles("font-custom400", i18n.language)
  const [searchText, setSearchText] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const { data, isLoading } = useGetServicesQuery()
  const services = data?.data || []

  const filteredServices = useMemo(() => {
    if (!debouncedSearch.trim()) return services
    const query = debouncedSearch.toLowerCase()
    return services.filter((s) =>
      s.nameEn.toLowerCase().includes(query) ||
      s.nameAr.includes(query)
    )
  }, [services, debouncedSearch])

  const handleServicePress = (service: ServiceType) => {
    navigation.navigate("SubCategoriesScreen", { service })
  }

  const renderItem = ({ item }: { item: ServiceType }) => {
    const name = isAr ? item.nameAr : item.nameEn
    return (
      <DmView onPress={() => handleServicePress(item)}>
        <DmView className="flex-row items-center px-[19] py-[17]">
          <DmText className="flex-1 text-12 leading-[15px] font-custom500 text-black">
            {name}
          </DmText>
          <ChevronLeftIcon
            width={16}
            height={16}
            color={colors.black}
            style={isAr ? undefined : { transform: [{ rotate: "180deg" }] }}
          />
        </DmView>
        <DmView className="mr-[16] border-b-1 border-grey8" />
      </DmView>
    )
  }


  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[12] py-[10]">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView
          className="flex-1 flex-row items-center mx-[8] h-[42] bg-white rounded-full px-[14]"
          style={{
            borderWidth: 1,
            borderColor: "#E0E0E0",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <SearchIcon width={14} height={14} />
          <TextInput
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder={t("search_for_a_service")}
            placeholderTextColor={colors.grey3}
            style={[fontStyles, { flex: 1, marginHorizontal: 8, fontSize: 14, color: colors.black, textAlign: isAr ? "right" : "left", padding: 0 }]}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <DmView
              onPress={() => {
                setSearchText("")
                setDebouncedSearch("")
              }}
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={12} height={12} fill={colors.grey3} />
            </DmView>
          )}
        </DmView>
      </DmView>
      <DmView className="h-[0.5] bg-grey4" />

      {/* Content */}
      <FlatList
        data={filteredServices}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        getItemLayout={(_, index) => ({ length: 50, offset: 50 * index, index })}
        ListEmptyComponent={
          <DmView className="flex-1 items-center justify-center pt-[80]">
            <DmText className="text-14 font-custom500 text-grey3">
              {t("no_results_found")}
            </DmText>
          </DmView>
        }
      />
    </SafeAreaView>
    </Animated.View>
  )
}

export default CategoriesScreen
