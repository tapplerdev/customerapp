import React, { useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import MapView, { Marker } from "react-native-maps"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useCreateJobMutation, useGetServiceByIdQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ErrorModal from "components/ErrorModal"
import { CreateJobRequest } from "types/job"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"

type Props = RootStackScreenProps<"RequestSummaryScreen">

const RequestSummaryScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    categoryId,
    categoryName,
    serviceId,
    selectedProIds,
    address,
    questionsAnswers,
    dateType,
    selectedDate,
    selectedTimeSlot,
    flexibleSchedule,
    selectedProNames,
    notes,
  } = route.params

  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  const [createJob] = useCreateJobMutation()
  // Fetch service data for question texts
  const { data: serviceData } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const customerQuestions = category?.customerQuestions || []

  // Pro names passed from ProsListingScreen where data is available
  const [isLoading, setLoading] = useState(false)
  const [isErrorVisible, setErrorVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      const jobPayload: CreateJobRequest = {
        serviceCategoryId: categoryId,
        address: {
          city: address.city || "",
          governorate: address.governorate || "",
          streetAddress: address.address,
          location: {
            lat: address.coords.lat,
            lng: address.coords.lon,
          },
        },
        prosIds: selectedProIds,
        questionsAnswers,
        ...(dateType && { dateType: dateType as CreateJobRequest["dateType"] }),
        ...(selectedDate && { dates: [{ date: selectedDate }] }),
        ...(selectedTimeSlot && { timeSlots: [selectedTimeSlot] }),
        ...(notes && { orderNotes: notes }),
      }

      await createJob(jobPayload).unwrap()
      navigation.navigate("RequestSuccessScreen", { address })
    } catch (error: any) {
      setErrorMessage(error?.data?.message || t("an_error_occurred"))
      setErrorVisible(true)
    } finally {
      setLoading(false)
    }
  }

  const getDateDisplay = () => {
    if (dateType === "asap") return t("as_soon_as_possible")
    if (dateType === "hours48") return t("within_48_hours")
    if (dateType === "week") return t("within_a_week")
    if (selectedDate && selectedTimeSlot) {
      return `${selectedDate}  •  ${selectedTimeSlot.start} - ${selectedTimeSlot.end}`
    }
    if (selectedDate) return selectedDate
    if (dateType === "notDecided") return t("havent_decided_yet")
    return t("not_decided")
  }

  const renderTextItem = (title: string, descr: string, isWrap: boolean) => {
    return (
      <DmView className={`mb-[10] flex-wrap ${!isWrap ? "flex-row" : ""}`}>
        <DmText className="text-13 leading-[16px] font-custom600">
          {title}
        </DmText>
        <DmView className={isWrap ? "pt-[8]" : undefined}>
          <DmText className="text-13 leading-[16px] font-custom400">
            {descr}
          </DmText>
        </DmView>
      </DmView>
    )
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingBottom: insets.bottom > 45 ? 0 : 45 - insets.bottom }}
    >
      <DmView className="flex-1">
        {/* Header */}
        <DmView className="flex-row items-center px-[16] py-[12]">
          <DmView
            className="w-[32] h-[32] items-center justify-center"
            hitSlop={HIT_SLOP_DEFAULT}
            onPress={handleGoBack}
          >
            <ChevronLeftIcon
              color={colors.red}
              style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </DmView>
          <DmView className="flex-1 items-center">
            <DmText className="text-16 font-custom600 text-black">
              {categoryName}
            </DmText>
          </DmView>
          <DmView className="w-[32]" />
        </DmView>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Map */}
          <DmView className="h-[140]">
            <MapView
              className="flex-1"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              region={{
                latitude: address.coords.lat,
                longitude: address.coords.lon,
                latitudeDelta: 0.005,
                longitudeDelta: 0.002,
              }}
            >
              <Marker
                coordinate={{
                  latitude: address.coords.lat,
                  longitude: address.coords.lon,
                }}
              >
                <MapMarkerIcon width={22} height={28} />
              </Marker>
            </MapView>
          </DmView>

          {/* Pink separator with title */}
          <DmView className="py-[9] bg-pink1">
            <DmText className="text-13 leading-[16px] font-custom600 text-center">
              {t("your_request_summary")}
            </DmText>
          </DmView>

          {/* Summary details */}
          <DmView className="mt-[20] px-[14]">
            {renderTextItem(t("service"), categoryName, true)}
            {renderTextItem(t("address"), address.address, true)}
            {renderTextItem(t("date_and_time"), getDateDisplay(), true)}
            {flexibleSchedule !== undefined && renderTextItem(
              t("flexible_schedule"),
              flexibleSchedule ? t("yes") : t("no"),
              true
            )}
            {renderTextItem(
              t("selected_pros"),
              selectedProNames,
              true
            )}

            {/* Question answers */}
            {questionsAnswers.map((qa) => {
              const question = customerQuestions.find((q) => q.id === qa.questionId)
              const questionText = question
                ? (isAr ? question.textAr || question.text : question.text)
                : `${t("question")} #${qa.questionId}`

              // Build display value from answer data
              let displayValue = ""
              if (qa.answer) {
                displayValue = qa.answer
              } else if (qa.optionId && question) {
                const opt = question.options?.find((o) => o.id === qa.optionId)
                displayValue = opt ? (isAr ? opt.valueAr || opt.value : opt.value) : ""
              } else if (qa.optionsIds?.length && question) {
                displayValue = qa.optionsIds
                  .map((id) => {
                    const opt = question.options?.find((o) => o.id === id)
                    return opt ? (isAr ? opt.valueAr || opt.value : opt.value) : ""
                  })
                  .filter(Boolean)
                  .join(", ")
              } else if (qa.date) {
                displayValue = qa.date
              } else if (qa.startTime && qa.endTime) {
                displayValue = `${qa.startTime} - ${qa.endTime}`
              } else if (qa.files?.length) {
                displayValue = `${qa.files.length} file(s)`
              }

              if (!displayValue) return null
              return (
                <React.Fragment key={qa.questionId}>
                  {renderTextItem(questionText, displayValue, true)}
                </React.Fragment>
              )
            })}

            {!!notes && renderTextItem(t("notes"), notes, true)}
          </DmView>
        </ScrollView>
      </DmView>

      {/* Submit button container with top border */}
      <DmView className="pt-[17] px-[16] border-t-1 border-t-grey33">
        <ActionBtn
          title={t("submit")}
          onPress={handleSubmit}
          isLoading={isLoading}
          className=""
          textClassName="text-13 leading-[16px] font-custom600"
        />
      </DmView>

      <ErrorModal
        isVisible={isErrorVisible}
        onClose={() => setErrorVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default RequestSummaryScreen
