import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, TextInput } from "react-native"
import Slider from "@react-native-community/slider"
import RangeSlider from "components/RangeSlider/RangeSlider"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackParamList, RootStackScreenProps } from "navigation/types"
import { QuestionOptionType, ServiceQuestionType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import NativePushBackSheet, {
  FULL_SHEET_HEIGHT,
} from "components/NativePushBackSheet/NativePushBackSheet"

import CloseIcon from "assets/icons/close.svg"
import TickIcon from "assets/icons/tick.svg"

export type FilterValues = {
  proType?: string
  distanceKm?: number
  minRating?: number
  maxResponseTimeHours?: number
  creditCardPayment?: boolean
}

type FiltersParams = RootStackParamList["FiltersScreen"]
type ContentProps = FiltersParams & { onClose: () => void }
type Props = RootStackScreenProps<"FiltersScreen">

// All filter state & UI. Presentation-agnostic: rendered full-screen by the
// FiltersScreen route (Android) or inside the native push-back sheet (iOS).
const FiltersContent: React.FC<ContentProps> = ({
  currentPlaceOfService,
  isFoodCategory,
  foodMode,
  initialFilters,
  refinementFilters,
  initialRefinementOptionIds,
  initialRanges,
  upfrontSelections,
  onApply,
  onClose,
}) => {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  // Filters answered upfront (e.g. Make) act as locked cascade parents for the modal's children (e.g. Model)
  const upfrontKeys = useMemo(
    () => new Set((upfrontSelections ?? []).flatMap((s) => s.options.map((o) => o.key))),
    [upfrontSelections]
  )

  const [refinementOptionIds, setRefinementOptionIds] = useState<number[]>(initialRefinementOptionIds ?? [])
  const [rangeValues, setRangeValues] = useState<Record<number, { min?: number; max?: number }>>(() =>
    Object.fromEntries((initialRanges ?? []).map((r) => [r.filterId, { min: r.min, max: r.max }]))
  )
  const [proType, setProType] = useState<string | undefined>(initialFilters?.proType)
  const [distanceKm, setDistanceKm] = useState(initialFilters?.distanceKm ?? 50)
  const [distanceInput, setDistanceInput] = useState(String(initialFilters?.distanceKm ?? 50))
  const [minRating, setMinRating] = useState<number | undefined>(initialFilters?.minRating)
  const [maxResponseTimeHours, setMaxResponseTimeHours] = useState<number | undefined>(initialFilters?.maxResponseTimeHours)
  const [creditCardPayment, setCreditCardPayment] = useState(initialFilters?.creditCardPayment || false)
  // Food only: fulfillment mode lives here now (moved out of the results header)
  const [fulfillment, setFulfillment] = useState<"all" | "delivery" | "pickup">(foodMode ?? "all")

  // Keep the typed distance box in sync with the slider; clamp to 1–50 on edit
  useEffect(() => {
    setDistanceInput(String(distanceKm))
  }, [distanceKm])

  const commitDistance = (text: string) => {
    const n = parseInt(text, 10)
    setDistanceKm(isNaN(n) ? 1 : Math.min(50, Math.max(1, n)))
  }

  const isPhysical =
    !!isFoodCategory ||
    currentPlaceOfService === "proToCustomer" ||
    currentPlaceOfService === "customerToPro" ||
    currentPlaceOfService === "delivery" ||
    currentPlaceOfService === "fixedLocations"

  const toggleRefinementOption = (optionId: number, question: ServiceQuestionType) => {
    setRefinementOptionIds((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId)
      }
      // Single-select filters (oneChoice) replace any other pick within the same question
      if (question.type === "oneChoice") {
        const siblingIds = (question.options ?? [])
          .map((o) => o.serviceCategoryFilterOptionId)
          .filter((id): id is number => id != null)
        return [...prev.filter((id) => !siblingIds.includes(id)), optionId]
      }
      return [...prev, optionId]
    })
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
        const parentSelected =
          upfrontKeys.has(parentKey) ||
          [...current].some((sid) => optionsById.get(sid)?.filterOptionKey === parentKey)
        if (!parentSelected) {
          current.delete(id)
          changed = true
        }
      })
    }
    return current
  }, [refinementOptionIds, optionsById, upfrontKeys])

  const selectedKeys = useMemo(() => {
    const keys = new Set<string>(upfrontKeys)
    effectiveSelectedIds.forEach((id) => {
      const key = optionsById.get(id)?.filterOptionKey
      if (key) keys.add(key)
    })
    return keys
  }, [effectiveSelectedIds, optionsById, upfrontKeys])

  // A child option only shows once its parent is selected
  const isOptionVisible = (o: QuestionOptionType) =>
    !o.parentFilterOptionKey || selectedKeys.has(o.parentFilterOptionKey)

  const setRangeBound = (filterId: number, bound: "min" | "max", text: string) => {
    const n = parseInt(text, 10)
    setRangeValues((prev) => ({
      ...prev,
      [filterId]: { ...prev[filterId], [bound]: isNaN(n) ? undefined : n },
    }))
  }

  const activeRanges = Object.entries(rangeValues)
    .map(([filterId, v]) => ({ filterId: Number(filterId), min: v.min, max: v.max }))
    .filter((r) => r.min != null || r.max != null)

  const collectFilters = useCallback(() => ({
    proType,
    distanceKm: distanceKm < 50 ? distanceKm : undefined,
    minRating,
    maxResponseTimeHours,
    creditCardPayment: creditCardPayment || undefined,
    refinementFilterOptionIds: [...effectiveSelectedIds],
    ranges: activeRanges,
    ...(isFoodCategory && { fulfillment }),
  }), [proType, distanceKm, minRating, maxResponseTimeHours, creditCardPayment, effectiveSelectedIds, activeRanges, isFoodCategory, fulfillment])

  const handleShowResults = () => {
    onApply(collectFilters())
    onClose()
  }

  const handleClose = () => {
    onClose()
  }

  const handleResetAll = () => {
    setRefinementOptionIds([])
    setRangeValues({})
    setProType(undefined)
    setDistanceKm(50)
    setMinRating(undefined)
    setMaxResponseTimeHours(undefined)
    setCreditCardPayment(false)
    setFulfillment("all")
  }

  const renderChip = (
    label: string,
    isSelected: boolean,
    onPress: () => void,
    key: string | number = label
  ) => (
    <DmView
      key={key}
      onPress={onPress}
      className="px-[13] py-[7] rounded-5 mr-[8] flex-row items-center"
      style={{
        backgroundColor: isSelected ? "#F5F5F5" : colors.white,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? colors.black : "#E0E0E0",
      }}
    >
      {isSelected && (
        <TickIcon width={12} height={12} color={colors.black} style={{ marginRight: 5 }} />
      )}
      <DmText
        className={`text-12 leading-[15px] ${isSelected ? "font-custom700" : "font-custom400"}`}
        style={{ color: isSelected ? colors.black : colors.grey }}
      >
        {label}
      </DmText>
    </DmView>
  )

  // Food's filter questions are pro-phrased ("I make food from…"); show the
  // neutral admin filter name (e.g. "Cuisines") to the customer instead.
  const filterTitle = (question: ServiceQuestionType) =>
    isFoodCategory && question.filter?.label
      ? isAr && question.filter.labelAr
        ? question.filter.labelAr
        : question.filter.label
      : isAr && question.textAr
        ? question.textAr
        : question.text

  const activeCount =
    [proType, distanceKm < 50 ? distanceKm : undefined, minRating, maxResponseTimeHours, creditCardPayment].filter(Boolean).length +
    effectiveSelectedIds.size +
    activeRanges.length

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
        {/* Food: fulfillment mode (moved here from the results header) */}
        {isFoodCategory && (
          <>
            <DmView className="px-[20] mb-[18]">
              <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                {t("fulfillment")}
              </DmText>
              <DmView className="flex-row">
                {(["all", "delivery", "pickup"] as const).map((mode) =>
                  renderChip(t(mode), fulfillment === mode, () => setFulfillment(mode), mode)
                )}
              </DmView>
            </DmView>
            <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />
          </>
        )}

        {/* Locked context: filters answered upfront (read-only here; they drive the cascade below) */}
        {upfrontSelections?.map((sel, idx) => (
          <React.Fragment key={`upfront-${idx}`}>
            <DmView className="px-[20] mb-[18]">
              <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                {isAr && sel.questionTextAr ? sel.questionTextAr : sel.questionText}
                <DmText className="font-custom400" style={{ fontSize: 11, color: colors.grey }}> · {t("chosen_earlier")}</DmText>
              </DmText>
              <DmView className="flex-row flex-wrap">
                {sel.options.map((o) => (
                  <DmView
                    key={o.key}
                    className="px-[13] py-[7] rounded-5 mr-[8] mb-[8]"
                    style={{ backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: "#E0E0E0" }}
                  >
                    <DmText className="leading-[15px] font-custom600" style={{ fontSize: 12, color: colors.grey }}>
                      {isAr && o.labelAr ? o.labelAr : o.label}
                    </DmText>
                  </DmView>
                ))}
              </DmView>
            </DmView>
            <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />
          </React.Fragment>
        ))}

        {/* Service-specific refinement filters (child groups appear once their parent is selected) */}
        {refinementFilters?.map((question) => {
          // Range filters render From/To inputs instead of chips
          if (question.filter?.valueType === "range") {
            const filterId = question.filter.id
            const range = rangeValues[filterId] ?? {}
            const boundMin = Number(question.filter.minValue)
            const boundMax = Number(question.filter.maxValue)
            const hasBounds =
              Number.isFinite(boundMin) &&
              Number.isFinite(boundMax) &&
              boundMax > boundMin
            return (
              <React.Fragment key={question.id}>
                <DmView className="px-[20] mb-[18]">
                  <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                    {filterTitle(question)}
                  </DmText>
                  <DmView className="flex-row items-center">
                    <DmView
                      className="flex-1 px-[14]"
                      style={{ borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }}
                    >
                      <TextInput
                        value={range.min != null ? String(range.min) : ""}
                        onChangeText={(text) => setRangeBound(filterId, "min", text)}
                        placeholder={question.filter.minValue != null ? String(question.filter.minValue) : ""}
                        keyboardType="number-pad"
                        maxLength={7}
                        style={{ paddingVertical: 9, fontSize: 13, color: colors.black }}
                      />
                    </DmView>
                    <DmText className="mx-[10] text-13 text-grey3">–</DmText>
                    <DmView
                      className="flex-1 px-[14]"
                      style={{ borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }}
                    >
                      <TextInput
                        value={range.max != null ? String(range.max) : ""}
                        onChangeText={(text) => setRangeBound(filterId, "max", text)}
                        placeholder={question.filter.maxValue != null ? String(question.filter.maxValue) : ""}
                        keyboardType="number-pad"
                        maxLength={7}
                        style={{ paddingVertical: 9, fontSize: 13, color: colors.black }}
                      />
                    </DmView>
                  </DmView>
                  {hasBounds && (
                    <DmView className="mt-[18] px-[4]">
                      <RangeSlider
                        min={boundMin}
                        max={boundMax}
                        low={range.min ?? boundMin}
                        high={range.max ?? boundMax}
                        onChange={(low, high) => {
                          setRangeBound(filterId, "min", String(low))
                          setRangeBound(filterId, "max", String(high))
                        }}
                        color={colors.black}
                      />
                    </DmView>
                  )}
                </DmView>
                <DmView className="mx-[20] h-[1] bg-grey5 mb-[18]" />
              </React.Fragment>
            )
          }

          const visibleOptions = question.options?.filter(
            (o) => !!o.serviceCategoryFilterOptionId && isOptionVisible(o)
          )
          if (!visibleOptions?.length) return null
          return (
            <React.Fragment key={question.id}>
              <DmView className="px-[20] mb-[18]">
                <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[10]">
                  {filterTitle(question)}
                </DmText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {visibleOptions.map((o) =>
                    renderChip(
                      isAr && o.labelAr ? o.labelAr : o.label,
                      effectiveSelectedIds.has(o.serviceCategoryFilterOptionId!),
                      () => toggleRefinementOption(o.serviceCategoryFilterOptionId!, question),
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
                minimumTrackTintColor={colors.black}
                maximumTrackTintColor={colors.grey5}
                thumbTintColor={colors.black}
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

// Matches the native clamp (sheet height caps at 90% of the container) so
// the JS-laid-out content and the presented frame agree exactly.

/**
 * iOS presentation: the filters inside the native push-back sheet (screen
 * behind recedes). `contentKey` should change on every open so the filter
 * state re-seeds from the freshly passed initial values.
 */
export const FiltersSheet: React.FC<
  FiltersParams & { visible: boolean; contentKey: number; onClose: () => void }
> = ({ visible, contentKey, onClose, ...contentProps }) => (
  <NativePushBackSheet visible={visible} height={FULL_SHEET_HEIGHT} onDismissed={onClose}>
    <FiltersContent key={contentKey} {...contentProps} onClose={onClose} />
  </NativePushBackSheet>
)

// Android (and fallback) presentation: plain navigation route.
const FiltersScreen: React.FC<Props> = ({ route, navigation }) => (
  <FiltersContent {...route.params} onClose={() => navigation.goBack()} />
)

export default FiltersScreen
