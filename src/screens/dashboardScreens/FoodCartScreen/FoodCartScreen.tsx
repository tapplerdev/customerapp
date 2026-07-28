import React, { useMemo } from "react"

// Components
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView } from "react-native"
import CachedImage from "@tappler/shared/src/components/CachedImage"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import {
  cartLineTotal,
  computeOrderTotals,
  emptyDraft,
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
        className="px-[16] py-[18] border-b-0.5 border-b-grey14"
      >
        {/* Top: name + options + badge | thumbnail */}
        <DmView className="flex-row">
          <DmView className="flex-1 mr-[12]">
            <DmText className="text-15 leading-[19px] font-custom600">
              {line.name}
            </DmText>
            {choiceNames.map((name, idx) => (
              <DmText
                key={idx}
                className="mt-[3] text-13 leading-[17px] font-custom400 text-grey2"
              >
                {name}
              </DmText>
            ))}
            {line.isPreOrderOnly && (
              <DmView className="mt-[8] self-start bg-red2 rounded-4 px-[8] py-[3]">
                <DmText className="text-11 leading-[14px] font-custom700 text-white">
                  {t("pre_order")}
                </DmText>
              </DmView>
            )}
          </DmView>

          <DmView className="overflow-hidden rounded-8" style={styles.thumb}>
            <CachedImage
              uri={line.photo || undefined}
              style={styles.thumb}
              resizeMode="cover"
              withSkeleton
            />
          </DmView>
        </DmView>

        {/* Bottom: price (left) on the same line as the stepper (right) */}
        <DmView className="mt-[14] flex-row items-center justify-between">
          <DmView className="flex-1 flex-row items-center flex-wrap">
            <DmText className="text-14 leading-[18px] font-custom400">
              {effectiveTotal % 1 ? effectiveTotal.toFixed(2) : effectiveTotal}{" "}
              {t("EGP")}
            </DmText>
            {showStrike && (
              <DmText className="ml-[10] text-14 leading-[18px] font-custom400 text-grey2 line-through">
                {originalTotal % 1 ? originalTotal.toFixed(2) : originalTotal}{" "}
                {t("EGP")}
              </DmText>
            )}
          </DmView>

          {/* Bordered stepper (matches the cart mockup) */}
          <DmView
            className="flex-row items-center justify-between border-1 border-grey14 rounded-8 px-[6] h-[34]"
            style={styles.stepper}
          >
            <DmView
              className="w-[24] h-[34] items-center justify-center"
              onPress={() => changeQuantity(line, -1)}
            >
              <TrashRedIcon width={15} height={15} />
            </DmView>
            <DmText className="text-14 leading-[17px] font-custom700">
              {line.quantity}
            </DmText>
            <DmView
              className="w-[24] h-[34] items-center justify-center"
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
    <DmView className="flex-row items-center justify-between mt-[12]">
      <DmText
        className={
          bold
            ? "text-16 leading-[20px] font-custom700"
            : "text-14 leading-[18px] font-custom400"
        }
      >
        {label}
      </DmText>
      <DmText
        className={
          bold
            ? "text-16 leading-[20px] font-custom700"
            : "text-14 leading-[18px] font-custom400"
        }
      >
        {value}
      </DmText>
    </DmView>
  )

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
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
            {cart.categoryName || t("food_menu")}
          </DmText>
          {!!cart.proName && (
            <DmText className="mt-[2] text-12 leading-[15px] font-custom400 text-grey2">
              {cart.proName}
            </DmText>
          )}
        </DmView>
        <DmView className="w-[32]" />
      </DmView>

      {cart.items.length === 0 ? (
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("basket_empty")}
          </DmText>
          <ActionBtn
            title={t("back")}
            className="mt-[20] h-[41] px-[40]"
            onPress={() => navigation.goBack()}
          />
        </DmView>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <DmText className="px-[16] pt-[20] pb-[6] text-22 leading-[27px] font-custom700">
              {t("your_cart")}
            </DmText>

            {cart.items.map(renderLine)}

            {/* Totals */}
            <DmView className="px-[16] pt-[16]">
              {totalsRow(t("subtotal"), `${subtotal % 1 ? subtotal.toFixed(2) : subtotal} ${t("EGP")}`)}
              {totalsRow(
                t("delivery_fee"),
                deliveryFee
                  ? `${deliveryFee % 1 ? deliveryFee.toFixed(2) : deliveryFee} ${t("EGP")}`
                  : t("free")
              )}
              {orderDiscount > 0 &&
                totalsRow(
                  t("discount"),
                  `- ${orderDiscount % 1 ? orderDiscount.toFixed(2) : orderDiscount} ${t("EGP")}`
                )}
              <DmView className="h-[0.7] bg-grey14 mt-[14]" />
              {totalsRow(
                t("order_total"),
                `${total % 1 ? total.toFixed(2) : total} ${t("EGP")}`,
                true
              )}
            </DmView>
          </ScrollView>

          {/* Same pinned footer as the Filters sheet and the menu basket bar:
              white container, shadow cast upward onto the content it covers.
              The button keeps its own pill radius. */}
          <DmView
            className="px-[16] pt-[14] bg-white"
            style={[styles.footerShadow, { paddingBottom: insets.bottom + 12 }]}
          >
            <ActionBtn
              title={t("continue")}
              className="h-[48]"
              textClassName="text-15 leading-[19px] font-custom600"
              onPress={() => navigation.navigate("FoodCheckoutScreen", { proId })}
            />
          </DmView>
        </>
      )}
    </SafeAreaView>
  )
}

export default FoodCartScreen
