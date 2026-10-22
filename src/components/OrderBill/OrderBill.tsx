import React from "react"
import { useTranslation } from "react-i18next"
import type { StyleProp, ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"
import { Text, a, px, type DsTextStyle } from "@tappler/shared/src/ds"
import { formatMoney } from "store/cart/slice"
import { JobType } from "types/job"
import styles from "./styles"

// The bill's root as a slot: a caller's className, then `style` (see
// classNameSlots). It has no styles of its own.
const Root = classNameSlot(DmView)

interface Props {
  job: JobType
  /** Pickup orders have no delivery fee line — the customer collects. */
  isPickup?: boolean
  /** The bill, as classes. */
  className?: string
  /**
   * The bill, as a style, after `className`. Like every twin it takes one key
   * per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
  /**
   * Applied to every text here. Callers inside a right-to-left layout pass
   * their own alignment style (see MessagesDetailsScreen's `rtlText`), because
   * DmText hardcodes `text-left` into its base className and a className
   * override does not reliably beat it — the `style` prop does.
   *
   * Without this the bill was the one block in the chat sheet aligning
   * differently from every row directly above it in Arabic.
   */
  textStyle?: StyleProp<DsTextStyle>
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
  style,
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
    <DmView key={label} style={[a.flex_row, a.items_center, a.justify_between, a.mb_6]}>
      <Text
        size={13}
        weight={bold ? "bold" : "regular"}
        leading={px(17)}
        color={bold ? "primary" : "secondary"}
        style={textStyle}
      >
        {label}
      </Text>
      <Text
        size={13}
        weight={bold ? "bold" : "medium"}
        leading={px(17)}
        style={textStyle}
      >
        {value}
      </Text>
    </DmView>
  )

  return (
    <Root className={className} style={style}>
      <Text
        size={13}
        weight="semibold"
        leading="tight"
        style={[a.mb_10, textStyle]}
      >
        {t("order_details")}
      </Text>

      {items.map((line) => {
        const choiceNames = (line.selectedOptions ?? []).flatMap((option) =>
          option.choices.map((choice) => choice.name)
        )
        return (
          <DmView
            key={line.id}
            style={[a.flex_row, a.items_start, a.justify_between, a.mb_8]}
          >
            <DmView style={[a.flex_1, a.mr_10]}>
              <Text size={13} weight="medium" leading={px(17)} style={textStyle}>
                {line.quantity}× {line.name}
              </Text>
              {!!choiceNames.length && (
                <Text size={11} color="secondary" style={[a.mt_2, textStyle]}>
                  {choiceNames.join(", ")}
                </Text>
              )}
            </DmView>
            <Text size={13} weight="medium" leading={px(17)} style={textStyle}>
              {formatMoney((Number(line.price) + choicesTotalFor(line)) * line.quantity)}{" "}
              {t("EGP")}
            </Text>
          </DmView>
        )
      })}

      <DmView style={[styles.box, a.mt_6, a.mb_8]} />
      {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
      {!isPickup &&
        totalsRow(
          t("delivery_fee"),
          deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
        )}
      {orderDiscount > 0 &&
        totalsRow(t("discount"), `- ${formatMoney(orderDiscount)} ${t("EGP")}`)}
      {totalsRow(t("order_total"), `${formatMoney(orderTotal)} ${t("EGP")}`, true)}
    </Root>
  )
}

export default OrderBill
