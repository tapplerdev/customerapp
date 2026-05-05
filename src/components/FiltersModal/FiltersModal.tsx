import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, ScrollView, StyleSheet } from "react-native"
import Slider from "@react-native-community/slider"
import {
  BottomSheetModal,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet"
import { FullWindowOverlay } from "react-native-screens"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

import CloseIcon from "assets/icons/close.svg"
import RentangleChecBoxCheckedIcon from "@tappler/shared/src/assets/icons/rentangle-checkbox-checked.svg"

export type FilterValues = {
  proType?: string
  distanceKm?: number
  minRating?: number
  maxResponseTimeHours?: number
  creditCardPayment?: boolean
}

interface FiltersModalProps {
  isVisible: boolean
  currentPlaceOfService?: string
  initialFilters?: FilterValues
  onDismiss: (filters: FilterValues) => void
}

const FiltersModal: React.FC<FiltersModalProps> = ({
  isVisible,
  currentPlaceOfService,
  initialFilters,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const modalRef = useRef<BottomSheetModal>(null)

  const snapPoints = useMemo(() => ["92%"], [])

  const [proType, setProType] = useState<string | undefined>(initialFilters?.proType)
  const [distanceKm, setDistanceKm] = useState(initialFilters?.distanceKm ?? 50)
  const [minRating, setMinRating] = useState<number | undefined>(initialFilters?.minRating)
  const [maxResponseTimeHours, setMaxResponseTimeHours] = useState<number | undefined>(initialFilters?.maxResponseTimeHours)
  const [creditCardPayment, setCreditCardPayment] = useState(initialFilters?.creditCardPayment || false)

  useEffect(() => {
    if (isVisible) {
      modalRef.current?.present()
    }
  }, [isVisible])

  useEffect(() => {
    if (initialFilters) {
      setProType(initialFilters.proType)
      setDistanceKm(initialFilters.distanceKm ?? 50)
      setMinRating(initialFilters.minRating)
      setMaxResponseTimeHours(initialFilters.maxResponseTimeHours)
      setCreditCardPayment(initialFilters.creditCardPayment || false)
    }
  }, [initialFilters])

  const isPhysical =
    currentPlaceOfService === "proToCustomer" ||
    currentPlaceOfService === "customerToPro" ||
    currentPlaceOfService === "delivery"

  const collectFilters = useCallback((): FilterValues => ({
    proType,
    distanceKm: distanceKm < 50 ? distanceKm : undefined,
    minRating,
    maxResponseTimeHours,
    creditCardPayment: creditCardPayment || undefined,
  }), [proType, distanceKm, minRating, maxResponseTimeHours, creditCardPayment])

  const handleShowResults = () => {
    onDismiss(collectFilters())
    modalRef.current?.dismiss()
  }

  const handleDismiss = useCallback(() => {
    onDismiss(collectFilters())
  }, [onDismiss, collectFilters])

  const handleClose = () => {
    modalRef.current?.dismiss()
  }

  const handleResetAll = () => {
    setProType(undefined)
    setDistanceKm(50)
    setMinRating(undefined)
    setMaxResponseTimeHours(undefined)
    setCreditCardPayment(false)
  }

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  )

  const renderContainerComponent = useCallback(
    (props: any) =>
      Platform.OS === "ios" ? (
        <FullWindowOverlay>{props.children}</FullWindowOverlay>
      ) : (
        props.children
      ),
    []
  )

  const renderChip = (label: string, isSelected: boolean, onPress: () => void) => (
    <DmView
      key={label}
      onPress={onPress}
      className={`flex-row items-center px-[14] py-[8] rounded-full mr-[8] border ${
        isSelected ? "bg-red border-red" : "bg-white border-grey5"
      }`}
    >
      {isSelected && (
        <DmView className="mr-[6]">
          <RentangleChecBoxCheckedIcon width={16} height={16} />
        </DmView>
      )}
      <DmText
        className={`text-13 leading-[16px] font-custom500 ${
          isSelected ? "text-white" : "text-black"
        }`}
      >
        {label}
      </DmText>
    </DmView>
  )

  // Count active filters
  const activeCount = [proType, distanceKm < 50 ? distanceKm : undefined, minRating, maxResponseTimeHours, creditCardPayment].filter(Boolean).length

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      containerComponent={renderContainerComponent}
      onDismiss={handleDismiss}
      handleComponent={null}
      backgroundStyle={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
    >
      {/* Header */}
      <DmView className="items-center pt-[16] pb-[12] px-[20]">
        <DmView className="flex-row items-center justify-center w-full">
          <DmView className="flex-1">
            <DmView
              onPress={handleClose}
              className="w-[32] h-[32] items-center justify-center"
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={16} height={16} color={colors.black} />
            </DmView>
          </DmView>
          <DmView className="flex-row items-center">
            <DmText className="text-14 leading-[18px] font-custom600 text-black">
              {t("filters")}
            </DmText>
            {activeCount > 0 && (
              <DmView className="ml-[6] w-[20] h-[20] rounded-full bg-red items-center justify-center">
                <DmText className="text-10 font-custom600 text-white">{activeCount}</DmText>
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
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}
        bounces={false}
      >
        {/* Pro Type */}
        <DmView className="px-[24] mb-[24]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[12]">
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

        <DmView className="mx-[24] h-[1] bg-grey5 mb-[24]" />

        {/* Distance */}
        <DmView className="px-[24] mb-[24]" style={!isPhysical ? { opacity: 0.4 } : undefined}>
          <DmView className="flex-row items-center justify-between mb-[12]">
            <DmText className="text-15 leading-[19px] font-custom700 text-black">
              {t("distance_km")}
            </DmText>
            {isPhysical ? (
              <DmText className="text-14 leading-[18px] font-custom600 text-red">
                {distanceKm} km
              </DmText>
            ) : (
              <DmText className="text-11 leading-[14px] font-custom400 text-grey3">
                {t("select_place_of_service_first")}
              </DmText>
            )}
          </DmView>
          <Slider
            value={distanceKm}
            onValueChange={(val) => setDistanceKm(Math.round(val))}
            minimumValue={1}
            maximumValue={50}
            step={1}
            minimumTrackTintColor={isPhysical ? colors.red : colors.grey5}
            maximumTrackTintColor={colors.grey5}
            thumbTintColor={isPhysical ? colors.red : colors.grey5}
            disabled={!isPhysical}
          />
        </DmView>
        <DmView className="mx-[24] h-[1] bg-grey5 mb-[24]" />

        {/* Minimum Rating */}
        <DmView className="px-[24] mb-[24]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[12]">
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

        <DmView className="mx-[24] h-[1] bg-grey5 mb-[24]" />

        {/* Response Time */}
        <DmView className="px-[24] mb-[24]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[12]">
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

        <DmView className="mx-[24] h-[1] bg-grey5 mb-[24]" />

        {/* Payment Method */}
        <DmView className="px-[24] mb-[24]">
          <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[12]">
            {t("payment_method")}
          </DmText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderChip(t("any"), !creditCardPayment, () => setCreditCardPayment(false))}
            {renderChip(t("credit_card"), creditCardPayment, () => setCreditCardPayment(!creditCardPayment))}
          </ScrollView>
        </DmView>
      </ScrollView>

      {/* Bottom button area */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[modalStyles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={t("show_results")}
          onPress={handleShowResults}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>
    </BottomSheetModal>
  )
}

const modalStyles = StyleSheet.create({
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default FiltersModal
