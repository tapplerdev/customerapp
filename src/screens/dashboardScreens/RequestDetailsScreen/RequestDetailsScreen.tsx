import React from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import MapView, { Marker } from "react-native-maps"
import { format } from "date-fns"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetCustomerJobDetailsQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

import CloseIcon from "assets/icons/close.svg"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"

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

  const dateDisplay = (() => {
    if (!job?.dates?.length) {
      return job?.dateType === "asap" ? t("as_soon_as_possible") : t("not_decided")
    }
    const d = job.dates[0]
    const timeSlot = job?.timeSlots?.[0]
    if (d?.date && timeSlot) {
      return `${d.date}  •  ${timeSlot.start} - ${timeSlot.end}`
    }
    return d?.date || t("not_decided")
  })()

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
        {/* Map */}
        {hasCoords && (
          <DmView className="h-[160]">
            <MapView
              className="flex-1"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              region={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.002,
              }}
            >
              <Marker coordinate={{ latitude: lat, longitude: lng }}>
                <MapMarkerIcon width={22} height={28} />
              </Marker>
            </MapView>
          </DmView>
        )}

        {/* Details */}
        <DmView className="mt-[20] px-[16]">
          {renderTextItem(t("posted"), postedDate)}
          {!!fullAddress && renderTextItem(t("address"), fullAddress)}
          {renderTextItem(t("date_and_time"), dateDisplay)}

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
        </DmView>
      </ScrollView>
    </SafeAreaView>
  )
}

export default RequestDetailsScreen
