import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import OrderLocationMap from "components/OrderLocationMap/OrderLocationMap"
import { format } from "date-fns"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import {
  useGetCustomerJobDetailsQuery,
  useGetProProfileQuery,
} from "services/api"
import { formatJobSchedule } from "helpers/jobSchedule"
import { formatMoney } from "store/cart/slice"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

import CloseIcon from "assets/icons/close.svg"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

type Props = RootStackScreenProps<"RequestDetailsScreen">

const RequestDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { data: job, isLoading } = useGetCustomerJobDetailsQuery(jobId)

  const categoryName = job?.serviceCategory
    ? isAr ? job.serviceCategory.nameAr : job.serviceCategory.nameEn
    : ""

  const address = job?.address?.address
  const coords = address?.location
  const lat = coords?.lat || coords?.latitude || 0
  const lng = coords?.lng || coords?.longitude || 0
  const hasCoords = lat !== 0 && lng !== 0

  const postedDate = job?.requestedOn
    ? format(new Date(job.requestedOn), "dd/MM/yyyy h:mma")
    : ""

  const streetAddress = address?.streetAddress || ""
  const city = address?.city || ""
  const governorate = address?.governorate || ""
  const fullAddress = [streetAddress, city, governorate].filter(Boolean).join(", ")

  // Food orders are the reason this screen exists after a cancellation: it is
  // the record of what was asked for. Everything below branches on that.
  const items = job?.foodOrderItems ?? []
  const isFoodOrder = items.length > 0
  const isPickup = job?.placeOfService === "pickup"

  const dateDisplay = (() => {
    if (!job?.dates?.length) {
      if (job?.dateType === "asap") {
        return isFoodOrder
          ? t(isPickup ? "pick_up_now" : "deliver_now")
          : t("as_soon_as_possible")
      }
      return t("not_decided")
    }
    return (
      formatJobSchedule(
        job.dates,
        job.timeSlots,
        isAr ? "ar-EG" : "en-GB",
        t("am"),
        t("pm")
      ) || t("not_decided")
    )
  })()

  // A pickup order is collected FROM the pro, so their district is the useful
  // outline — the customer's own address is the wrong end of that journey.
  // Only fetched when it will actually be drawn.
  const proId = job?.pros?.[0]?.proId
  const { data: pro } = useGetProProfileQuery(
    { proId: proId ?? 0, serviceCategoryId: job?.serviceCategoryId ?? 0 },
    { skip: !isPickup || !proId || !job?.serviceCategoryId }
  )
  const proLocation = pro?.address?.address?.location
  const mapCoords = isPickup
    ? proLocation
      ? { lat: proLocation.lat, lon: proLocation.lng }
      : null
    : hasCoords
      ? { lat, lon: lng }
      : null

  const subtotal = items.reduce((sum, line) => {
    const choices = (line.selectedOptions ?? []).reduce(
      (s2, option) =>
        s2 + option.choices.reduce((cs, c) => cs + (c.price || 0), 0),
      0
    )
    return sum + (Number(line.price) + choices) * line.quantity
  }, 0)
  const deliveryFee = job?.deliveryFee ?? 0
  const orderDiscount = job?.orderDiscount ?? 0
  const orderTotal = subtotal + deliveryFee - orderDiscount

  const totalsRow = (label: string, value: string, bold?: boolean) => (
    <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mb_6]}>
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
      >
        {value}
      </Text>
    </DmView>
  )

  const renderTextItem = (title: string, descr: string) => {
    return (
      <DmView style={a.mb_16}>
        <Text size={13} weight="semibold" leading="tight">
          {title}
        </Text>
        <DmView style={a.pt_6}>
          <Text size={13}>
            {descr}
          </Text>
        </DmView>
      </DmView>
    )
  }

  if (isLoading || !job) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <CloseIcon width={14} height={14} fill={colors.red} />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {categoryName}
          </Text>
          <Text size={11} leading="legacy" color="tertiary">
            {t("request_id")}: {jobId}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pin on delivery, district outline on pickup — the same rule the
            checkout and review screens follow. */}
        <OrderLocationMap coords={mapCoords} isPickup={isPickup} />

        {/* Details */}
        <DmView style={[a.mt_20, a.px_16]}>
          {renderTextItem(t("posted"), postedDate)}
          {!!fullAddress &&
            renderTextItem(
              isFoodOrder
                ? t(isPickup ? "customer_area" : "delivery_address")
                : t("address"),
              fullAddress
            )}
          {renderTextItem(
            isFoodOrder
              ? t(isPickup ? "pickup_time" : "delivery_time")
              : t("date_and_time"),
            dateDisplay
          )}

          {/* Questions & Answers */}
          {job.questionsAnswers?.map((qa) => {
            const questionText = (qa as any).question?.text || t("question")
            const displayValue = qa.answer || qa.date ||
              (qa.startTime && qa.endTime ? `${qa.startTime} - ${qa.endTime}` : "") ||
              ((qa as any).files?.length ? `${(qa as any).files.length} file(s)` : "")
            if (!displayValue) return null
            return (
              <React.Fragment key={qa.questionId}>
                {renderTextItem(questionText, displayValue)}
              </React.Fragment>
            )
          })}

          {!!job.orderNotes && renderTextItem(t("notes"), job.orderNotes)}

          {/* What was actually ordered. Without this a cancelled order's
              record shows where and when but not what. */}
          {isFoodOrder && (
            <>
              <Text size={13} weight="semibold" leading="tight" style={a.mb_10}>
                {t("order_details")}
              </Text>
              {items.map((line) => {
                const choices = (line.selectedOptions ?? []).flatMap((option) =>
                  option.choices.map((choice) => choice.name)
                )
                const choicesTotal = (line.selectedOptions ?? []).reduce(
                  (sum, option) =>
                    sum +
                    option.choices.reduce((cs, c) => cs + (c.price || 0), 0),
                  0
                )
                return (
                  <DmView
                    key={line.id}
                    style={[
                      a.flex_row,
                      a.items_start,
                      a.justify_between,
                      a.mb_8,
                    ]}
                  >
                    <DmView style={[a.flex_1, a.mr_10]}>
                      <Text size={13} weight="medium" leading={px(17)}>
                        {line.quantity}× {line.name}
                      </Text>
                      {!!choices.length && (
                        <Text size={11} color="secondary" style={a.mt_2}>
                          {choices.join(", ")}
                        </Text>
                      )}
                    </DmView>
                    <Text size={13} weight="medium" leading={px(17)}>
                      {formatMoney(
                        (Number(line.price) + choicesTotal) * line.quantity
                      )}{" "}
                      {t("EGP")}
                    </Text>
                  </DmView>
                )
              })}

              <DmView style={[styles.box2, a.mt_6, a.mb_8]} />
              {totalsRow(t("subtotal"), `${formatMoney(subtotal)} ${t("EGP")}`)}
              {!isPickup &&
                totalsRow(
                  t("delivery_fee"),
                  deliveryFee ? `${formatMoney(deliveryFee)} ${t("EGP")}` : t("free")
                )}
              {orderDiscount > 0 &&
                totalsRow(
                  t("discount"),
                  `- ${formatMoney(orderDiscount)} ${t("EGP")}`
                )}
              {totalsRow(
                t("order_total"),
                `${formatMoney(orderTotal)} ${t("EGP")}`,
                true
              )}
            </>
          )}
        </DmView>
      </AppScrollView>
    </SafeAreaView>
  )
}

export default RequestDetailsScreen
