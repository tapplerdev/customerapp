import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, TextInput } from "react-native"
import Slider from "@react-native-community/slider"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { QuestionOptionType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import CloseIcon from "assets/icons/close.svg"

export type FilterValues = {
  proType?: string
  distanceKm?: number
  minRating?: number
  maxResponseTimeHours?: number
  creditCardPayment?: boolean
}

type Props = RootStackScreenProps<"FiltersScreen">

const FiltersScreen: React.FC<Props> = ({ route, navigation }) => {
  const { currentPlaceOfService, initialFilters, refinementFilters, initialRefinementOptionIds, onApply } = route.params
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const [refinementOptionIds, setRefinementOptionIds] = useState<number[]>(initialRefinementOptionIds ?? [])
  const [proType, setProType] = useState<string | undefined>(initialFilters?.proType)
  const [distanceKm, setDistanceKm] = useState(initialFilters?.distanceKm ?? 50)
  const [distanceInput, setDistanceInput] = useState(String(initialFilters?.distanceKm ?? 50))
  const [minRating, setMinRating] = useState<number | undefined>(initialFilters?.minRating)
  const [maxResponseTimeHours, setMaxResponseTimeHours] = useState<number | undefined>(initialFilters?.maxResponseTimeHours)
  const [creditCardPayment, setCreditCardPayment] = useState(initialFilters?.creditCardPayment || false)

  // Keep the typed distance box in sync with the slider; clamp to 1–50 on edit
  useEffect(() => {
    setDistanceInput(String(distanceKm))
  }, [distanceKm])

  const commitDistance = (text: string) => {
    const n = parseInt(text, 10)
    setDistanceKm(isNaN(n) ? 1 : Math.min(50, Math.max(1, n)))
  }

  const isPhysical =
    currentPlaceOfService === "proToCustomer" ||
    currentPlaceOfService === "customerToPro" ||
    currentPlaceOfService === "delivery" ||
    currentPlaceOfService === "fixedLocations"

  const toggleRefinementOption = (optionId: number) => {
    setRefinementOptionIds((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    )
  }

  // Lookup of every refinement option by its filter-option id
  const optionsById = useMemo(() => {
    const map = new Map<number, QuestionOptionType>()
    refinementFilters?.forEach((q) =>
      q.options?.forEach((o) => {
        if (o.serviceCategoryFilterOptionId) map.set(o.serviceCategoryFilterOptionId, o)
      })
    )
    return map
  }, [refinementFilters])

  // Drop selections whose parent (and parent's parent…) isn't also selected — keeps hierarchy consistent
  const effectiveSelectedIds = useMemo(() => {
    const current = new Set(refinementOptionIds)
    let changed = true
    while (changed) {
      changed = false
      current.forEach((id) => {
        const parentKey = optionsById.get(id)?.parentFilterOptionKey
        if (!parentKey) return
        const parentSelected = [...current].some((sid) => optionsById.get(sid)?.filterOptionKey === parentKey)
        if (!parentSelected) {
          current.delete(id)
          changed = true
        }
      })
    }
    return current
  }, [refinementOptionIds, optionsById])

  const selectedKeys = useMemo(() => {
    const keys = new Set<string>()
    effectiveSelectedIds.forEach((id) => {
      const key = optionsById.get(id)?.filterOptionKey
      if (key) keys.add(key)
    })
    return keys
  }, [effectiveSelectedIds, optionsById])

  // A child option only shows once its parent is selected
  const isOptionVisible = (o: QuestionOptionType) =>
    !o.parentFilterOptionKey || selectedKeys.has(o.parentFilterOptionKey)

  const collectFilters = useCallback(() => ({
    proType,
    distanceKm: distanceKm < 50 ? distanceKm : undefined,
    minRating,
    maxResponseTimeHours,
    creditCardPayment: creditCardPayment || undefined,
    refinementFilterOptionIds: [...effectiveSelectedIds],
  }), [proType, distanceKm, minRating, maxResponseTimeHours, creditCardPayment, effectiveSelectedIds])

  const handleShowResults = () => {
    onApply(collectFilters())
    navigation.goBack()
  }

  const handleClose = () => {
    navigation.goBack()
  }

  const handleResetAll = () => {
    setRefinementOptionIds([])
    setProType(undefined)
    setDistanceKm(50)
    setMinRating(undefined)
    setMaxResponseTimeHours(undefined)
    setCreditCardPayment(false)
  }

  const renderChip = (label: string, isSelected: boolean, onPress: () => void, key: string | number = label) => (
    <DmView
      key={key}
      onPress={onPress}
      className="px-[13] py-[7] rounded-5 mr-[8]"
      style={{
        backgroundColor: isSelected ? "#F5F5F5" : colors.white,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? colors.black : "#E0E0E0",
      }}
    >
      <DmText
        className={`text-12 leading-[15px] ${isSelected ? "font-custom700" : "font-custom400"}`}
        style={{ color: isSelected ? colors.black : colors.grey }}
      >
        {label}
      </DmText>
    </DmView>
  )

  const activeCount =
    [proType, distanceKm < 50 ? distanceKm : undefined, minRating, maxResponseTimeHours, creditCardPayment].filter(Boolean).length +
    effectiveSelectedIds.size

  return (
    <SafeAreaView className="flex-1 bg-white" edges={[]}>
      {/* Header */}
      <DmView className="items-center pt-[12] pb-[10] px-[16]">
        <DmView className="flex-row items-center justify-center w-full">
          <DmView className="flex-1">
            <DmView
              onPress={handleClose}
              className="w-[32] h-[32] items-center justify-center"
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={14} height={14} color={colors.black} />
            </DmView>
          </DmView>
          <DmView className="flex-row items-center">
            <DmText className="text-15 leading-[19px] font-custom700 text-black">
              {t("filters")}
            </DmText>
            {activeCount > 0 && (
              <DmView className="ml-[6] w-[18] h-[18] rounded-full bg-black items-center justify-center">
                <DmText className="text-10 font-custom700" style={{ color: colors.white }}>
                  {activeCount}
                </DmText>
              </DmView>
            )}
          </DmView>
          <DmView className="flex-1 items-end">
            <DmView onPress={handleResetAll} hitSlop={HIT_SLOP_DEFAULT}>
              <DmText className="text-13 leading-[16px] font-custom600 text-red">
                {t("reset_all")}
              </DmText>
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      <DmView className="h-[1] bg-grey5" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        bounces={false}
      >
        {/* Service-specific refinement filters (child groups appear once their parent is selected) */}
        {refinementFilters?.map((question) => {
          const visibleOptions = question.options?.filter(
            (o) => !!o.serviceCategoryFilterOptionId && isOptionVisible(o)
          )
          if (!visibleOptions?.length) return null
          return (
            <React.Fragment key={question.id}>
              <DmView className="px-[20] mb-[18]">
                <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                  {isAr && question.textAr ? question.textAr : question.text}
                </DmText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {visibleOptions.map((o) =>
                    renderChip(
                      isAr && o.labelAr ? o.labelAr : o.label,
                      effectiveSelectedIds.has(o.serviceCategoryFilterOptionId!),
                      () => toggleRefinementOption(o.serviceCategoryFilterOptionId!),
                      o.serviceCategoryFilterOptionId!
                    )
                  )}
                </ScrollView>
              </DmView>
              <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />
            </React.Fragment>
          )
        })}

        {/* Pro Type */}
        <DmView className="px-[20] mb-[18]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
            {t("pro_type")}
          </DmText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("pro_type_all"), !proType, () => setProType(undefined))}
            {renderChip(t("individual"), proType === "individual", () =>
              setProType(proType === "individual" ? undefined : "individual")
            )}
            {renderChip(t("business"), proType === "company", () =>
              setProType(proType === "company" ? undefined : "company")
            )}
          </ScrollView>
        </DmView>

        <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />

        {/* Distance — only shown for location-based service types
            (pro-to-customer, customer-to-pro, delivery); hidden for online/fixed */}
        {isPhysical && (
          <>
            <DmView className="px-[20] mb-[18]">
              <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                {t("distance_km")}
              </DmText>
              <Slider
                value={distanceKm}
                onValueChange={(val) => setDistanceKm(Math.round(val))}
                minimumValue={1}
                maximumValue={50}
                step={1}
                minimumTrackTintColor={colors.red}
                maximumTrackTintColor={colors.grey5}
                thumbTintColor={colors.red}
              />
              {/* Editable distance box — type a value or use the slider */}
              <DmView
                className="mt-[14] flex-row items-center px-[14]"
                style={{ alignSelf: "flex-start", minWidth: 120, borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }}
              >
                <TextInput
                  value={distanceInput}
                  onChangeText={setDistanceInput}
                  onEndEditing={() => commitDistance(distanceInput)}
                  onSubmitEditing={() => commitDistance(distanceInput)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  style={{ flex: 1, paddingVertical: 9, fontSize: 13, color: colors.black }}
                />
                <DmText className="text-12 leading-[15px] font-custom500 text-grey3 ml-[6]">
                  km
                </DmText>
              </DmView>
            </DmView>
            <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />
          </>
        )}

        {/* Minimum Rating */}
        <DmView className="px-[20] mb-[18]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
            {t("minimum_rating")}
          </DmText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("any"), !minRating, () => setMinRating(undefined))}
            {renderChip("3+ ★", minRating === 3, () =>
              setMinRating(minRating === 3 ? undefined : 3)
            )}
            {renderChip("4+ ★", minRating === 4, () =>
              setMinRating(minRating === 4 ? undefined : 4)
            )}
            {renderChip("4.5+ ★", minRating === 4.5, () =>
              setMinRating(minRating === 4.5 ? undefined : 4.5)
            )}
          </ScrollView>
        </DmView>

        <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />

        {/* Response Time */}
        <DmView className="px-[20] mb-[18]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
            {t("response_time")}
          </DmText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("any"), !maxResponseTimeHours, () => setMaxResponseTimeHours(undefined))}
            {renderChip(t("under_1_hour"), maxResponseTimeHours === 1, () =>
              setMaxResponseTimeHours(maxResponseTimeHours === 1 ? undefined : 1)
            )}
            {renderChip(t("under_4_hours"), maxResponseTimeHours === 4, () =>
              setMaxResponseTimeHours(maxResponseTimeHours === 4 ? undefined : 4)
            )}
            {renderChip(t("under_24_hours"), maxResponseTimeHours === 24, () =>
              setMaxResponseTimeHours(maxResponseTimeHours === 24 ? undefined : 24)
            )}
          </ScrollView>
        </DmView>

        <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />

        {/* Payment Method */}
        <DmView className="px-[20] mb-[18]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
            {t("payment_method")}
          </DmText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("any"), !creditCardPayment, () => setCreditCardPayment(false))}
            {renderChip(t("credit_card"), creditCardPayment, () => setCreditCardPayment(!creditCardPayment))}
          </ScrollView>
        </DmView>
      </ScrollView>

      {/* Bottom button */}
      <DmView
        className="px-[16] pt-[14] bg-white"
        style={[styles.buttonShadow, { paddingBottom: insets.bottom + 12 }]}
      >
        <ActionBtn
          title={t("show_results")}
          onPress={handleShowResults}
          className="h-[46] rounded-10"
          textClassName="text-14 font-custom600"
        />
      </DmView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default FiltersScreen
