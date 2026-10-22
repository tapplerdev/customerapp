import React, { useMemo, useRef, useState } from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import CachedImage from "@tappler/shared/src/components/CachedImage"
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native"

import { useTranslation } from "react-i18next"
import { formatMoney } from "store/cart/slice"
import { JobFoodOrderItemType, JobType } from "types/job"
import colors from "@tappler/shared/src/styles/colors"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import OffersSection from "components/OffersSection/OffersSection"

import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MailIcon from "assets/icons/mail.svg"
import ChevronDownSolidIcon from "assets/icons/chevron-down-solid.svg"

import styles from "./styles"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"

interface Props {
  job: JobType
  // Resolved by JobDetailScreen from the chats cache — the order payload has
  // no chat data of its own.
  unreadCount?: number
  onOpenChat?: () => void
}

// Order-centric detail body for food (hasMenu) jobs: status timeline driven
// by the pro's jobPro.status, then the itemized breakdown with the
// server-persisted totals. Live updates ride the existing socket → Jobs
// cache invalidation; the screen's re-focus refetch is the safety net.
// Same preset MapPickerWithSearchView uses for its search-mode collapse, so
// the two behave alike. Android needs the flag switched on once.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const detailsTransition = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
}

// Exported so the header's ••• menu can gate its Cancel row on the same rule
// the body used to, rather than re-deriving it and drifting.
//
// This is a HINT, not the decision. It runs against a cached status, so the
// kitchen can start cooking between the cache landing and the customer tapping
// Yes. The server enforces the same cutoff (UNCANCELLABLE_FOOD_ORDER_STATUSES)
// and answers 409; this only decides whether to offer the button.
export const canCancelFoodOrder = (job: JobType): boolean => {
  const jobPro = job.pros?.[0]
  const status = jobPro?.status
  const isCancelled = status === "cancelled" || job.status === "cancelled"
  // A declined order has nothing left to cancel. It used to pass this check —
  // a decline leaves `status` unset, so indexOf returned -1 — and the ••• menu
  // went on offering Cancel for an order the restaurant had already refused.
  //
  const isDeclined =
    jobPro?.selectionStatus === "proRejected" || job.status === "declined"

  // WHITELIST, not a blacklist.
  //
  // This used to be `!isCancelled && !isDeclined && step < 1`, which asks "is
  // it one of the dead states I thought of?" — and every state nobody thought
  // of falls through as cancellable. `ended` (the expiry cron) and
  // `cancelledByTappler` both did: jobPro.status is unset on them, so
  // STEPS.indexOf(undefined) is -1, and the ••• menu offered "Cancel order" on
  // an order that had already expired or been pulled by moderation.
  //
  // That is not cosmetic. The cancel writes job.status = "cancelled", the one
  // value the backend counts against the customer in its auto-suspension
  // policy — so the customer collects a strike for cancelling something that
  // was already dead.
  //
  // Asking "is it live?" cannot leak that way, and it matches how the service
  // path has always gated the same menu (JobDetailScreen: status === "active").
  return (
    job.status === "active" &&
    !isCancelled &&
    !isDeclined &&
    !UNCANCELLABLE_FOOD_STATUSES.includes(status ?? "")
  )
}

/**
 * Mirrors UNCANCELLABLE_FOOD_ORDER_STATUSES on the backend, which is the rule
 * that actually holds — this only decides whether the Cancel item is offered.
 *
 * Past `preparing` the kitchen has committed ingredients, so only the
 * restaurant can pull the order, with a reason. Written as a list rather than
 * "index < 1" into the timeline, because that timeline is now
 * fulfilment-dependent and its stage-two entry differs by mode, while this
 * rule does not.
 */
const UNCANCELLABLE_FOOD_STATUSES: string[] = [
  "preparing",
  "withDeliveryCourier",
  "readyForPickup",
  "delivered",
]

/**
 * Written into the job's cancelReasons. A stable marker rather than a
 * sentence: the previous value was English prose sent regardless of the
 * customer's language, which left the admin dashboard with a reason it could
 * neither translate nor tell apart from free text somebody typed.
 */
export const CUSTOMER_CANCELLED_FOOD_ORDER = "customer_cancelled_food_order"

/**
 * The four stages of the order, worded for how it reaches the customer.
 *
 * Stage three differs by fulfilment: a delivery order is with a courier, a
 * pickup order is waiting on the counter. The backend refuses whichever of the
 * two does not match the order's placeOfService, so a given order only ever
 * carries one of them — but the timeline has to know which one to look for, or
 * a pickup order sits at "Preparing" through a stage it has already passed.
 *
 * Stage four is one status either way; only the label changes.
 */
const STEPS_FOR = (isPickup: boolean) =>
  [
    "accepted",
    "preparing",
    isPickup ? "readyForPickup" : "withDeliveryCourier",
    "delivered",
  ] as const

const FoodOrderView: React.FC<Props> = ({ job, unreadCount = 0, onOpenChat }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const jobPro = job.pros?.[0]
  const status = jobPro?.status
  const isCancelled = status === "cancelled" || job.status === "cancelled"
  // The restaurant turned the order down. This lives on selectionStatus, a
  // different axis from `status` — `status` is the kitchen workflow
  // (accepted → preparing → …) and is never set at all on a decline, while
  // job.status stays `active` because the customer's request is still live as
  // far as the job is concerned.
  //
  // So a declined order fell through every branch below: not cancelled, no
  // step, and the headline read "Order sent to Pro" indefinitely. The customer
  // got the push saying the restaurant declined, opened the order, and the
  // screen told them it was still sitting with the restaurant.
  //
  // job.status === "declined" is the backend's own terminal marker for a food
  // order nobody can deliver any more. It is checked ALONGSIDE proRejected,
  // not instead of it: historical rows carry proRejected with job.status still
  // `active`, and dropping that limb would regress every one of them.
  //
  // `isCancelled` above is deliberately untouched, and it DOES win over this
  // when a restaurant cancelled an order it had already accepted — that sets
  // jobPro.status = "cancelled" while the job goes terminal, so both are true
  // and `isCancelled` is evaluated first. That is the outcome we want: the
  // cancelled branch shows the restaurant's actual reason, which is more use
  // to the customer than generic decline copy.
  //
  // Do not "simplify" isCancelled by dropping its job.status limb either. That
  // limb is the only signal for a CUSTOMER cancel — foodOrderCancelReason is
  // written solely by the restaurant — and without it the status block
  // collapses and the screen goes blank below the header.
  const isDeclined =
    jobPro?.selectionStatus === "proRejected" || job.status === "declined"
  // Declared here rather than beside the money below, because the timeline
  // above needs it and reads first.
  const isPickup = job.placeOfService === "pickup"
  const STEPS = STEPS_FOR(isPickup)
  const currentStep = (STEPS as readonly string[]).indexOf(status ?? "")

  const stepLabels: Record<string, string> = {
    accepted: t("order_accepted"),
    preparing: t("order_preparing"),
    withDeliveryCourier: t("order_out_for_delivery"),
    readyForPickup: t("order_ready_for_pickup"),
    delivered: t(isPickup ? "order_picked_up" : "order_delivered"),
  }

  // Pro identity for the header card. Everything here already rides on the
  // job (CustomerJobDetailsRelations loads prosProfilePhoto / prosDocuments /
  // prosServiceCategories), so no extra request.
  const pro = jobPro?.pro
  const isCompany = pro?.proType === "company"
  const proName =
    pro?.screenName || (isCompany ? pro?.businessName : pro?.registeredName) || ""
  const trustDocs = (pro?.documents ?? []).filter(
    (doc: any) => doc.type === "trust" && doc.status === "approved"
  )
  const subscriptions = pro?.serviceCategories?.[0]?.subscriptions ?? []

  // The design's static "Status: Accepted by Pro" line — the timeline below
  // carries the detail, this is the one-glance answer.
  // Declined is checked BEFORE the step lookup but after cancelled: if the
  // order was somehow both, cancelled is the later and more final fact.
  const headlineStatus = isCancelled
    ? t("cancelled")
    : isDeclined
      ? t("order_declined_by_restaurant")
      : currentStep >= 0
        ? stepLabels[STEPS[currentStep]]
        : t("order_sent_to_pro")

  const [isDetailsOpen, setDetailsOpen] = useState(true)

  // The chevron rides the same 220ms ease-in-ease-out as detailsTransition, so
  // the arrow turning and the section opening read as one motion rather than
  // two. Starts at 1 because the section starts open (chevron pointing up).
  const chevronSpin = useRef(new Animated.Value(isDetailsOpen ? 1 : 0)).current
  const chevronRotation = chevronSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  })

  const toggleDetails = () => {
    const nextOpen = !isDetailsOpen
    LayoutAnimation.configureNext(detailsTransition)
    setDetailsOpen(nextOpen)
    Animated.timing(chevronSpin, {
      toValue: nextOpen ? 1 : 0,
      duration: detailsTransition.duration,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start()
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
        style={[a.flex_row, a.items_start, a.justify_between, a.mt_10]}
      >
        <DmView style={[a.flex_1, a.mr_10]}>
          <Text size={13} weight="medium" leading={px(17)}>
            {line.quantity}× {line.name}
          </Text>
          {!!optionsSummary && (
            <Text
              size={11}
              color="secondary"
              style={a.mt_2}
              numberOfLines={2}
            >
              {optionsSummary}
            </Text>
          )}
        </DmView>
        <Text size={13} weight="medium" leading={px(17)}>
          {formatMoney((Number(line.price) + choicesTotal) * line.quantity)}{" "}
          {t("EGP")}
        </Text>
      </DmView>
    )
  }

  // Label above value, hidden entirely when there is nothing to say — an
  // empty "Order Notes" heading is worse than no heading.
  const detailRow = (label: string, value?: string | null) =>
    !!value && (
      <DmView style={a.mt_14}>
        <Text size={13} weight="bold" leading={px(17)}>{label}</Text>
        <Text size={13} style={styles.text}>
          {value}
        </Text>
      </DmView>
    )

  // The wire nests this (address.address.*); city/governorate fill in when
  // there is no street line, so the row never collapses to nothing.
  const addressLabel = [
    job.address?.address?.streetAddress,
    job.address?.address?.city,
    job.address?.address?.governorate,
  ]
    .filter(Boolean)
    .join(", ")

  // "asap" carries no dates at all — say so rather than leaving it blank.
  const whenLabel = useMemo(() => {
    const date = job.dates?.[0]?.date
    if (!date) {
      return job.dateType === "asap"
        ? t(isPickup ? "pick_up_now" : "deliver_now")
        : ""
    }
    const when = new Date(date)
    const day = when.toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    const slot = job.timeSlots?.[0]
    if (!slot) return day

    // The wire sends time columns as "09:00:00" — seconds are noise, and the
    // rest of the flow reads 12-hour. Same shape as the checkout label.
    const clock = (value: string) => {
      const [hour, minute] = value.split(":").map(Number)
      return {
        text: `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}`,
        suffix: hour >= 12 ? t("pm") : t("am"),
      }
    }
    const from = clock(slot.start)
    const endsAtMidnight = slot.end.startsWith("00:")
    const to = endsAtMidnight ? { text: "12", suffix: t("am") } : clock(slot.end)
    const window =
      !endsAtMidnight && from.suffix === to.suffix
        ? `${from.text} - ${to.text} ${to.suffix}`
        : `${from.text} ${from.suffix} - ${to.text} ${to.suffix}`

    return `${day} · ${window}`
  }, [job.dates, job.timeSlots, job.dateType, isPickup, isAr, t])

  const totalsRow = (
    label: string,
    value: string,
    bold?: boolean,
    negative?: boolean
  ) => (
    <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mt_8]}>
      <Text
        size={13}
        weight={bold ? "bold" : "regular"}
        leading={px(17)}
        color={bold ? "primary" : "secondary"}
      >
        {label}
      </Text>
      <Text
        size={13}
        weight={bold ? "bold" : "medium"}
        leading={px(17)}
        style={negative ? { color: colors.red } : undefined}
      >
        {value}
      </Text>
    </DmView>
  )

  return (
    <AppScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Who the order is with — photo, name, headline status and the running
          total, matching the design's header card. */}
      <DmView style={a.flex_row}>
        <CachedImage
          uri={pro?.profilePhoto150 || pro?.profilePhoto || undefined}
          style={styles.proPhoto}
          resizeMode="cover"
          withSkeleton
        />
        <DmView style={[a.flex_1, a.ml_12, a.justify_center]}>
          <Text size={14} weight="bold" numberOfLines={1}>
            {proName}
          </Text>
          <DmView style={[a.mt_4, a.flex_row, a.items_center]}>
            {/* Label bold and black, value regular and coloured — the design
                weights the two differently on purpose. */}
            <Text size={14} weight="bold">
              {t("status")}:{" "}
            </Text>
            <Text
              size={14}
              // Green is for an order that is alive and moving. Declined is
              // neither, so it reads red like cancelled — the two are the same
              // news to the customer: this order is not happening.
              style={[a.flex_1, {
                color: isCancelled || isDeclined ? colors.red : colors.green,
              }]}
              numberOfLines={1}
            >
              {headlineStatus}
            </Text>
          </DmView>
          <DmView style={[a.mt_8, a.flex_row, a.items_center]}>
            <DmView style={[a.px_14, styles.totalWrap, a.border_1]}>
              <Text size={14} weight="bold">
                {t("total")}
              </Text>
            </DmView>
            <Text size={14} weight="bold" style={[a.ml_10, a.flex_1]}>
              {formatMoney(total)} {t("EGP")}
            </Text>
            {!!onOpenChat && (
              <DmView style={a.pl_8} onPress={onOpenChat}>
                <MailIcon width={24} height={24} />
                {unreadCount > 0 && (
                  <DmView style={[a.absolute, styles.textWrap, a.px_4, a.items_center, a.justify_center]}>
                    <Text size={9} weight="bold" leading="legacy" color="inverse">
                      {unreadCount}
                    </Text>
                  </DmView>
                )}
              </DmView>
            )}
          </DmView>
        </DmView>
      </DmView>

      {/* Individual · trust stickers · Offers — the same trio the pro card and
          profile show, so the customer sees consistent credentials. */}
      <DmView style={[a.mt_14, a.flex_row, a.items_center, a.flex_wrap]}>
        <DmView style={[a.flex_row, a.items_center, a.mr_14]}>
          {isCompany ? (
            <BusinessIcon width={16} height={16} />
          ) : (
            <IndividualIcon width={16} height={16} />
          )}
          <Text size={12} weight="bold" style={a.ml_4}>
            {t(isCompany ? "business" : "individual")}
          </Text>
        </DmView>
        {trustDocs.map((doc: any) => (
          <DmView key={doc.id} style={a.mr_14}>
            <SvgUriContainer
              width={140}
              height={30}
              uri={
                isAr
                  ? doc.trustDocumentData?.trustProduct?.pictureAr
                  : doc.trustDocumentData?.trustProduct?.pictureEn
              }
            />
          </DmView>
        ))}
      </DmView>

      {!!subscriptions.length && (
        <DmView style={a.mt_12}>
          <OffersSection subscriptions={subscriptions} compact />
        </DmView>
      )}

      <DmView style={[styles.box, a.mt_16]} />

      {/* Status */}
      <DmView style={a.mt_16} />
      {isCancelled ? (
        // foodOrderCancelReason is only ever written by the RESTAURANT's
        // cancel. When the CUSTOMER cancels there is no reason, and this
        // rendered `false` — so the whole status block collapsed and the
        // screen went blank below the header. Say who cancelled instead.
        <DmView style={[a.p_14, styles.textWrap2]}>
          <Text size={12} color="brand">
            {jobPro?.foodOrderCancelReason
              ? t(`food_cancel_${jobPro.foodOrderCancelReason}`)
              : t("order_cancelled_descr")}
          </Text>
        </DmView>
      ) : isDeclined ? (
        // Deliberately NOT jobPro.rejectReason. Those options are written for
        // the restaurant to pick from and one of them is
        // "customer has history of non-payment or abuse" — not something to
        // show the customer about themselves. They get the fact and a way
        // forward; the reason stays between the restaurant and the dashboard.
        <DmView style={[a.p_14, styles.textWrap2]}>
          <Text size={12} color="brand">
            {t("order_declined_descr")}
          </Text>
        </DmView>
      ) : (
        <DmView style={[a.p_14, styles.box2]}>
          {/* No headline here — the pro card above already states the status,
              and printing it twice on one screen reads as a bug. This keeps
              only what the card cannot say: what happens next. */}
          {currentStep < 0 && (
            <Text size={12} color="secondary">
              {t("order_placed_descr")}
            </Text>
          )}
          {/* Timeline */}
          <DmView
            style={[a.flex_row, a.items_center, currentStep < 0 && a.mt_14]}
          >
            {STEPS.map((step, idx) => (
              <React.Fragment key={step}>
                {idx > 0 && (
                  <DmView
                    style={[a.flex_1, styles.box3, a.mx_4, {
                      backgroundColor:
                        idx <= currentStep ? colors.red : colors.grey14,
                    }]}
                  />
                )}
                <DmView
                  style={[styles.box4, {
                    backgroundColor:
                      idx <= currentStep ? colors.red : colors.grey14,
                  }]}
                />
              </React.Fragment>
            ))}
          </DmView>
          <DmView style={[a.mt_6, a.flex_row, a.justify_between]}>
            <Text size={10} color="secondary">
              {stepLabels.accepted}
            </Text>
            <Text size={10} color="secondary">
              {stepLabels.delivered}
            </Text>
          </DmView>
        </DmView>
      )}

      {/* Everything below the fold, in the design's order: where, when, how
          paid, notes, then the itemised bill. Collapsible because the status
          is the answer on a repeat visit and the bill is the answer once. */}
      <DmView
        style={[a.mt_18, a.flex_row, a.items_center, a.justify_center]}
        onPress={toggleDetails}
      >
        <Text size={13} weight="semibold" leading={px(17)} color="brand">
          {t(isDetailsOpen ? "hide_order_details" : "show_order_details")}
        </Text>
        <Animated.View
          style={[
            styles.detailsChevron,
            { transform: [{ rotate: chevronRotation }] },
          ]}
        >
          <ChevronDownSolidIcon width={14} height={14} color={colors.red} />
        </Animated.View>
      </DmView>

      {isDetailsOpen && (
        <DmView style={a.mt_14}>
          {detailRow(
            t(isPickup ? "pickup_from" : "delivery_address"),
            addressLabel
          )}
          {detailRow(t(isPickup ? "pickup_time" : "delivery_time"), whenLabel)}
          {detailRow(
            t("payment_method"),
            job.paymentMethod === "creditCard"
              ? t(isPickup ? "card_on_pickup" : "card_on_delivery")
              : t(isPickup ? "cash_on_pickup" : "cash_on_delivery")
          )}
          {detailRow(t("order_notes"), job.orderNotes)}

          <Text size={14} weight="bold" style={a.mt_18}>
            {t("order_details")}
          </Text>
          {items.map(renderLine)}

          <DmView style={[styles.box5, a.mt_14]} />
          {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
          {/* A pickup order carries no fee, and 0 renders as "Free". */}
          {!isPickup &&
            totalsRow(
              t("delivery_fee"),
              deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
            )}
          {orderDiscount > 0 &&
            totalsRow(
              t("discount"),
              `- ${formatMoney(orderDiscount)} ${t("EGP")}`,
              false,
              true
            )}
          {totalsRow(t("order_total"), `${formatMoney(total)} ${t("EGP")}`, true)}
        </DmView>
      )}

    </AppScrollView>
  )
}

export default FoodOrderView
