import React, { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { StyleSheet, TextInput } from "react-native"
import type { ScrollView } from "react-native"
import Slider from "@react-native-community/slider"
import RangeSlider from "components/RangeSlider/RangeSlider"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { FiltersParams } from "navigation/types"
import { QuestionOptionType, ServiceQuestionType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"
import { useFullSheetHeight } from "@tappler/shared/src/components/NativeSheet/useFullSheetHeight"
import { useKeyboardInset } from "@tappler/shared/src/hooks/useKeyboardInset"

import CloseIcon from "assets/icons/close.svg"
import TickIcon from "assets/icons/tick.svg"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

export type FilterValues = {
  proType?: string
  distanceKm?: number
  minRating?: number
  maxResponseTimeHours?: number
  creditCardPayment?: boolean
}

type ContentProps = FiltersParams & { onClose: () => void; scrollRef: React.RefObject<ScrollView | null> }

// All filter state & UI. Only ever rendered inside FiltersSheet below — the
// split is left in place because the content is long enough to want its own
// unit, and because the sheet wrapper owns the height hook.
const FiltersContent: React.FC<ContentProps> = ({
  scrollRef,
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
  const keyboardInset = useKeyboardInset()
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
      style={[dsStyles.container, a.mr_8, a.flex_row, a.items_center, {
        backgroundColor: isSelected ? "#F5F5F5" : colors.white,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? colors.black : "#E0E0E0",
      }]}
    >
      {isSelected && (
        <TickIcon width={12} height={12} color={colors.black} style={{ marginRight: 5 }} />
      )}
      <Text
        size={12}
        weight={isSelected ? "bold" : "regular"}
        leading="tight"
        style={{ color: isSelected ? colors.black : colors.grey }}
      >
        {label}
      </Text>
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
    /*
      The keyboard inset goes on the OUTER container, not the ScrollView's
      contentContainerStyle, because the "Show results" footer is a sibling
      AFTER the ScrollView and nothing inside the scroll content can move it.
      Padding here shrinks the scroller and lifts the footer in one move.

      iOS only — see useKeyboardInset. Three number-pad fields live in here
      (the two range bounds and distance), and a number pad has no Return key,
      so before this the primary action of the sheet was simply unreachable
      until you guessed to tap elsewhere.
    */
    <SafeAreaView
      edges={[]}
      style={[a.flex_1, dsStyles.safeArea, { paddingBottom: keyboardInset }]}
    >
      {/* Header */}
      <DmView style={[a.items_center, a.pt_12, a.pb_10, a.px_16]}>
        <DmView style={[a.flex_row, a.items_center, a.justify_center, a.w_full]}>
          <DmView style={a.flex_1}>
            <DmView
              onPress={handleClose}
              style={[dsStyles.iconWrap, a.items_center, a.justify_center]}
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={14} height={14} color={colors.black} />
            </DmView>
          </DmView>
          <DmView style={[a.flex_row, a.items_center]}>
            <Text size={15} weight="bold" leading="tight">
              {t("filters")}
            </Text>
            {activeCount > 0 && (
              <DmView style={[a.ml_6, dsStyles.textWrap, a.items_center, a.justify_center]}>
                <Text size={10} weight="bold" leading="legacy" style={{ color: colors.white }}>
                  {activeCount}
                </Text>
              </DmView>
            )}
          </DmView>
          <DmView style={[a.flex_1, a.items_end]}>
            <DmView onPress={handleResetAll} hitSlop={HIT_SLOP_DEFAULT}>
              <Text size={13} weight="semibold" leading="tight" color="brand">
                {t("reset_all")}
              </Text>
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      <DmView style={dsStyles.box} />

      <AppScrollView
        ref={scrollRef}
        style={a.flex_1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Food: fulfillment mode (moved here from the results header) */}
        {isFoodCategory && (
          <>
            <DmView style={[a.px_20, a.mb_18]}>
              <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
                {t("fulfillment")}
              </Text>
              <DmView style={a.flex_row}>
                {(["all", "delivery", "pickup"] as const).map((mode) =>
                  renderChip(t(mode), fulfillment === mode, () => setFulfillment(mode), mode)
                )}
              </DmView>
            </DmView>
            <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />
          </>
        )}

        {/* Locked context: filters answered upfront (read-only here; they drive the cascade below) */}
        {upfrontSelections?.map((sel, idx) => (
          <React.Fragment key={`upfront-${idx}`}>
            <DmView style={[a.px_20, a.mb_18]}>
              <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
                {isAr && sel.questionTextAr ? sel.questionTextAr : sel.questionText}
                <Text size={11} leading={{ fixed: px(22) }} style={{ color: colors.grey }}> · {t("chosen_earlier")}</Text>
              </Text>
              <DmView style={[a.flex_row, a.flex_wrap]}>
                {sel.options.map((o) => (
                  <DmView
                    key={o.key}
                    style={[dsStyles.container, a.mr_8, a.mb_8, { backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: "#E0E0E0" }]}
                  >
                    <Text size={12} weight="semibold" leading="tight" style={{ color: colors.grey }}>
                      {isAr && o.labelAr ? o.labelAr : o.label}
                    </Text>
                  </DmView>
                ))}
              </DmView>
            </DmView>
            <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />
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
                <DmView style={[a.px_20, a.mb_18]}>
                  <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
                    {filterTitle(question)}
                  </Text>
                  <DmView style={[a.flex_row, a.items_center]}>
                    <DmView
                      style={[a.flex_1, a.px_14, { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }]}
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
                    <Text size={13} leading="legacy" color="tertiary" family="system" style={a.mx_10}>–</Text>
                    <DmView
                      style={[a.flex_1, a.px_14, { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }]}
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
                    <DmView style={[a.mt_18, a.px_4]}>
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
                <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />
              </React.Fragment>
            )
          }

          const visibleOptions = question.options?.filter(
            (o) => !!o.serviceCategoryFilterOptionId && isOptionVisible(o)
          )
          if (!visibleOptions?.length) return null
          return (
            <React.Fragment key={question.id}>
              <DmView style={[a.px_20, a.mb_18]}>
                <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
                  {filterTitle(question)}
                </Text>
                <AppScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {visibleOptions.map((o) =>
                    renderChip(
                      isAr && o.labelAr ? o.labelAr : o.label,
                      effectiveSelectedIds.has(o.serviceCategoryFilterOptionId!),
                      () => toggleRefinementOption(o.serviceCategoryFilterOptionId!, question),
                      o.serviceCategoryFilterOptionId!
                    )
                  )}
                </AppScrollView>
              </DmView>
              <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />
            </React.Fragment>
          )
        })}

        {/* Pro Type */}
        <DmView style={[a.px_20, a.mb_18]}>
          <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
            {t("pro_type")}
          </Text>
          <AppScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("pro_type_all"), !proType, () => setProType(undefined))}
            {renderChip(t("individual"), proType === "individual", () =>
              setProType(proType === "individual" ? undefined : "individual")
            )}
            {renderChip(t("business"), proType === "company", () =>
              setProType(proType === "company" ? undefined : "company")
            )}
          </AppScrollView>
        </DmView>

        <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />

        {/* Distance — only shown for location-based service types
            (pro-to-customer, customer-to-pro, delivery); hidden for online/fixed */}
        {isPhysical && (
          <>
            <DmView style={[a.px_20, a.mb_18]}>
              <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
                {t("distance_km")}
              </Text>
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
                style={[a.mt_14, a.flex_row, a.items_center, a.px_14, { alignSelf: "flex-start", minWidth: 120, borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 10 }]}
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
                <Text size={12} weight="medium" leading="tight" color="tertiary" style={a.ml_6}>
                  km
                </Text>
              </DmView>
            </DmView>
            <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />
          </>
        )}

        {/* Minimum Rating */}
        <DmView style={[a.px_20, a.mb_18]}>
          <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
            {t("minimum_rating")}
          </Text>
          <AppScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          </AppScrollView>
        </DmView>

        <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />

        {/* Response Time */}
        <DmView style={[a.px_20, a.mb_18]}>
          <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
            {t("response_time")}
          </Text>
          <AppScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          </AppScrollView>
        </DmView>

        <DmView style={[a.mx_20, dsStyles.box, a.mb_18]} />

        {/* Payment Method */}
        <DmView style={[a.px_20, a.mb_18]}>
          <Text size={15} weight="bold" leading="tight" style={a.mb_10}>
            {t("payment_method")}
          </Text>
          <AppScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("any"), !creditCardPayment, () => setCreditCardPayment(false))}
            {renderChip(t("credit_card"), creditCardPayment, () => setCreditCardPayment(!creditCardPayment))}
          </AppScrollView>
        </DmView>
      </AppScrollView>

      {/* Bottom button */}
      <DmView
        style={[a.px_16, a.pt_14, dsStyles.safeArea, styles.buttonShadow, { paddingBottom: insets.bottom + 12 }]}
      >
        <Button
          title={t("show_results")}
          onPress={handleShowResults}
          size={px(46)}
          shape="r10"
          label={14}
          labelWeight="semibold"
          labelLeading="legacy"
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

/**
 * The filters, inside the native push-back sheet — both platforms.
 * `contentKey` should change on every open so the filter state re-seeds from
 * the freshly passed initial values.
 *
 * There used to be an Android-only `FiltersScreen` route here as well, because
 * NativePushBackSheet once returned null on Android. It doesn't any more, and
 * a second presentation meant two code paths, a function in navigation state
 * (`onApply`) and a route that looked like a full-screen page next to iOS's
 * sheet. The file keeps its name; nothing here is a screen.
 */
export const FiltersSheet: React.FC<
  FiltersParams & { visible: boolean; contentKey: number; onClose: () => void }
> = ({ visible, contentKey, onClose, ...contentProps }) => {
  const scrollRef = useRef<ScrollView>(null)
  const fullSheetHeight = useFullSheetHeight()

  return (
    <NativeSheet
      visible={visible}
      height={fullSheetHeight}
      scrollableRef={scrollRef}
      onDismissed={onClose}
    >
      <FiltersContent key={contentKey} {...contentProps} onClose={onClose} scrollRef={scrollRef} />
    </NativeSheet>
  )
}
