import React, { useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useCreateJobMutation, useGetProMenuQuery } from "services/api"
import { useTypedSelector } from "store"
import {
  cartLineTotal,
  clearCart,
  computeOrderTotals,
  emptyDraft,
  formatMoney,
  selectDraft,
} from "store/cart/slice"
import ErrorModal from "components/ErrorModal"
import OrderLocationMap from "components/OrderLocationMap/OrderLocationMap"

import styles from "./styles"

type Props = RootStackScreenProps<"FoodOrderReviewScreen">

// Last look before committing. Checkout gathers and validates; this screen
// confirms and commits — which is why the built payload arrives as a param
// rather than this screen re-deriving it from scratch. It is plain JSON, so it
// crosses the navigation boundary without a serialisation warning.
const FoodOrderReviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    proId,
    payload,
    isPickup,
    whereLabel,
    whereValue,
    whenValue,
    paymentLabel,
    mapCoords,
  } = route.params

  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  const cartState = useTypedSelector((state) => state.cart)
  const cart = selectDraft(cartState, proId, Date.now()) ?? emptyDraft(proId)

  const [createJob] = useCreateJobMutation()
  const [isSubmitting, setSubmitting] = useState(false)
  const [isErrorVisible, setErrorVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
    { skip: !cart.serviceCategoryId }
  )

  // Same helper checkout used, so the number approved here is the number sent.
  const { subtotal, deliveryFee, orderDiscount, total } = useMemo(
    () => computeOrderTotals(cart.items, menu, isPickup),
    [cart.items, menu, isPickup]
  )

  const handleSubmitOrder = async () => {
    if (isSubmitting) return

    try {
      setSubmitting(true)
      await createJob(payload).unwrap()
      const successAddress = cart.address ?? undefined
      dispatch(clearCart(proId))
      navigation.navigate("RequestSuccessScreen", { address: successAddress })
    } catch (error: any) {
      const validationErrors = error?.data?.validationErrors
      const message = validationErrors
        ? Object.values(validationErrors).flat().join(", ")
        : error?.data?.message || t("an_error_occurred")
      setErrorMessage(String(message))
      setErrorVisible(true)
    } finally {
      setSubmitting(false)
    }
  }

  const block = (label: string, value?: string | null) =>
    !!value && (
      <DmView className="mt-[18]">
        <DmText className="text-14 leading-[18px] font-custom700">
          {label}
        </DmText>
        <DmText className="mt-[4] text-13 leading-[18px] font-custom400">
          {value}
        </DmText>
      </DmView>
    )

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView className="flex-row items-center justify-between mt-[8]">
      <DmText
        className={`text-13 leading-[17px] ${bold ? "font-custom700" : "font-custom400"}`}
      >
        {label}
      </DmText>
      <DmText
        className={`text-13 leading-[17px] ${bold ? "font-custom700" : "font-custom400"}`}
      >
        {value}
      </DmText>
    </DmView>
  )

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Same header as checkout, so the flow does not change shape mid-way */}
      <DmView className="flex-row items-center px-[12] py-[10] bg-white border-b-0.2 border-b-grey19">
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
        <DmView className="flex-1 items-center">
          <DmText className="text-16 leading-[20px] font-custom700">
            {cart.categoryName}
          </DmText>
          {!!cart.proName && (
            <DmText className="mt-[2] text-12 leading-[15px] font-custom400 text-grey2">
              {cart.proName}
            </DmText>
          )}
        </DmView>
        <DmView className="w-[32]" />
      </DmView>

      <ScrollView
        className="flex-1 px-[16]"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <DmText className="mt-[16] text-16 leading-[20px] font-custom700 text-red text-center">
          {t("review_order")}
        </DmText>

        {block(
          whereLabel,
          // Never let the destination vanish: block() hides on an empty string,
          // and whereValue is "" while the pro profile is still loading or when
          // a saved address has no street line.
          whereValue || t(isPickup ? "pickup_area_unavailable" : "choose_address")
        )}

        {/* The same "where" one line up, drawn: a pin on the address the
            customer chose, or the pro's area outlined for a pickup. */}
        <OrderLocationMap
          coords={mapCoords}
          isPickup={isPickup}
          className="mt-[10]"
        />
        {block(t(isPickup ? "pickup_time" : "delivery_time"), whenValue)}
        {block(t("payment_method"), paymentLabel)}
        {block(t("order_notes"), cart.orderNotes)}

        <DmView className="mt-[18]">
          <DmText className="text-14 leading-[18px] font-custom700">
            {t("ordered_items")}
          </DmText>

          {cart.items.map((line) => (
            <DmView key={line.uid} className="mt-[10]">
              <DmView className="flex-row justify-between">
                <DmText className="flex-1 pr-[10] text-13 leading-[18px] font-custom500">
                  {line.quantity}×  {line.name}
                </DmText>
                <DmText className="text-13 leading-[18px] font-custom400">
                  {formatMoney(cartLineTotal(line))} {t("EGP")}
                </DmText>
              </DmView>

              {/* Chosen options sit under their line, unpriced — their cost is
                  already inside the line total above. */}
              {(line.selectedOptions ?? []).flatMap((option) =>
                option.choices.map((choice) => (
                  <DmText
                    key={`${line.uid}-${option.optionName}-${choice.name}`}
                    className="mt-[2] ml-[16] text-12 leading-[16px] font-custom400 text-grey2"
                  >
                    {choice.name}
                  </DmText>
                ))
              )}
            </DmView>
          ))}

          <DmView className="h-[0.7] bg-grey14 mt-[14]" />
          {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
          {!isPickup &&
            totalsRow(
              t("delivery_fee"),
              deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
            )}
          {orderDiscount > 0 &&
            totalsRow(
              t("discount"),
              `-${formatMoney(orderDiscount)} ${t("EGP")}`
            )}
          {totalsRow(t("order_total"), `${formatMoney(total)} ${t("EGP")}`, true)}
        </DmView>
      </ScrollView>

      <DmView
        className="px-[16] pt-[14] bg-white"
        style={[styles.footerShadow, { paddingBottom: insets.bottom + 12 }]}
      >
        <ActionBtn
          title={t("submit_order")}
          className="h-[48]"
          textClassName="text-15 leading-[19px] font-custom600"
          disable={isSubmitting || !cart.items.length}
          isLoading={isSubmitting}
          onPress={handleSubmitOrder}
        />
      </DmView>

      <ErrorModal
        isVisible={isErrorVisible}
        onClose={() => setErrorVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default FoodOrderReviewScreen
