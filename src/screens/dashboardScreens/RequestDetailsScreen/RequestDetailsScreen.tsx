import React from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import OrderLocationMap from "components/OrderLocationMap/OrderLocationMap"
import { format } from "date-fns"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
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
    <DmView className="flex-row items-center justify-between mb-[6]">
      <DmText
        className={`text-13 leading-[17px] ${bold ? "font-custom700" : "font-custom400 text-grey2"}`}
      >
        {label}
      </DmText>
      <DmText
        className={`text-13 leading-[17px] ${bold ? "font-custom700" : "font-custom500"}`}
      >
        {value}
      </DmText>
    </DmView>
  )

  const renderTextItem = (title: string, descr: string) => {
    return (
      <DmView className="mb-[16]">
        <DmText className="text-13 leading-[16px] font-custom600">
          {title}
        </DmText>
        <DmView className="pt-[6]">
          <DmText className="text-13 leading-[18px] font-custom400">
            {descr}
          </DmText>
        </DmView>
      </DmView>
    )
  }

  if (isLoading || !job) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <CloseIcon width={14} height={14} fill={colors.red} />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {categoryName}
          </DmText>
          <DmText className="text-11 font-custom400 text-grey3">
            {t("request_id")}: {jobId}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pin on delivery, district outline on pickup — the same rule the
            checkout and review screens follow. */}
        <OrderLocationMap coords={mapCoords} isPickup={isPickup} />

        {/* Details */}
        <DmView className="mt-[20] px-[16]">
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
              <DmText className="mb-[10] text-13 leading-[16px] font-custom600">
                {t("order_details")}
              </DmText>
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
                    className="flex-row items-start justify-between mb-[8]"
                  >
                    <DmView className="flex-1 mr-[10]">
                      <DmText className="text-13 leading-[17px] font-custom500">
                        {line.quantity}× {line.name}
                      </DmText>
                      {!!choices.length && (
                        <DmText className="mt-[2] text-11 leading-[15px] font-custom400 text-grey2">
                          {choices.join(", ")}
                        </DmText>
                      )}
                    </DmView>
                    <DmText className="text-13 leading-[17px] font-custom500">
                      {formatMoney(
                        (Number(line.price) + choicesTotal) * line.quantity
                      )}{" "}
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
      </ScrollView>
    </SafeAreaView>
  )
}

export default RequestDetailsScreen
