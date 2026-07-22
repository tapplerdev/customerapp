import React, { useEffect, useMemo, useState } from "react"

// Components
import {
  ActionBtn,
  DmChecbox,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView, TextInput } from "react-native"
import CalendarTimeModal from "components/CalendarTimeModal/CalendarTimeModal"
import ErrorModal from "components/ErrorModal"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import {
  cartSubtotal,
  clearCart,
  setCartAddress,
  setOrderNotes,
} from "store/cart/slice"
import { useCreateJobMutation, useGetProMenuQuery } from "services/api"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"

// Helpers & Types
import { AddressInfo, RootStackScreenProps } from "navigation/types"
import { CreateJobRequest } from "types/job"

// Styles & Assets
import styles from "./styles"
import colors from "@tappler/shared/src/styles/colors"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

type Props = RootStackScreenProps<"FoodCheckoutScreen">

// Straight-line distance in km — same yardstick as the backend's delivery
// check (ST_Distance vs deliveryRadius km against ANY pro address).
const distanceKm = (
  a: { lat: number; lon: number },
  b: { latitude: number; longitude: number }
): number => {
  const R = 6371
  const dLat = ((b.latitude - a.lat) * Math.PI) / 180
  const dLon = ((b.longitude - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Checkout: delivery address (with out-of-zone guard), delivery time
// (now / scheduled via CalendarTimeModal), payment on delivery, and the
// final Place Order submit through the standard createJob endpoint.
const FoodCheckoutScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  const cart = useTypedSelector((state) => state.cart)
  const { isAuth } = useTypedSelector((state) => state.auth)
  const [createJob] = useCreateJobMutation()

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId ?? 0, serviceCategoryId: cart.serviceCategoryId ?? 0 },
    { skip: !cart.proId || !cart.serviceCategoryId }
  )

  const [deliverNow, setDeliverNow] = useState(true)
  const [isCalendarVisible, setCalendarVisible] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)
  const [scheduledSlot, setScheduledSlot] = useState<{
    start: string
    end: string
  } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "creditCard">(
    "cash"
  )
  const [isSubmitting, setSubmitting] = useState(false)
  const [isErrorVisible, setErrorVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // Address changed from MySavedAddresses/PickAddress → adopt it for the
  // order. Focus + delay guard copied from useServiceAddressFlow: this
  // screen stays mounted beneath the pickers, so only act when focused.
  useEffect(() => {
    const handler = (address: AddressInfo) => {
      setTimeout(() => {
        if (!navigation.isFocused()) return
        dispatch(setCartAddress(address))
      }, 600)
    }
    addressEventBus.on("address:pick", handler)
    addressEventBus.on("address:select", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
      addressEventBus.off("address:select", handler)
    }
  }, [navigation, dispatch])

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

  // In-zone when within radius of ANY pro address; no radius = no cap.
  // Backend re-checks at submission (ProsServeJobLocation), this is the
  // friendly early warning.
  const addressCoords = cart.address?.coords

  const outOfZone = useMemo(() => {
    if (!addressCoords) return false
    if (menu?.deliveryRadius == null) return false
    const points = menu.proLocations ?? []
    if (!points.length) return false
    return !points.some(
      (point) => distanceKm(addressCoords, point) <= menu.deliveryRadius!
    )
  }, [addressCoords, menu])

  const canSubmit =
    cart.items.length > 0 &&
    !!addressCoords &&
    !outOfZone &&
    (deliverNow || !!scheduledDate) &&
    !isSubmitting

  const handleConfirmSchedule = (
    date: string,
    timeSlot?: { start: string; end: string }
  ) => {
    setCalendarVisible(false)
    setScheduledDate(date)
    setScheduledSlot(timeSlot ?? null)
    setDeliverNow(false)
  }

  const handlePlaceOrder = async () => {
    if (
      !canSubmit ||
      !cart.proId ||
      !cart.serviceCategoryId ||
      !cart.address ||
      !addressCoords
    )
      return
    if (!isAuth) {
      navigation.navigate("AuthGateScreen")
      return
    }

    try {
      setSubmitting(true)
      const payload: CreateJobRequest = {
        serviceCategoryId: cart.serviceCategoryId,
        address: {
          city: cart.address.city || "",
          governorate: cart.address.governorate || "",
          streetAddress: cart.address.address,
          location: {
            lat: addressCoords.lat,
            lng: addressCoords.lon,
          },
        },
        prosIds: [cart.proId],
        questionsAnswers: [],
        placeOfService: "delivery",
        dateType: deliverNow ? "asap" : "date",
        ...(!deliverNow && scheduledDate && { dates: [{ date: scheduledDate }] }),
        ...(!deliverNow &&
          scheduledSlot && {
            timeSlots: [
              { start: scheduledSlot.start, end: scheduledSlot.end },
            ],
          }),
        ...(cart.orderNotes && { orderNotes: cart.orderNotes }),
        // Only the fields the backend validates — display-only extras
        // (originalPrice, isPreOrderOnly) are stripped here.
        foodOrderItems: cart.items.map((line) => ({
          menuItemId: line.menuItemId,
          name: line.name,
          price: line.price,
          quantity: line.quantity,
          ...(line.selectedOptions?.length && {
            selectedOptions: line.selectedOptions.map((option) => ({
              optionName: option.optionName,
              choices: option.choices.map((choice) => ({
                name: choice.name,
                price: choice.price,
              })),
            })),
          }),
        })),
        paymentMethod,
      }
      await createJob(payload).unwrap()
      const successAddress = cart.address
      dispatch(clearCart())
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

  const scheduleLabel = scheduledDate
    ? `${scheduledDate}${scheduledSlot ? ` · ${scheduledSlot.start} - ${scheduledSlot.end}` : ""}`
    : t("choose_date_time")

  const sectionTitle = (label: string) => (
    <DmText className="text-15 leading-[19px] font-custom700 mb-[10]">
      {label}
    </DmText>
  )

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
            {t("checkout")}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {/* Deliver to */}
        {sectionTitle(t("deliver_to"))}
        <DmView
          className="p-[14] rounded-12 border-0.5 border-grey14"
          onPress={() =>
            navigation.navigate("MySavedAddressesScreen", {
              selectionMode: true,
            })
          }
        >
          <DmView className="flex-row items-center justify-between">
            <DmText
              className="flex-1 text-13 leading-[18px] font-custom500"
              numberOfLines={2}
            >
              {cart.address?.address || t("choose_address")}
            </DmText>
            <DmText className="ml-[10] text-12 leading-[15px] font-custom600 text-red">
              {t("change")}
            </DmText>
          </DmView>
          {outOfZone && (
            <DmView className="mt-[10] px-[10] py-[8] rounded-8 bg-pink1">
              <DmText className="text-12 leading-[16px] font-custom600 text-red">
                {t("outside_delivery_zone")}
              </DmText>
              <DmText className="mt-[2] text-11 leading-[15px] font-custom400 text-red">
                {t("outside_delivery_zone_descr")}
              </DmText>
            </DmView>
          )}
        </DmView>

        {/* Delivery time */}
        <DmView className="mt-[20]">
          {sectionTitle(t("delivery_time"))}
          <DmView className="p-[14] rounded-12 border-0.5 border-grey14">
            <DmView
              className="flex-row items-center justify-between"
              onPress={() => {
                setDeliverNow(true)
                setScheduledDate(null)
                setScheduledSlot(null)
              }}
            >
              <DmText className="text-13 leading-[17px] font-custom500">
                {t("deliver_now")}
              </DmText>
              <DmChecbox variant="circle" isChecked={deliverNow} />
            </DmView>
            <DmView className="h-[0.5] bg-grey14 my-[12]" />
            <DmView
              className="flex-row items-center justify-between"
              onPress={() => setCalendarVisible(true)}
            >
              <DmView className="flex-1">
                <DmText className="text-13 leading-[17px] font-custom500">
                  {t("schedule_delivery")}
                </DmText>
                {!deliverNow && !!scheduledDate && (
                  <DmText className="mt-[3] text-12 leading-[15px] font-custom400 text-grey2">
                    {scheduleLabel}
                  </DmText>
                )}
              </DmView>
              <DmChecbox variant="circle" isChecked={!deliverNow} />
            </DmView>
          </DmView>
        </DmView>

        {/* Payment */}
        <DmView className="mt-[20]">
          {sectionTitle(t("payment_method"))}
          <DmView className="p-[14] rounded-12 border-0.5 border-grey14">
            <DmView
              className="flex-row items-center justify-between"
              onPress={() => setPaymentMethod("cash")}
            >
              <DmText className="text-13 leading-[17px] font-custom500">
                {t("cash_on_delivery")}
              </DmText>
              <DmChecbox variant="circle" isChecked={paymentMethod === "cash"} />
            </DmView>
            <DmView className="h-[0.5] bg-grey14 my-[12]" />
            <DmView
              className="flex-row items-center justify-between"
              onPress={() => setPaymentMethod("creditCard")}
            >
              <DmText className="text-13 leading-[17px] font-custom500">
                {t("card_on_delivery")}
              </DmText>
              <DmChecbox
                variant="circle"
                isChecked={paymentMethod === "creditCard"}
              />
            </DmView>
          </DmView>
        </DmView>

        {/* Order notes */}
        <DmView className="mt-[20]">
          {sectionTitle(t("order_notes"))}
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

        {/* Order summary */}
        <DmView className="mt-[20] p-[14] rounded-12 bg-grey36">
          <DmText className="text-14 leading-[18px] font-custom700 mb-[4]">
            {t("order_summary")}
          </DmText>
          {cart.items.map((line) => (
            <DmView
              key={line.uid}
              className="flex-row items-center justify-between mt-[6]"
            >
              <DmText
                className="flex-1 text-12 leading-[16px] font-custom400"
                numberOfLines={1}
              >
                {line.quantity}× {line.name}
              </DmText>
            </DmView>
          ))}
          <DmView className="h-[0.7] bg-grey14 mt-[10]" />
          {totalsRow(t("subtotal"), `${subtotal.toFixed(2)} ${t("EGP")}`)}
          {totalsRow(
            t("delivery_fee"),
            deliveryFee ? `${deliveryFee.toFixed(2)} ${t("EGP")}` : t("free")
          )}
          {orderDiscount > 0 &&
            totalsRow(t("discount"), `- ${orderDiscount.toFixed(2)} ${t("EGP")}`)}
          {totalsRow(t("total"), `${total.toFixed(2)} ${t("EGP")}`, true)}
        </DmView>
      </ScrollView>

      <DmView
        className="px-[16] bg-white"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <ActionBtn
          title={t("place_order")}
          className="h-[44]"
          textClassName="text-14 leading-[18px] font-custom600"
          disable={!canSubmit}
          isLoading={isSubmitting}
          onPress={canSubmit ? handlePlaceOrder : undefined}
        />
      </DmView>

      <CalendarTimeModal
        isVisible={isCalendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={handleConfirmSchedule}
        hideSpecialOptions
      />
      <ErrorModal
        isVisible={isErrorVisible}
        onClose={() => setErrorVisible(false)}
        title={t("an_error_occurred")}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default FoodCheckoutScreen
