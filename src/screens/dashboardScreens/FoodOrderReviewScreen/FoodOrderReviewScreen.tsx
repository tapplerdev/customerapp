import React, { useMemo, useState } from "react"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackParamList, RootStackScreenProps } from "navigation/types"
import {
  useCreateJobMutation,
  useGetProMenuQuery,
  useLazyGetProMenuQuery,
} from "services/api"
import { useTypedSelector } from "store"
import {
  cartLineTotal,
  clearCart,
  computeOrderTotals,
  emptyDraft,
  formatMoney,
  replaceCartLines,
  selectDraft,
} from "store/cart/slice"
import { buildFoodOrderItems, repairCart } from "utils/foodCartRepair"
import ErrorModal from "components/ErrorModal"
import WarningTriangleIcon from "assets/icons/warning-triangle.svg"
import OrderLocationMap from "components/OrderLocationMap/OrderLocationMap"

import styles from "./styles"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"FoodOrderReviewScreen">

// The order check refused the lines because the menu moved under the basket.
// The backend says so with a code (Phase 3); a backend from before it only
// names the field, and that is the same refusal.
const isMenuChangedRefusal = (error: any): boolean =>
  error?.data?.code === "FOOD_ORDER_MENU_CHANGED" ||
  error?.data?.validationErrors?.foodOrderItems != null

// Last look before committing. Checkout gathers and validates; this screen
// confirms and commits. The built payload arrives as a param (plain JSON, so
// it crosses the navigation boundary without a serialisation warning), but its
// food lines are rebuilt from the live basket on submit: when the menu moved
// and the basket was repaired here, what gets sent is what is on screen.
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
  // Set when the menu changed under the basket: the pop-up then has its own
  // title and icon, because the order did not fail, the basket was fixed.
  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined)
  // Set when the repair left nothing in the basket. The pop-up closes onto the
  // restaurant's menu: there is no basket left to check here.
  const [backToMenu, setBackToMenu] = useState<
    RootStackParamList["FoodMenuScreen"] | null
  >(null)

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
    { skip: !cart.serviceCategoryId }
  )
  const [fetchMenu] = useLazyGetProMenuQuery()

  // Same helper checkout used, so the number approved here is the number sent.
  const { subtotal, deliveryFee, orderDiscount, total } = useMemo(
    () => computeOrderTotals(cart.items, menu, isPickup),
    [cart.items, menu, isPickup]
  )

  // Re-read the menu, repair the basket against it and say what happened.
  // Returns false when there is nothing to tell the customer (the menu would
  // not load, or it agrees with the basket), so the caller shows the server's
  // own error as before. It never submits: the customer sees the new total,
  // then decides.
  const repairBasket = async (): Promise<boolean> => {
    if (!cart.serviceCategoryId) return false

    let fresh
    try {
      // preferCacheValue false: a forced refetch, the cached menu is the stale one
      fresh = await fetchMenu(
        { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
        false
      ).unwrap()
    } catch {
      return false
    }

    const repair = repairCart(cart.items, fresh)
    if (!repair.changed) return false

    // The draft goes when its last line does, so the menu's route params are
    // read from it first.
    const menuParams = {
      proId: cart.proId,
      serviceCategoryId: cart.serviceCategoryId,
      serviceId: cart.serviceId,
      proName: cart.proName,
      categoryName: cart.categoryName,
      fulfillmentMode: cart.fulfillmentMode,
    }
    dispatch(replaceCartLines({ proId, lines: repair.lines }))

    const emptied = repair.lines.length === 0
    setErrorTitle(t("food_menu_changed_title"))
    setBackToMenu(emptied ? menuParams : null)
    setErrorMessage(
      t(
        emptied
          ? "food_menu_changed_emptied"
          : repair.removed.length
            ? "food_menu_changed_removed"
            : repair.repriced.length
              ? "food_menu_changed_repriced"
              : "food_menu_changed_updated"
      )
    )
    setErrorVisible(true)
    return true
  }

  const handleSubmitOrder = async () => {
    if (isSubmitting) return

    try {
      setSubmitting(true)
      // The lines come from the basket on screen, not from the payload checkout
      // built, so a repaired basket is what gets sent next time.
      await createJob({
        ...payload,
        foodOrderItems: buildFoodOrderItems(cart.items),
      }).unwrap()
      const successAddress = cartState.address ?? undefined
      dispatch(clearCart(proId))
      navigation.navigate("RequestSuccessScreen", { address: successAddress })
    } catch (error: any) {
      if (isMenuChangedRefusal(error) && (await repairBasket())) return

      const validationErrors = error?.data?.validationErrors
      const message = validationErrors
        ? Object.values(validationErrors).flat().join(", ")
        : error?.data?.message || t("an_error_occurred")
      setErrorTitle(undefined)
      setBackToMenu(null)
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
        // After the pop-up has closed, never beside it (CLAUDE.local.md)
        onModalHide={() => {
          if (!backToMenu) return
          const params = backToMenu
          setBackToMenu(null)
          navigation.popTo("FoodMenuScreen", params)
        }}
        title={errorTitle}
        Icon={errorTitle ? <WarningTriangleIcon width={48} height={43} /> : undefined}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default FoodOrderReviewScreen
