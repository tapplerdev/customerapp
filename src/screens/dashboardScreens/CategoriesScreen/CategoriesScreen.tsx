import React, { useCallback, useMemo, useRef, useState } from "react"
import { FlatList, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetServicesQuery } from "services/api"
import { ServiceCategoryType, ServiceType } from "types/cms"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SearchIcon from "assets/icons/search-red.svg"
import CloseIcon from "assets/icons/close.svg"
import { useServiceAddressFlow } from "hooks/useServiceAddressFlow"

type Props = RootStackScreenProps<"CategoriesScreen">

const CategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const fontStyles = takeFontStyles("font-custom400", i18n.language)
  const [searchText, setSearchText] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { openAddressFor, addressModal } = useServiceAddressFlow()

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const searchTerm = debouncedSearch.trim()
  const isSearching = searchTerm.length > 0

  // Search goes to the server (full-text over service + category names and
  // keywords — same contract the pro app uses); the plain list stays on the
  // unfiltered cache. Both subscriptions stay warm so clearing the search is
  // instant and navigation payloads always carry the FULL service object.
  const { data, isLoading, isFetching } = useGetServicesQuery(isSearching ? searchTerm : undefined)
  const { data: allData } = useGetServicesQuery()
  const services = data?.data || []

  // One flat list: matching categories first, then matching subcategories
  type RowItem =
    | { kind: "category"; service: ServiceType }
    | { kind: "subCategory"; category: ServiceCategoryType; parentService: ServiceType }

  const listData = useMemo<RowItem[]>(() => {
    if (!isSearching) {
      return services.map((s) => ({ kind: "category" as const, service: s }))
    }
    const query = searchTerm.toLowerCase()
    const categoryHits = services
      .filter((s) => s.nameEn.toLowerCase().includes(query) || s.nameAr.toLowerCase().includes(query))
      .map((s) => ({ kind: "category" as const, service: s }))
    const subCategoryHits = services.flatMap((s) =>
      (s.categories || [])
        .filter(
          (c) =>
            c.nameEn?.toLowerCase().includes(query) ||
            c.nameAr?.toLowerCase().includes(query) ||
            c.keywords?.toLowerCase().includes(query)
        )
        .map((c) => ({ kind: "subCategory" as const, category: c, parentService: s }))
    )
    return [...categoryHits, ...subCategoryHits]
  }, [services, searchTerm, isSearching])

  const handleServicePress = (service: ServiceType) => {
    navigation.navigate("SubCategoriesScreen", { service })
  }

  const handleSubCategoryPress = (category: ServiceCategoryType, parentService: ServiceType) => {
    // Prefer the full service from the unfiltered cache — the search response
    // may carry a pruned category list.
    const fullService = allData?.data?.find((s) => s.id === parentService.id) ?? parentService
    // Open the address sheet in place — no hop through SubCategoriesScreen.
    openAddressFor(category, fullService)
  }

  const renderItem = ({ item }: { item: RowItem }) => {
    const source = item.kind === "category" ? item.service : item.category
    const name = isAr ? source.nameAr : source.nameEn
    const onPress =
      item.kind === "category"
        ? () => handleServicePress(item.service)
        : () => handleSubCategoryPress(item.category, item.parentService)
    return (
      <DmView onPress={onPress}>
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

  // Skeleton rows shown on initial load and while a search round-trips
  // (ported from the pro app's services search)
  const renderSkeleton = () => (
    <DmView>
      {[60, 45, 70, 50, 65, 55, 72, 48].map((width, i) => (
        <DmView key={i} className="py-[17] px-[19] border-b-1 border-b-grey8">
          <SkeletonLoader width={`${width}%`} height={15} borderRadius={4} />
        </DmView>
      ))}
    </DmView>
  )

  const showSkeleton = (!data && isLoading) || (isSearching && isFetching)


  return (
    // No entering animation on the screen ROOT. The native stack is already
    // animating this screen in, and a reanimated `entering` applies its initial
    // style on the UI thread before React commits the subtree's layout — so for
    // a frame the header rendered at the container's origin, on top of itself,
    // then snapped down. The inner FadeIn below is fine: it sits under a header
    // whose position has already settled, and it earns its keep by re-fading
    // the results on every query.
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

      {/* Content: skeleton while loading/searching, results fade in per query */}
      {showSkeleton ? (
        renderSkeleton()
      ) : (
        // key still resets the list per query; the FadeIn that used to be
        // here is gone. It was the remaining source of the rows appearing over
        // the search bar on entry — same race as the root wrapper, one level
        // down: reanimated applies the entering style before React commits
        // this subtree's layout, so on first mount the rows drew at the
        // container origin and then dropped.
        <DmView key={isSearching ? searchTerm : "all"} style={{ flex: 1 }}>
          <FlatList
            data={listData}
            renderItem={renderItem}
            keyExtractor={(item) =>
              item.kind === "category" ? `c-${item.service.id}` : `s-${item.category.id}`
            }
            keyboardShouldPersistTaps="handled"
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
        </DmView>
      )}
      {addressModal}
    </SafeAreaView>
  )
}

export default CategoriesScreen
