import React, { useMemo } from "react"

// Components
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { I18nManager, ScrollView, TextInput } from "react-native"
import CachedImage from "@tappler/shared/src/components/CachedImage"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import {
  cartLineTotal,
  cartSubtotal,
  clearCart,
  setCartItemQuantity,
  setOrderNotes,
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
import MinusIcon from "assets/icons/minus.svg"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

type Props = RootStackScreenProps<"FoodCartScreen">

// Basket review: steppers, order notes, and a totals preview computed from
// the same menu config the backend prices from (deliveryCharge /
// freeDeliveryThreshold / discount rate+threshold). The backend recomputes
// and persists its own numbers at creation — this block is a preview.
const FoodCartScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  const cart = useTypedSelector((state) => state.cart)

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId ?? 0, serviceCategoryId: cart.serviceCategoryId ?? 0 },
    { skip: !cart.proId || !cart.serviceCategoryId }
  )

  const subtotal = cartSubtotal(cart.items)

  const deliveryFee = useMemo(() => {
    if (!menu) return 0
    if (menu.freeDeliveryThreshold != null && subtotal >= menu.freeDeliveryThreshold)
      return 0
    return menu.deliveryCharge ?? 0
  }, [menu, subtotal])

  const orderDiscount = useMemo(() => {
    if (
      !menu ||
      menu.totalOrderValueDiscountRate == null ||
      menu.totalOrderValueDiscountThreshold == null ||
      subtotal < menu.totalOrderValueDiscountThreshold
    )
      return 0
    return Math.round(subtotal * menu.totalOrderValueDiscountRate) / 100
  }, [menu, subtotal])

  const total = subtotal + deliveryFee - orderDiscount

  const handleChangeQuantity = (line: CartItemType, delta: number) => {
    dispatch(
      setCartItemQuantity({ uid: line.uid, quantity: line.quantity + delta })
    )
  }

  const renderLine = (line: CartItemType) => {
    const optionsSummary = (line.selectedOptions ?? [])
      .flatMap((option) => option.choices.map((choice) => choice.name))
      .join(", ")
    return (
      <DmView
        key={line.uid}
        className="flex-row items-center px-[16] py-[14] border-b-0.5 border-b-grey14"
      >
        <DmView className="w-[54] h-[54] rounded-8 overflow-hidden bg-grey36">
          <CachedImage
            uri={line.photo || undefined}
            style={styles.lineImage}
            resizeMode="cover"
          />
        </DmView>
        <DmView className="flex-1 ml-[12] mr-[8]">
          <DmText className="text-14 leading-[18px] font-custom600">
            {line.name}
          </DmText>
          {!!optionsSummary && (
            <DmText
              className="mt-[3] text-12 leading-[15px] font-custom400 text-grey2"
              numberOfLines={2}
            >
              {optionsSummary}
            </DmText>
          )}
          <DmText className="mt-[5] text-13 leading-[16px] font-custom600">
            {cartLineTotal(line).toFixed(2)} {t("EGP")}
          </DmText>
        </DmView>
        <DmView className="flex-row items-center">
          <DmView
            className="items-center justify-center w-[23] h-[23] border-1 rounded-full"
            onPress={() => handleChangeQuantity(line, -1)}
          >
            <MinusIcon />
          </DmView>
          <DmText className="px-[12] text-15 leading-[19px] font-custom700">
            {line.quantity}
          </DmText>
          <DmView
            className="items-center justify-center w-[23] h-[23] border-1 border-red rounded-full"
            onPress={line.quantity < 30 ? () => handleChangeQuantity(line, 1) : undefined}
          >
            <PlusIcon color={colors.red} />
          </DmView>
        </DmView>
      </DmView>
    )
  }

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView className="flex-row items-center justify-between mt-[8]">
      <DmText
        className={
          bold
            ? "text-15 leading-[19px] font-custom700"
            : "text-13 leading-[17px] font-custom400 text-grey2"
        }
      >
        {label}
      </DmText>
      <DmText
        className={
          bold
            ? "text-15 leading-[19px] font-custom700"
            : "text-13 leading-[17px] font-custom500"
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
            {t("your_basket")}
          </DmText>
          {!!cart.proName && (
            <DmText className="mt-[2] text-12 leading-[15px] font-custom400 text-grey2">
              {cart.proName}
            </DmText>
          )}
        </DmView>
        <DmView
          className="w-[40] items-end"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={
            cart.items.length ? () => dispatch(clearCart()) : undefined
          }
        >
          {cart.items.length > 0 && (
            <DmText className="text-12 leading-[15px] font-custom500 text-red">
              {t("clear")}
            </DmText>
          )}
        </DmView>
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
            {cart.items.map(renderLine)}

            {/* Order notes */}
            <DmView className="px-[16] mt-[18]">
              <DmText className="text-14 leading-[18px] font-custom600 mb-[8]">
                {t("order_notes")}
              </DmText>
              <DmView className="bg-white" style={styles.notesBorder}>
                <TextInput
                  value={cart.orderNotes}
                  onChangeText={(text) => dispatch(setOrderNotes(text))}
                  multiline
                  placeholder={t("order_notes_placeholder")}
                  placeholderTextColor={colors.grey5}
                  style={styles.notesInput}
                />
              </DmView>
            </DmView>

            {/* Totals */}
            <DmView className="mx-[16] mt-[18] p-[14] rounded-12 bg-grey36">
              {totalsRow(t("subtotal"), `${subtotal.toFixed(2)} ${t("EGP")}`)}
              {totalsRow(
                t("delivery_fee"),
                deliveryFee
                  ? `${deliveryFee.toFixed(2)} ${t("EGP")}`
                  : t("free")
              )}
              {orderDiscount > 0 &&
                totalsRow(
                  t("discount"),
                  `- ${orderDiscount.toFixed(2)} ${t("EGP")}`
                )}
              <DmView className="h-[0.7] bg-grey14 mt-[10]" />
              {totalsRow(t("total"), `${total.toFixed(2)} ${t("EGP")}`, true)}
            </DmView>
          </ScrollView>

          <DmView
            className="px-[16] bg-white"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <ActionBtn
              title={t("go_to_checkout")}
              className="h-[44]"
              textClassName="text-14 leading-[18px] font-custom600"
              onPress={() => navigation.navigate("FoodCheckoutScreen")}
            />
          </DmView>
        </>
      )}
    </SafeAreaView>
  )
}

export default FoodCartScreen
