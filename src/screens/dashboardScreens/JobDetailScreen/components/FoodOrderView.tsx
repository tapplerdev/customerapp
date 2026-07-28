import React, { useMemo, useState } from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import CachedImage from "@tappler/shared/src/components/CachedImage"
import {
  LayoutAnimation,
  Platform,
  ScrollView,
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

import styles from "./styles"

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
export const canCancelFoodOrder = (job: JobType): boolean => {
  const status = job.pros?.[0]?.status
  const isCancelled = status === "cancelled" || job.status === "cancelled"
  return !isCancelled && STEPS.indexOf(status as (typeof STEPS)[number]) < 1
}

const STEPS = ["accepted", "preparing", "withDeliveryCourier", "delivered"] as const

const FoodOrderView: React.FC<Props> = ({ job, unreadCount = 0, onOpenChat }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const jobPro = job.pros?.[0]
  const status = jobPro?.status
  const isCancelled = status === "cancelled" || job.status === "cancelled"
  const currentStep = STEPS.indexOf(status as (typeof STEPS)[number])

  const stepLabels: Record<(typeof STEPS)[number], string> = {
    accepted: t("order_accepted"),
    preparing: t("order_preparing"),
    withDeliveryCourier: t("order_out_for_delivery"),
    delivered: t("order_delivered"),
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
  const headlineStatus = isCancelled
    ? t("cancelled")
    : currentStep >= 0
      ? stepLabels[STEPS[currentStep]]
      : t("order_sent_to_pro")

  const [isDetailsOpen, setDetailsOpen] = useState(true)

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

  // Label above value, hidden entirely when there is nothing to say — an
  // empty "Order Notes" heading is worse than no heading.
  const detailRow = (label: string, value?: string | null) =>
    !!value && (
      <DmView className="mt-[14]">
        <DmText className="text-13 leading-[17px] font-custom700">{label}</DmText>
        <DmText className="mt-[3] text-13 leading-[18px] font-custom400">
          {value}
        </DmText>
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
    <DmView className="flex-row items-center justify-between mt-[8]">
      <DmText
        className={
          bold
            ? "text-13 leading-[17px] font-custom700"
            : "text-13 leading-[17px] font-custom400 text-grey2"
        }
      >
        {label}
      </DmText>
      <DmText
        className={
          bold
            ? "text-13 leading-[17px] font-custom700"
            : "text-13 leading-[17px] font-custom500"
        }
        style={negative ? { color: colors.red } : undefined}
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
      {/* Who the order is with — photo, name, headline status and the running
          total, matching the design's header card. */}
      <DmView className="flex-row">
        <CachedImage
          uri={pro?.profilePhoto150 || pro?.profilePhoto || undefined}
          style={styles.proPhoto}
          resizeMode="cover"
          withSkeleton
        />
        <DmView className="flex-1 ml-[12] justify-center">
          <DmText className="text-14 leading-[18px] font-custom700" numberOfLines={1}>
            {proName}
          </DmText>
          <DmView className="mt-[4] flex-row items-center">
            {/* Label bold and black, value regular and coloured — the design
                weights the two differently on purpose. */}
            <DmText className="text-14 leading-[18px] font-custom700">
              {t("status")}:{" "}
            </DmText>
            <DmText
              className="flex-1 text-14 leading-[18px] font-custom400"
              style={{ color: isCancelled ? colors.red : colors.green }}
              numberOfLines={1}
            >
              {headlineStatus}
            </DmText>
          </DmView>
          <DmView className="mt-[8] flex-row items-center">
            <DmView className="px-[14] py-[5] rounded-20 border-1 border-red">
              <DmText className="text-14 leading-[18px] font-custom700">
                {t("total")}
              </DmText>
            </DmView>
            <DmText className="ml-[10] flex-1 text-14 leading-[18px] font-custom700">
              {formatMoney(total)} {t("EGP")}
            </DmText>
            {!!onOpenChat && (
              <DmView className="pl-[8]" onPress={onOpenChat}>
                <MailIcon width={24} height={24} />
                {unreadCount > 0 && (
                  <DmView className="absolute -top-[6] -right-[6] min-w-[16] h-[16] px-[4] rounded-full bg-red items-center justify-center">
                    <DmText className="text-9 font-custom700 text-white">
                      {unreadCount}
                    </DmText>
                  </DmView>
                )}
              </DmView>
            )}
          </DmView>
        </DmView>
      </DmView>

      {/* Individual · trust stickers · Offers — the same trio the pro card and
          profile show, so the customer sees consistent credentials. */}
      <DmView className="mt-[14] flex-row items-center flex-wrap">
        <DmView className="flex-row items-center mr-[14]">
          {isCompany ? (
            <BusinessIcon width={16} height={16} />
          ) : (
            <IndividualIcon width={16} height={16} />
          )}
          <DmText className="ml-[4] text-12 leading-[16px] font-custom700">
            {t(isCompany ? "business" : "individual")}
          </DmText>
        </DmView>
        {trustDocs.map((doc: any) => (
          <DmView key={doc.id} className="mr-[14]">
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
        <DmView className="mt-[12]">
          <OffersSection subscriptions={subscriptions} compact />
        </DmView>
      )}

      <DmView className="h-[0.5] bg-grey19 mt-[16]" />

      {/* Status */}
      <DmView className="mt-[16]" />
      {isCancelled ? (
        !!jobPro?.foodOrderCancelReason && (
          <DmView className="p-[14] rounded-12 bg-pink1">
            <DmText className="text-12 leading-[16px] font-custom400 text-red">
              {t(`food_cancel_${jobPro.foodOrderCancelReason}`)}
            </DmText>
          </DmView>
        )
      ) : (
        <DmView className="p-[14] rounded-12 border-0.5 border-grey14">
          {/* No headline here — the pro card above already states the status,
              and printing it twice on one screen reads as a bug. This keeps
              only what the card cannot say: what happens next. */}
          {currentStep < 0 && (
            <DmText className="text-12 leading-[16px] font-custom400 text-grey2">
              {t("order_placed_descr")}
            </DmText>
          )}
          {/* Timeline */}
          <DmView
            className={`flex-row items-center ${currentStep < 0 ? "mt-[14]" : ""}`}
          >
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

      {/* Everything below the fold, in the design's order: where, when, how
          paid, notes, then the itemised bill. Collapsible because the status
          is the answer on a repeat visit and the bill is the answer once. */}
      <DmView
        className="mt-[18] flex-row items-center justify-center"
        onPress={() => {
          LayoutAnimation.configureNext(detailsTransition)
          setDetailsOpen((open) => !open)
        }}
      >
        <DmText className="text-13 leading-[17px] font-custom600 text-red">
          {t(isDetailsOpen ? "hide_order_details" : "show_order_details")}
        </DmText>
        <DmText className="ml-[6] text-13 leading-[17px] font-custom600 text-red">
          {isDetailsOpen ? "\u2303" : "\u2304"}
        </DmText>
      </DmView>

      {isDetailsOpen && (
        <DmView className="mt-[14]">
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

          <DmText className="mt-[18] text-14 leading-[18px] font-custom700">
            {t("order_details")}
          </DmText>
          {items.map(renderLine)}

          <DmView className="h-[0.7] bg-grey14 mt-[14]" />
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

    </ScrollView>
  )
}

export default FoodOrderView
