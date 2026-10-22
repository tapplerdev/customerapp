import React, { useMemo } from "react"

// Components
import { DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import CachedImage from "@tappler/shared/src/components/CachedImage"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import {
  cartLineTotal,
  computeOrderTotals,
  emptyDraft,
  formatMoney,
  selectDraft,
  setCartItemQuantity,
} from "store/cart/slice"
import { useGetProMenuQuery } from "services/api"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"
import { CartItemType } from "types/food"

// Styles & Assets
import styles from "./styles"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import PlusIcon from "assets/icons/plus.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"FoodCartScreen">

// Pre-discount unit price of a line (base + choices) → drives the strike-
// through next to the effective total.
const lineOriginalUnit = (line: CartItemType): number => {
  const choices = (line.selectedOptions ?? []).reduce(
    (sum, option) =>
      sum +
      option.choices.reduce(
        (s, choice) => s + (choice.originalPrice ?? choice.price ?? 0),
        0
      ),
    0
  )
  return (line.originalPrice ?? line.price) + choices
}

// Basket review, matching the Figma cart mockup: per-line option list,
// strikethrough totals, a bordered stepper under each thumbnail, and a plain
// totals block. Fee/discount preview uses the pro's menu config — the backend
// recomputes and persists its own numbers at creation.
const FoodCartScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  // This screen always operates on the draft for the pro it was opened from —
  // other kitchens' baskets are untouched.
  const cartState = useTypedSelector((state) => state.cart)
  const cart =
    selectDraft(cartState, proId, Date.now()) ?? emptyDraft(proId)

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
    { skip: !cart.serviceCategoryId }
  )


  // Shared with checkout and review — the cart had its own copy of this math
  // with no pickup awareness, so a pickup draft showed a delivery fee here and
  // none on the next screen.
  const isPickup = cart.fulfillmentMode === "pickup"

  const { subtotal, deliveryFee, orderDiscount, total } = useMemo(
    () => computeOrderTotals(cart.items, menu, isPickup),
    [cart.items, menu, isPickup]
  )

  const changeQuantity = (line: CartItemType, delta: number) => {
    dispatch(
      setCartItemQuantity({ proId, uid: line.uid, quantity: line.quantity + delta })
    )
  }

  const renderLine = (line: CartItemType) => {
    const effectiveTotal = cartLineTotal(line)
    const originalTotal = lineOriginalUnit(line) * line.quantity
    const showStrike = originalTotal > effectiveTotal + 0.001
    const choiceNames = (line.selectedOptions ?? []).flatMap((option) =>
      option.choices.map((choice) => choice.name)
    )

    return (
      <DmView
        key={line.uid}
        style={[a.px_16, a.py_18, styles.container]}
      >
        {/* Top: name + options + badge | thumbnail */}
        <DmView style={a.flex_row}>
          <DmView style={[a.flex_1, a.mr_12]}>
            <Text size={15} weight="semibold" leading="tight">
              {line.name}
            </Text>
            {choiceNames.map((name, idx) => (
              <Text
                key={idx}
                size={13}
                leading={px(17)}
                color="secondary"
                style={styles.text}
              >
                {name}
              </Text>
            ))}
            {line.isPreOrderOnly && (
              <DmView style={[a.mt_8, a.self_start, styles.preOrderWrap, a.px_8]}>
                <Text size={11} weight="bold" leading="tight" color="inverse">
                  {t("pre_order")}
                </Text>
              </DmView>
            )}
          </DmView>

          <DmView style={[a.overflow_hidden, styles.imageWrap, styles.thumb]}>
            <CachedImage
              uri={line.photo || undefined}
              style={styles.thumb}
              resizeMode="cover"
              withSkeleton
            />
          </DmView>
        </DmView>

        {/* Bottom: price (left) on the same line as the stepper (right) */}
        <DmView style={[a.mt_14, a.flex_row, a.items_center, a.justify_between]}>
          <DmView style={[a.flex_1, a.flex_row, a.items_center, a.flex_wrap]}>
            <Text size={14}>
              {formatMoney(effectiveTotal)}{" "}
              {t("EGP")}
            </Text>
            {showStrike && (
              <Text size={14} color="secondary" style={[a.ml_10, styles.eGP]}>
                {formatMoney(originalTotal)}{" "}
                {t("EGP")}
              </Text>
            )}
          </DmView>

          {/* Bordered stepper (matches the cart mockup) */}
          <DmView
            style={[a.flex_row, a.items_center, a.justify_between, a.border_1, styles.row, a.px_6, styles.stepper]}
          >
            <DmView
              style={[styles.iconWrap, a.items_center, a.justify_center]}
              onPress={() => changeQuantity(line, -1)}
            >
              <TrashRedIcon width={15} height={15} />
            </DmView>
            <Text size={14} weight="bold" leading="tight">
              {line.quantity}
            </Text>
            <DmView
              style={[styles.iconWrap, a.items_center, a.justify_center]}
              onPress={
                line.quantity < 30 ? () => changeQuantity(line, 1) : undefined
              }
            >
              <PlusIcon color={colors.red} width={16} height={16} strokeWidth={2.5} />
            </DmView>
          </DmView>
        </DmView>
      </DmView>
    )
  }

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mt_12]}>
      <Text
        size={bold ? 16 : 14}
        weight={bold ? "bold" : "regular"}
      >
        {label}
      </Text>
      <Text
        size={bold ? 16 : 14}
        weight={bold ? "bold" : "regular"}
      >
        {value}
      </Text>
    </DmView>
  )

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]} edges={["top"]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_12, a.py_10, styles.row2]}>
        <DmView
          style={[styles.iconWrap2, a.items_center, a.justify_center]}
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
            {cart.categoryName || t("food_menu")}
          </Text>
          {!!cart.proName && (
            <Text size={12} leading="tight" color="secondary" style={a.mt_2}>
              {cart.proName}
            </Text>
          )}
        </DmView>
        <DmView style={styles.box} />
      </DmView>

      {cart.items.length === 0 ? (
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("basket_empty")}
          </Text>
          <Button
            title={t("back")}
            size={px(41)}
            paddingX={40}
            style={a.mt_20}
            onPress={() => navigation.goBack()}
          />
        </DmView>
      ) : (
        <>
          <AppScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Text size={22} weight="bold" leading="tight" style={[a.px_16, a.pt_20, a.pb_6]}>
              {t("your_cart")}
            </Text>

            {cart.items.map(renderLine)}

            {/* Totals */}
            <DmView style={[a.px_16, a.pt_16]}>
              {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
              {/* Zeroed on pickup, and a 0 renders as "Free" — a claim the
                  business never made. Hide the row instead. */}
              {!isPickup &&
                totalsRow(
                  t("delivery_fee"),
                  deliveryFee
                    ? `${formatMoney(deliveryFee)} ${t("EGP")}`
                    : t("free")
                )}
              {orderDiscount > 0 &&
                totalsRow(
                  t("discount"),
                  `- ${formatMoney(orderDiscount)} ${t("EGP")}`
                )}
              <DmView style={[styles.box2, a.mt_14]} />
              {totalsRow(
                t("order_total"),
                `${formatMoney(total)} ${t("EGP")}`,
                true
              )}
            </DmView>
          </AppScrollView>

          {/* Same pinned footer as the Filters sheet and the menu basket bar:
              white container, shadow cast upward onto the content it covers.
              The button keeps its own pill radius. */}
          <DmView
            style={[a.px_16, a.pt_14, styles.safeArea, styles.footerShadow, { paddingBottom: insets.bottom + 12 }]}
          >
            <Button
              title={t("continue")}
              size={px(48)}
              label="md"
              labelWeight="semibold"
              onPress={() => navigation.navigate("FoodCheckoutScreen", { proId })}
            />
          </DmView>
        </>
      )}
    </SafeAreaView>
  )
}

export default FoodCartScreen
