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

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import {
  computeOrderTotals,
  emptyDraft,
  selectDraft,
  setCartAddress,
  setOrderNotes,
} from "store/cart/slice"
import {
  useCheckDeliveryQuery,
  useGetProMenuQuery,
  useGetProProfileQuery,
} from "services/api"
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

// Checkout: delivery address (with out-of-zone guard), delivery time
// (now / scheduled via CalendarTimeModal), payment on delivery, and the
// Gathers and validates, then hands a built payload to Review, which owns
// the actual submit.
const FoodCheckoutScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  // Checkout always submits the draft for the pro it was entered from.
  const cartState = useTypedSelector((state) => state.cart)
  const cart = selectDraft(cartState, proId, Date.now()) ?? emptyDraft(proId)
  const { isAuth } = useTypedSelector((state) => state.auth)

  const { data: pro } = useGetProProfileQuery(
    { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
    { skip: !cart.serviceCategoryId }
  )

  const { data: menu } = useGetProMenuQuery(
    { proId: cart.proId, serviceCategoryId: cart.serviceCategoryId },
    { skip: !cart.serviceCategoryId }
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


  // Address changed from MySavedAddresses/PickAddress → adopt it for the
  // order. Focus + delay guard copied from useServiceAddressFlow: this
  // screen stays mounted beneath the pickers, so only act when focused.
  useEffect(() => {
    const handler = (address: AddressInfo) => {
      setTimeout(() => {
        if (!navigation.isFocused()) return
        dispatch(setCartAddress({ proId, address }))
      }, 600)
    }
    addressEventBus.on("address:pick", handler)
    addressEventBus.on("address:select", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
      addressEventBus.off("address:select", handler)
    }
  }, [navigation, dispatch])

  // Fulfillment mode. The listing seeds a hint (cart.fulfillmentMode); the
  // checkout is the source of truth, limited to what the pro actually offers.
  const availableModes = useMemo<("delivery" | "pickup")[]>(() => {
    const modes: ("delivery" | "pickup")[] = []
    if (menu?.isDeliveryEnabled) modes.push("delivery")
    if (menu?.isPickupEnabled) modes.push("pickup")
    return modes.length ? modes : ["delivery"]
  }, [menu?.isDeliveryEnabled, menu?.isPickupEnabled])

  const [selectedMode, setSelectedMode] = useState<"delivery" | "pickup">(
    cart.fulfillmentMode
  )

  // Driven by what THIS pro accepts (pro_payment_methods), not a hardcoded
  // pair. A cook who only takes cash never sees a card option, and the label
  // follows fulfillment so it never promises "on delivery" for a pickup.
  const paymentOptions = useMemo(() => {
    const accepted = pro?.paymentMethods ?? []
    const isPickup = selectedMode === "pickup"

    const options: { key: "cash" | "creditCard"; label: string }[] = []

    if (!accepted.length || accepted.includes("cash")) {
      options.push({
        key: "cash",
        label: isPickup ? t("cash_on_pickup") : t("cash_on_delivery"),
      })
    }

    if (accepted.includes("credit card")) {
      options.push({
        key: "creditCard",
        label: isPickup ? t("card_on_pickup") : t("card_on_delivery"),
      })
    }

    return options
  }, [pro?.paymentMethods, selectedMode, t])

  // City + governorate only — never streetAddress or unitNumber.
  const pickupArea = useMemo(() => {
    const address = pro?.address?.address
    return [address?.city, address?.governorate].filter(Boolean).join(", ")
  }, [pro?.address?.address])

  // A method the pro does not accept must never stay selected — switching
  // fulfillment or a late profile load can strand the old choice.
  useEffect(() => {
    if (!paymentOptions.some((option) => option.key === paymentMethod)) {
      setPaymentMethod(paymentOptions[0]?.key ?? "cash")
    }
  }, [paymentOptions, paymentMethod])

  // Once the menu loads, snap to a mode the pro actually offers.
  useEffect(() => {
    if (!availableModes.includes(selectedMode)) setSelectedMode(availableModes[0])
  }, [availableModes, selectedMode])

  // Pickup orders: no delivery fee, no delivery-zone advisory — customer travels.
  const isPickup = selectedMode === "pickup"

  const { subtotal, deliveryFee, orderDiscount, total } = useMemo(
    () => computeOrderTotals(cart.items, menu, isPickup),
    [cart.items, menu, isPickup]
  )

  // Out-of-zone is decided by the backend (same ST_Distance check createJob
  // enforces), not client-side math. Fail-open: only block on a definitive
  // `deliverable: false` — while fetching or on error we don't block, since
  // createJob is the final authority.
  const addressCoords = cart.address?.coords

  const { data: deliveryCheck } = useCheckDeliveryQuery(
    {
      proId: cart.proId ?? 0,
      serviceCategoryId: cart.serviceCategoryId ?? 0,
      latitude: addressCoords?.lat ?? 0,
      longitude: addressCoords?.lon ?? 0,
    },
    { skip: isPickup || !cart.proId || !cart.serviceCategoryId || !addressCoords }
  )

  const outOfZone = !isPickup && deliveryCheck?.deliverable === false

  const canSubmit =
    cart.items.length > 0 &&
    !!addressCoords &&
    !outOfZone &&
    (deliverNow || !!scheduledDate)

  const handleConfirmSchedule = (
    date: string,
    timeSlot?: { start: string; end: string }
  ) => {
    setCalendarVisible(false)
    setScheduledDate(date)
    setScheduledSlot(timeSlot ?? null)
    setDeliverNow(false)
  }

  const scheduleLabel = scheduledDate
    ? `${scheduledDate}${scheduledSlot ? ` · ${scheduledSlot.start} - ${scheduledSlot.end}` : ""}`
    : t("choose_date_time")

  const handleReviewOrder = () => {
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
        placeOfService: selectedMode,
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

    navigation.navigate("FoodOrderReviewScreen", {
      proId,
      payload,
      isPickup,
      whereLabel: t(isPickup ? "pickup_from" : "deliver_to"),
      whereValue: isPickup ? pickupArea : (cart.address?.address ?? ""),
      whenValue: deliverNow
        ? t(isPickup ? "pick_up_now" : "deliver_now")
        : scheduleLabel,
      paymentLabel:
        paymentOptions.find((option) => option.key === paymentMethod)?.label ??
        "",
    })
  }


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
        {/* Fulfillment mode — only when the pro offers both */}
        {availableModes.length > 1 && (
          <DmView className="mb-[20]">
            {sectionTitle(t("fulfillment"))}
            <DmView className="flex-row">
              {availableModes.map((mode, i) => {
                const active = selectedMode === mode
                return (
                  <DmView
                    key={mode}
                    onPress={() => setSelectedMode(mode)}
                    style={{
                      flex: 1,
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      marginRight: i === 0 ? 10 : 0,
                      backgroundColor: active ? colors.red : colors.white,
                      borderColor: active ? colors.red : colors.grey14,
                    }}
                  >
                    <DmText
                      className="text-14 leading-[18px] font-custom600"
                      style={{ color: active ? colors.white : colors.black }}
                    >
                      {t(mode)}
                    </DmText>
                  </DmView>
                )
              })}
            </DmView>
          </DmView>
        )}

        {/* Where the handover happens. On DELIVERY that is the customer's
            address, which they can change. On PICKUP the customer travels to
            the pro, so showing their own address was simply the wrong end of
            the journey — and there is nothing for them to change. */}
        {sectionTitle(t(isPickup ? "pickup_from" : "deliver_to"))}
        {isPickup ? (
          <DmView className="p-[14] rounded-12 border-0.5 border-grey14">
            <DmText className="text-13 leading-[18px] font-custom500">
              {pickupArea || t("pickup_area_unavailable")}
            </DmText>
            {/* Area only until the order is accepted. These are home cooks —
                the exact address is theirs to give, not ours to publish to
                anyone who opens a checkout. */}
            <DmText className="mt-[4] text-11 leading-[15px] font-custom400 text-grey2">
              {t("exact_address_after_acceptance")}
            </DmText>
          </DmView>
        ) : (
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
        )}

        {/* Delivery time */}
        <DmView className="mt-[20]">
          {sectionTitle(t(isPickup ? "pickup_time" : "delivery_time"))}
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
                {t(isPickup ? "pick_up_now" : "deliver_now")}
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
                  {t(isPickup ? "schedule_pickup" : "schedule_delivery")}
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
            {paymentOptions.map((option, index) => (
              <React.Fragment key={option.key}>
                {index > 0 && (
                  <DmView className="h-[0.5] bg-grey14 my-[12]" />
                )}
                <DmView
                  className="flex-row items-center justify-between"
                  onPress={() => setPaymentMethod(option.key)}
                  // One accepted method is not a choice — show it, don't ask.
                  disabled={paymentOptions.length === 1}
                >
                  <DmText className="text-13 leading-[17px] font-custom500">
                    {option.label}
                  </DmText>
                  {paymentOptions.length > 1 && (
                    <DmChecbox
                      variant="circle"
                      isChecked={paymentMethod === option.key}
                    />
                  )}
                </DmView>
              </React.Fragment>
            ))}
          </DmView>
        </DmView>

        {/* Order notes */}
        <DmView className="mt-[20]">
          {sectionTitle(t("order_notes"))}
          <DmView className="bg-white" style={styles.notesBorder}>
            <TextInput
              value={cart.orderNotes}
              onChangeText={(text) => dispatch(setOrderNotes({ proId, notes: text }))}
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
          {/* Nothing is delivered on a pickup order, so the row would read
              "Free" — a claim, not an omission. */}
          {!isPickup &&
            totalsRow(
              t("delivery_fee"),
              deliveryFee ? `${deliveryFee.toFixed(2)} ${t("EGP")}` : t("free")
            )}
          {orderDiscount > 0 &&
            totalsRow(t("discount"), `- ${orderDiscount.toFixed(2)} ${t("EGP")}`)}
          {totalsRow(t("total"), `${total.toFixed(2)} ${t("EGP")}`, true)}
        </DmView>
      </ScrollView>

      {/* Same pinned white footer as the menu basket bar and the cart, with the
          shadow cast upward onto the content it covers. The button keeps its
          own pill radius. */}
      <DmView
        className="px-[16] pt-[14] bg-white"
        style={[styles.footerShadow, { paddingBottom: insets.bottom + 12 }]}
      >
        <ActionBtn
          title={t("review_order")}
          className="h-[44]"
          textClassName="text-14 leading-[18px] font-custom600"
          disable={!canSubmit}
          onPress={canSubmit ? handleReviewOrder : undefined}
        />
      </DmView>

      <CalendarTimeModal
        isVisible={isCalendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={handleConfirmSchedule}
        hideSpecialOptions
      />
    </SafeAreaView>
  )
}

export default FoodCheckoutScreen
