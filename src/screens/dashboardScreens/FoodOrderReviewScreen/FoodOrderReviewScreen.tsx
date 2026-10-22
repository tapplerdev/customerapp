import React, { useMemo, useState } from "react"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"

import { DmView } from "@tappler/shared/src/components/UI"
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
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

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
      const successAddress = cartState.address ?? undefined
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
      <DmView style={a.mt_18}>
        <Text size={14} weight="bold">
          {label}
        </Text>
        <Text size={13} style={a.mt_4}>
          {value}
        </Text>
      </DmView>
    )

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mt_8]}>
      <Text
        size={13}
        weight={bold ? "bold" : "regular"}
        leading={px(17)}
      >
        {label}
      </Text>
      <Text
        size={13}
        weight={bold ? "bold" : "regular"}
        leading={px(17)}
      >
        {value}
      </Text>
    </DmView>
  )

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]} edges={["top"]}>
      {/* Same header as checkout, so the flow does not change shape mid-way */}
      <DmView style={[a.flex_row, a.items_center, a.px_12, a.py_10, styles.row]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="bold">
            {cart.categoryName}
          </Text>
          {!!cart.proName && (
            <Text size={12} leading="tight" color="secondary" style={a.mt_2}>
              {cart.proName}
            </Text>
          )}
        </DmView>
        <DmView style={styles.box} />
      </DmView>

      <AppScrollView
        style={a.flex_1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Full-bleed hero: where this order is going, drawn. A pin on the
            address the customer chose, or the pro's area outlined for a
            pickup. Same opening as the regular-service review screen, which is
            why the horizontal padding sits on the content below rather than on
            the ScrollView. */}
        <OrderLocationMap coords={mapCoords} isPickup={isPickup} />

        <DmView style={a.px_16}>
          <Text size={16} weight="bold" color="brand" align="center" style={a.mt_16}>
            {t("review_order")}
          </Text>

          {block(
            whereLabel,
            // Never let the destination vanish: block() hides on an empty
            // string, and whereValue is "" while the pro profile is still
            // loading or when a saved address has no street line.
            whereValue ||
              t(isPickup ? "pickup_area_unavailable" : "choose_address")
          )}
          {block(t(isPickup ? "pickup_time" : "delivery_time"), whenValue)}
          {block(t("payment_method"), paymentLabel)}
          {block(t("order_notes"), cart.orderNotes)}

          <DmView style={a.mt_18}>
            <Text size={14} weight="bold">
              {t("ordered_items")}
            </Text>

            {cart.items.map((line) => (
              <DmView key={line.uid} style={a.mt_10}>
                <DmView style={[a.flex_row, a.justify_between]}>
                  <Text size={13} weight="medium" style={[a.flex_1, a.pr_10]}>
                    {line.quantity}×  {line.name}
                  </Text>
                  <Text size={13}>
                    {formatMoney(cartLineTotal(line))} {t("EGP")}
                  </Text>
                </DmView>

                {/* Chosen options sit under their line, unpriced — their cost is
                    already inside the line total above. */}
                {(line.selectedOptions ?? []).flatMap((option) =>
                  option.choices.map((choice) => (
                    <Text
                      key={`${line.uid}-${option.optionName}-${choice.name}`}
                      size={12}
                      color="secondary"
                      style={[a.mt_2, a.ml_16]}
                    >
                      {choice.name}
                    </Text>
                  ))
                )}
              </DmView>
            ))}

            <DmView style={[styles.box2, a.mt_14]} />
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
        </DmView>
      </AppScrollView>

      <DmView
        style={[a.px_16, a.pt_14, styles.safeArea, styles.footerShadow, { paddingBottom: insets.bottom + 12 }]}
      >
        <Button
          title={t("submit_order")}
          size={px(48)}
          label="md"
          labelWeight="semibold"
          disabled={isSubmitting || !cart.items.length}
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
