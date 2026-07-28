import React, { useMemo } from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { Alert, ScrollView } from "react-native"

import { useTranslation } from "react-i18next"
import { useCancelJobMutation } from "services/api"
import { formatMoney } from "store/cart/slice"
import { JobFoodOrderItemType, JobType } from "types/job"
import colors from "@tappler/shared/src/styles/colors"

interface Props {
  job: JobType
}

// Order-centric detail body for food (hasMenu) jobs: status timeline driven
// by the pro's jobPro.status, then the itemized breakdown with the
// server-persisted totals. Live updates ride the existing socket → Jobs
// cache invalidation; the screen's re-focus refetch is the safety net.
const STEPS = ["accepted", "preparing", "withDeliveryCourier", "delivered"] as const

const FoodOrderView: React.FC<Props> = ({ job }) => {
  const { t } = useTranslation()

  const jobPro = job.pros?.[0]
  const status = jobPro?.status
  const isCancelled = status === "cancelled" || job.status === "cancelled"
  const currentStep = STEPS.indexOf(status as (typeof STEPS)[number])

  // Customer may cancel only before the pro starts preparing (status null =
  // order placed, or "accepted"). Once preparing/out-for-delivery it's not
  // self-serve. Status-flip only — no refund handling yet.
  const [cancelJob, { isLoading: isCancelling }] = useCancelJobMutation()
  const canCancel = !isCancelled && currentStep < 1

  const handleCancel = () => {
    Alert.alert(t("cancel_order"), t("cancel_order_confirm"), [
      { text: t("keep_order"), style: "cancel" },
      {
        text: t("cancel_order"),
        style: "destructive",
        onPress: () => {
          cancelJob({
            jobId: job.id,
            reasons: ["Customer cancelled the order"],
          })
        },
      },
    ])
  }

  const stepLabels: Record<(typeof STEPS)[number], string> = {
    accepted: t("order_accepted"),
    preparing: t("order_preparing"),
    withDeliveryCourier: t("order_out_for_delivery"),
    delivered: t("order_delivered"),
  }

  const items = job.foodOrderItems ?? []
  const subtotal = useMemo(
    () =>
      items.reduce((sum, line) => {
        const choicesTotal = (line.selectedOptions ?? []).reduce(
          (s, option) =>
            s + option.choices.reduce((cs, c) => cs + (c.price || 0), 0),
          0
        )
        return sum + (Number(line.price) + choicesTotal) * line.quantity
      }, 0),
    [items]
  )
  const deliveryFee = job.deliveryFee ?? 0
  const isPickup = job.placeOfService === "pickup"
  const orderDiscount = job.orderDiscount ?? 0
  const total = subtotal + deliveryFee - orderDiscount

  const renderLine = (line: JobFoodOrderItemType) => {
    const optionsSummary = (line.selectedOptions ?? [])
      .flatMap((option) => option.choices.map((choice) => choice.name))
      .join(", ")
    const choicesTotal = (line.selectedOptions ?? []).reduce(
      (s, option) => s + option.choices.reduce((cs, c) => cs + (c.price || 0), 0),
      0
    )
    return (
      <DmView
        key={line.id}
        className="flex-row items-start justify-between mt-[10]"
      >
        <DmView className="flex-1 mr-[10]">
          <DmText className="text-13 leading-[17px] font-custom500">
            {line.quantity}× {line.name}
          </DmText>
          {!!optionsSummary && (
            <DmText
              className="mt-[2] text-11 leading-[15px] font-custom400 text-grey2"
              numberOfLines={2}
            >
              {optionsSummary}
            </DmText>
          )}
        </DmView>
        <DmText className="text-13 leading-[17px] font-custom500">
          {formatMoney((Number(line.price) + choicesTotal) * line.quantity)}{" "}
          {t("EGP")}
        </DmText>
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Status */}
      {isCancelled ? (
        <DmView className="p-[14] rounded-12 bg-pink1">
          <DmText className="text-15 leading-[19px] font-custom700 text-red">
            {t("order_cancelled")}
          </DmText>
          {!!jobPro?.foodOrderCancelReason && (
            <DmText className="mt-[4] text-12 leading-[16px] font-custom400 text-red">
              {t(`food_cancel_${jobPro.foodOrderCancelReason}`)}
            </DmText>
          )}
        </DmView>
      ) : (
        <DmView className="p-[14] rounded-12 border-0.5 border-grey14">
          <DmText className="text-15 leading-[19px] font-custom700">
            {currentStep >= 0
              ? stepLabels[STEPS[currentStep]]
              : t("order_placed")}
          </DmText>
          {currentStep < 0 && (
            <DmText className="mt-[3] text-12 leading-[16px] font-custom400 text-grey2">
              {t("order_placed_descr")}
            </DmText>
          )}
          {/* Timeline */}
          <DmView className="mt-[14] flex-row items-center">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step}>
                {idx > 0 && (
                  <DmView
                    className="flex-1 h-[2] mx-[4]"
                    style={{
                      backgroundColor:
                        idx <= currentStep ? colors.red : colors.grey14,
                    }}
                  />
                )}
                <DmView
                  className="w-[14] h-[14] rounded-full"
                  style={{
                    backgroundColor:
                      idx <= currentStep ? colors.red : colors.grey14,
                  }}
                />
              </React.Fragment>
            ))}
          </DmView>
          <DmView className="mt-[6] flex-row justify-between">
            <DmText className="text-10 leading-[13px] font-custom400 text-grey2">
              {stepLabels.accepted}
            </DmText>
            <DmText className="text-10 leading-[13px] font-custom400 text-grey2">
              {stepLabels.delivered}
            </DmText>
          </DmView>
        </DmView>
      )}

      {/* Items + totals */}
      <DmView className="mt-[16] p-[14] rounded-12 bg-grey36">
        <DmText className="text-14 leading-[18px] font-custom700">
          {t("order_summary")}
        </DmText>
        {items.map(renderLine)}
        <DmView className="h-[0.7] bg-grey14 mt-[12]" />
        {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
        {/* A pickup order carries no fee, and 0 renders as "Free". */}
        {!isPickup &&
          totalsRow(
            t("delivery_fee"),
            deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
          )}
        {orderDiscount > 0 &&
          totalsRow(t("discount"), `- ${formatMoney(orderDiscount)} ${t("EGP")}`)}
        {totalsRow(t("total"), `${formatMoney(total)} ${t("EGP")}`, true)}
      </DmView>

      {/* Payment + notes + address */}
      <DmView className="mt-[16] p-[14] rounded-12 border-0.5 border-grey14">
        <DmView className="flex-row items-center justify-between">
          <DmText className="text-13 leading-[17px] font-custom400 text-grey2">
            {t("payment_method")}
          </DmText>
          <DmText className="text-13 leading-[17px] font-custom600">
            {job.paymentMethod === "creditCard"
              ? t("card_on_delivery")
              : t("cash_on_delivery")}
          </DmText>
        </DmView>
        {!!job.orderNotes && (
          <>
            <DmView className="h-[0.5] bg-grey14 my-[10]" />
            <DmText className="text-13 leading-[17px] font-custom400 text-grey2">
              {t("order_notes")}
            </DmText>
            <DmText className="mt-[4] text-13 leading-[18px] font-custom500">
              {job.orderNotes}
            </DmText>
          </>
        )}
        {!!job.address?.address?.streetAddress && (
          <>
            <DmView className="h-[0.5] bg-grey14 my-[10]" />
            <DmText className="text-13 leading-[17px] font-custom400 text-grey2">
              {t("deliver_to")}
            </DmText>
            <DmText className="mt-[4] text-13 leading-[18px] font-custom500">
              {job.address.address.streetAddress}
            </DmText>
          </>
        )}
      </DmView>

      {/* Cancel — only before the pro starts preparing */}
      {canCancel && (
        <DmView
          onPress={isCancelling ? undefined : handleCancel}
          className="mt-[20] h-[48] rounded-12 border-1 border-red items-center justify-center"
        >
          <DmText className="text-15 leading-[19px] font-custom600 text-red">
            {isCancelling ? t("cancelling") : t("cancel_order")}
          </DmText>
        </DmView>
      )}
    </ScrollView>
  )
}

export default FoodOrderView
