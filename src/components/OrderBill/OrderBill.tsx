import React from "react"
import { useTranslation } from "react-i18next"
import { StyleProp, TextStyle } from "react-native"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { formatMoney } from "store/cart/slice"
import { JobType } from "types/job"

interface Props {
  job: JobType
  /** Pickup orders have no delivery fee line — the customer collects. */
  isPickup?: boolean
  className?: string
  /**
   * Applied to every DmText here. Callers inside a right-to-left layout pass
   * their own alignment style (see MessagesDetailsScreen's `rtlText`), because
   * DmText hardcodes `text-left` into its base className and a className
   * override does not reliably beat it — the `style` prop does.
   *
   * Without this the bill was the one block in the chat sheet aligning
   * differently from every row directly above it in Arabic.
   */
  textStyle?: StyleProp<TextStyle>
}

/**
 * The itemised bill for a food order: lines, options, subtotal, delivery fee,
 * discount, total.
 *
 * Written as a component rather than a fourth inline copy. The same maths
 * already exists inline in RequestDetailsScreen and FoodOrderView, and the
 * chat's "My Request" sheet needed it too — three copies of a money
 * calculation is how one order ends up showing two different totals, which is
 * precisely what the PRO app was doing: summing `price × quantity` and calling
 * it "Total", with no option prices, delivery fee or discount.
 *
 * To be clear about what this is NOT yet: those two existing screens still
 * carry their own copies. They work and they agree with this one, so replacing
 * them is a follow-up worth doing deliberately rather than folded into a bug
 * fix — but until that happens this is a third implementation, not a single
 * source of truth, and it has to be kept in step with them by hand.
 *
 * Takes only `job`, deliberately. Every caller already has one, so there is no
 * new query and nothing to thread through — and it stays a pure function of
 * the payload rather than something with its own opinions about loading.
 *
 * Note what is NOT here: the pro header card, the status timeline, the
 * collapse chrome. Those need relations that not every caller's endpoint
 * loads, and dragging them in would turn a zero-data-change fix into a
 * backend change.
 */
const OrderBill: React.FC<Props> = ({
  job,
  isPickup = false,
  className = "",
  textStyle,
}) => {
  const { t } = useTranslation()

  const items = job?.foodOrderItems ?? []
  if (!items.length) return null

  // Option/choice prices count toward the line, which is the part the pro
  // app's version drops.
  const choicesTotalFor = (line: (typeof items)[number]) =>
    (line.selectedOptions ?? []).reduce(
      (sum, option) =>
        sum + option.choices.reduce((cs, c) => cs + (c.price || 0), 0),
      0
    )

  const subtotal = items.reduce(
    (sum, line) => sum + (Number(line.price) + choicesTotalFor(line)) * line.quantity,
    0
  )
  const deliveryFee = job?.deliveryFee ?? 0
  const orderDiscount = job?.orderDiscount ?? 0
  const orderTotal = subtotal + deliveryFee - orderDiscount

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView key={label} className="flex-row items-center justify-between mb-[6]">
      <DmText
        style={textStyle}
        className={`text-13 leading-[17px] ${
          bold ? "font-custom700" : "font-custom400 text-grey2"
        }`}
      >
        {label}
      </DmText>
      <DmText
        style={textStyle}
        className={`text-13 leading-[17px] ${
          bold ? "font-custom700" : "font-custom500"
        }`}
      >
        {value}
      </DmText>
    </DmView>
  )

  return (
    <DmView className={className}>
      <DmText style={textStyle} className="mb-[10] text-13 leading-[16px] font-custom600">
        {t("order_details")}
      </DmText>

      {items.map((line) => {
        const choiceNames = (line.selectedOptions ?? []).flatMap((option) =>
          option.choices.map((choice) => choice.name)
        )
        return (
          <DmView
            key={line.id}
            className="flex-row items-start justify-between mb-[8]"
          >
            <DmView className="flex-1 mr-[10]">
              <DmText style={textStyle} className="text-13 leading-[17px] font-custom500">
                {line.quantity}× {line.name}
              </DmText>
              {!!choiceNames.length && (
                <DmText style={textStyle} className="mt-[2] text-11 leading-[15px] font-custom400 text-grey2">
                  {choiceNames.join(", ")}
                </DmText>
              )}
            </DmView>
            <DmText style={textStyle} className="text-13 leading-[17px] font-custom500">
              {formatMoney((Number(line.price) + choicesTotalFor(line)) * line.quantity)}{" "}
              {t("EGP")}
            </DmText>
          </DmView>
        )
      })}

      <DmView className="h-[0.7] bg-grey14 mt-[6] mb-[8]" />
      {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
      {!isPickup &&
        totalsRow(
          t("delivery_fee"),
          deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
        )}
      {orderDiscount > 0 &&
        totalsRow(t("discount"), `- ${formatMoney(orderDiscount)} ${t("EGP")}`)}
      {totalsRow(t("order_total"), `${formatMoney(orderTotal)} ${t("EGP")}`, true)}
    </DmView>
  )
}

export default OrderBill
