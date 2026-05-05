import React, { useState } from "react"
import { Image, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import MapView, { Marker } from "react-native-maps"
import LinearGradient from "react-native-linear-gradient"
import moment from "moment"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps, SelectedProInfo } from "navigation/types"
import { useCreateJobMutation, useGetServiceByIdQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ErrorModal from "components/ErrorModal"
import { CreateJobRequest } from "types/job"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"
import LocationIcon from "assets/icons/location-red.svg"
import StarIcon from "assets/icons/star.svg"
import CheckMarkIcon from "assets/icons/check-mark.svg"
import CloseIcon from "assets/icons/close.svg"

const RED = "#CC0000"
const RED_SOFT = "#FFF8F8"
const PINK = "#FFE6E6"
const PINK2 = "#FFF2F2"
const FG3 = "#737385"
const BG2 = "#FAFAFA"
const BORDER1 = "#E5E5E5"
const BORDER_DIVIDER = "#EDEDED"
const SUCCESS = "#1FA000"

type Props = RootStackScreenProps<"RequestSummaryScreen">

const RequestSummaryScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    categoryId,
    categoryName,
    serviceId,
    selectedProIds,
    selectedProNames,
    selectedProsInfo,
    address,
    questionsAnswers,
    dateType,
    selectedDate,
    selectedTimeSlot,
    notes,
  } = route.params

  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  const [createJob] = useCreateJobMutation()
  const { data: serviceData } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const customerQuestions = category?.customerQuestions || []

  const [isLoading, setLoading] = useState(false)
  const [isErrorVisible, setErrorVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [prosState, setProsState] = useState<SelectedProInfo[]>(selectedProsInfo || [])

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleRemovePro = (proId: number) => {
    setProsState((prev) => prev.filter((p) => p.id !== proId))
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
        prosIds: prosState.map((p) => p.id),
        questionsAnswers,
        ...(dateType && { dateType: dateType as CreateJobRequest["dateType"] }),
        ...(selectedDate && { dates: [{ date: selectedDate }] }),
        ...(selectedTimeSlot && { timeSlots: [{ start: selectedTimeSlot.start, end: selectedTimeSlot.end }] }),
        ...(notes && { orderNotes: notes }),
      }
      console.log('[RequestSummary] Submitting job payload:', JSON.stringify(jobPayload, null, 2))
      await createJob(jobPayload).unwrap()
      navigation.navigate("RequestSuccessScreen", { address })
    } catch (error: any) {
      console.log('[RequestSummary] Job creation error:', JSON.stringify(error?.data || error, null, 2))
      const validationErrors = error?.data?.validationErrors
      const errorMsg = validationErrors
        ? Object.values(validationErrors).flat().join(", ")
        : error?.data?.message || t("an_error_occurred")
      setErrorMessage(errorMsg)
      setErrorVisible(true)
    } finally {
      setLoading(false)
    }
  }

  // ── When card variant ──
  const renderWhenCard = () => {
    let iconBg = PINK2
    let iconContent = <DmText className="text-20">📅</DmText>
    let title = ""
    let subtitle = ""
    let titleColor = "text-black"

    if (dateType === "asap") {
      iconBg = RED
      iconContent = <DmText className="text-20">⚡</DmText>
      title = t("as_soon_as_possible")
      subtitle = t("pros_respond_fastest") || "Pros respond fastest in this mode"
      titleColor = "text-red"
    } else if (dateType === "hours48") {
      iconBg = PINK2
      iconContent = <DmText className="text-20">🕐</DmText>
      title = t("within_48_hours")
      const deadline = moment().add(48, "hours").format("ddd, MMM D · h:mm A")
      subtitle = `By ${deadline}`
    } else if (dateType === "week") {
      iconBg = PINK2
      iconContent = <DmText className="text-20">📅</DmText>
      title = t("within_a_week")
      const deadline = moment().add(7, "days").format("ddd, MMM D")
      subtitle = `By ${deadline}`
    } else if (dateType === "notDecided" || !dateType) {
      iconBg = BG2
      iconContent = <DmText className="text-20 text-grey3">?</DmText>
      title = t("havent_decided_yet")
      subtitle = t("pros_will_suggest_time") || "Pros will suggest a time when they reply"
    } else if (selectedDate) {
      // Specific date
      const d = moment(selectedDate)
      iconBg = "white"
      iconContent = (
        <DmView className="items-center">
          <DmView className="bg-red px-[6] py-[2] rounded-t-[4]">
            <DmText className="text-8 font-custom800 text-white tracking-wider">
              {d.format("MMM").toUpperCase()}
            </DmText>
          </DmView>
          <DmText className="text-16 font-custom800 text-black leading-[18]">
            {d.format("D")}
          </DmText>
          <DmText className="text-8 font-custom700 text-grey3 tracking-wider">
            {d.format("ddd").toUpperCase()}
          </DmText>
        </DmView>
      )
      title = d.format("ddd, MMM D, YYYY")
      subtitle = selectedTimeSlot ? `${selectedTimeSlot.start} – ${selectedTimeSlot.end}` : ""
    }

    return (
      <DmView className="bg-white rounded-[12] border-0.5 overflow-hidden" style={{ borderColor: BORDER1 }}>
        <DmView className="flex-row items-center p-[14]">
          <DmView
            className="w-[56] h-[56] rounded-[12] items-center justify-center mr-[12]"
            style={{
              backgroundColor: iconBg,
              ...(dateType === "notDecided" || !dateType ? { borderWidth: 1, borderStyle: "dashed", borderColor: "#D9D9D9" } : {}),
              ...(selectedDate && !dateType ? { borderWidth: 1, borderColor: BORDER1 } : {}),
            }}
          >
            {iconContent}
          </DmView>
          <DmView className="flex-1">
            <DmText className={`text-15 font-custom800 ${titleColor}`} style={{ letterSpacing: -0.2 }}>
              {title}
            </DmText>
            {!!subtitle && (
              <DmText className="text-12 font-custom500 mt-[2]" style={{ color: FG3 }}>
                {subtitle}
              </DmText>
            )}
          </DmView>
        </DmView>
      </DmView>
    )
  }

  const handleProPress = (pro: SelectedProInfo) => {
    navigation.navigate("ProProfileScreen", {
      proId: pro.id,
      serviceCategoryId: categoryId,
    })
  }

  // ── Pro row ──
  const renderProRow = (pro: SelectedProInfo, index: number, isLast: boolean) => {
    const initial = pro.name.charAt(0).toUpperCase()
    return (
      <DmView
        key={pro.id}
        onPress={() => handleProPress(pro)}
        className="flex-row items-center px-[12] py-[14]"
        style={!isLast ? { borderBottomWidth: 1, borderBottomColor: BORDER_DIVIDER } : undefined}
      >
        {/* Avatar */}
        {pro.photo ? (
          <Image
            source={{ uri: pro.photo }}
            className="w-[40] h-[40] rounded-full mr-[12]"
          />
        ) : (
          <DmView className="w-[40] h-[40] rounded-full mr-[12] items-center justify-center" style={{ backgroundColor: PINK }}>
            <DmText className="text-16 font-custom700 text-red">{initial}</DmText>
          </DmView>
        )}

        {/* Name + rating */}
        <DmView className="flex-1">
          <DmText className="text-14 font-custom700 text-black">{pro.name}</DmText>
          <DmView className="flex-row items-center mt-[2]">
            {pro.rating ? (
              <>
                <StarIcon width={12} height={12} color="#FF9D00" />
                <DmText className="text-12 font-custom700 ml-[3]" style={{ color: FG3 }}>
                  {pro.rating.toFixed(1)}
                </DmText>
                {pro.reviewsCount ? (
                  <DmText className="text-12 font-custom400 ml-[2]" style={{ color: FG3 }}>
                    · {pro.reviewsCount} {t("reviews")}
                  </DmText>
                ) : null}
              </>
            ) : (
              <DmText className="text-12 font-custom400" style={{ color: FG3 }}>
                {t("new_pro")}
              </DmText>
            )}
            <DmText className="text-12 font-custom400 ml-[4]" style={{ color: FG3 }}>
              · {pro.proType === "company" ? t("business") : t("individual")}
            </DmText>
          </DmView>
        </DmView>

        {/* Remove button */}
        {prosState.length > 1 && (
          <DmView
            onPress={() => handleRemovePro(pro.id)}
            className="w-[30] h-[30] rounded-full items-center justify-center border-0.5"
            style={{ borderColor: BORDER1 }}
            hitSlop={HIT_SLOP_DEFAULT}
          >
            <CloseIcon width={10} height={10} color={FG3} />
          </DmView>
        )}
      </DmView>
    )
  }

  // ── Section header ──
  const renderSectionHeader = (label: string, count?: number, showEdit?: boolean) => (
    <DmView className="flex-row items-center justify-between mb-[8]">
      <DmText className="text-11 font-custom700 tracking-wider" style={{ color: FG3, textTransform: "uppercase" }}>
        {label}{count !== undefined ? ` · ${count}` : ""}
      </DmText>
      {showEdit && (
        <DmView onPress={handleGoBack} hitSlop={HIT_SLOP_DEFAULT}>
          <DmText className="text-12 font-custom700 text-red">{t("edit")}</DmText>
        </DmView>
      )}
    </DmView>
  )

  // ── Q&A answers ──
  const answeredQuestions = questionsAnswers.filter((qa) => {
    return qa.answer || qa.optionId || qa.optionsIds?.length || qa.date || qa.startTime || qa.files?.length
  })

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12] bg-white border-b-0.5" style={{ borderBottomColor: BORDER1 }}>
        <DmView
          className="w-[44] h-[44] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={RED}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-17 font-custom700 text-black">
            {t("review_request")}
          </DmText>
        </DmView>
        <DmView className="w-[44]" />
      </DmView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: BG2 }}
      >
        {/* Hero — Map with fade + service title */}
        <DmView className="bg-white" style={{ borderBottomWidth: 1, borderBottomColor: BORDER1 }}>
          <DmView className="h-[180]" pointerEvents="none">
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
                <MapMarkerIcon width={32} height={40} />
              </Marker>
            </MapView>
            {/* Fade overlay at bottom */}
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
              style={styles.mapFade}
            />
          </DmView>

          {/* Title block overlapping the map fade */}
          <DmView className="px-[16] pb-[16]" style={{ marginTop: -60 }}>
            <DmView className="flex-row items-center bg-red px-[10] py-[5] rounded-full self-start mb-[8]">
              <DmText className="text-11 font-custom700 text-white tracking-wider" style={{ textTransform: "uppercase" }}>
                {t("your_request")}
              </DmText>
            </DmView>
            <DmText className="text-24 font-custom800 text-black" style={{ lineHeight: 28, letterSpacing: -0.3 }}>
              {categoryName}
            </DmText>
            <DmView className="flex-row items-center mt-[6]">
              <LocationIcon width={12} height={12} />
              <DmText className="text-13 font-custom500 ml-[4]" style={{ color: FG3 }}>
                {address.address}{address.city ? ` · ${address.city}` : ""}
              </DmText>
            </DmView>
          </DmView>
        </DmView>

        {/* Sections */}
        <DmView className="px-[16] mt-[20]">
          {/* When section */}
          {renderSectionHeader(t("when"))}
          {renderWhenCard()}

          {/* Selected professionals */}
          <DmView className="mt-[24]">
            {renderSectionHeader(t("selected_pros"), prosState.length, true)}
            <DmView className="bg-white rounded-[12] border-0.5 overflow-hidden" style={{ borderColor: BORDER1 }}>
              {prosState.map((pro, idx) => renderProRow(pro, idx, idx === prosState.length - 1))}
            </DmView>
          </DmView>

          {/* Your answers */}
          {answeredQuestions.length > 0 && (
            <DmView className="mt-[24]">
              {renderSectionHeader(t("your_answers"), answeredQuestions.length)}
              <DmView className="bg-white rounded-[12] border-0.5 overflow-hidden" style={{ borderColor: BORDER1 }}>
                {answeredQuestions.map((qa, idx) => {
                  const question = customerQuestions.find((q) => q.id === qa.questionId)
                  const questionText = question
                    ? (isAr ? question.textAr || question.text : question.text)
                    : `#${qa.questionId}`

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
                    <DmView
                      key={qa.questionId}
                      className="flex-row px-[14] py-[14]"
                      style={idx < answeredQuestions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: BORDER_DIVIDER } : undefined}
                    >
                      {/* Numbered circle */}
                      <DmView className="w-[22] h-[22] rounded-full bg-red items-center justify-center mr-[12] mt-[1]">
                        <DmText className="text-11 font-custom800 text-white">{idx + 1}</DmText>
                      </DmView>
                      <DmView className="flex-1">
                        <DmText className="text-12 font-custom600" style={{ color: FG3 }}>
                          {questionText}
                        </DmText>
                        <DmText className="text-14 font-custom600 text-black mt-[4]">
                          {displayValue}
                        </DmText>
                      </DmView>
                    </DmView>
                  )
                })}
              </DmView>
            </DmView>
          )}

          {/* Notes */}
          {!!notes && (
            <DmView className="mt-[24]">
              {renderSectionHeader(t("notes"))}
              <DmView className="bg-white rounded-[12] border-0.5 p-[14] overflow-hidden" style={{ borderColor: BORDER1 }}>
                <DmText className="text-13 font-custom400 text-black">{notes}</DmText>
              </DmView>
            </DmView>
          )}
        </DmView>
      </ScrollView>

      {/* Sticky footer */}
      <DmView
        className="bg-white px-[15] pt-[12]"
        style={[styles.footerShadow, { paddingBottom: insets.bottom + 15 }]}
      >
        <ActionBtn
          title={t("send_request")}
          onPress={handleSubmit}
          isLoading={isLoading}
          disable={prosState.length === 0}
          className="h-[50] rounded-[12]"
          textClassName="text-16 font-custom700"
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

const styles = StyleSheet.create({
  mapFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 5,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
})

export default RequestSummaryScreen
