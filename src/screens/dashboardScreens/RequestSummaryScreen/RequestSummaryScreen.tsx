import React, { useState } from "react"
import { Image, StyleSheet, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import MapView from "react-native-maps"
import MapPinMarker from "@tappler/shared/src/components/MapPinMarker"
import LinearGradient from "react-native-linear-gradient"
import moment from "moment"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps, SelectedProInfo } from "navigation/types"
import { useCreateJobMutation, useGetServiceByIdQuery } from "services/api"
import { useTypedSelector } from "store"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import ErrorModal from "components/ErrorModal"
import { CreateJobRequest } from "types/job"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import LocationIcon from "assets/icons/location-red.svg"
import StarIcon from "assets/icons/star.svg"
import CheckMarkIcon from "assets/icons/check-mark.svg"
import CloseIcon from "assets/icons/close.svg"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

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
    placeOfService,
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

  const { isAuth } = useTypedSelector((store) => store.auth)
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
    console.log('[RequestSummary] handleSubmit called')
    console.log('[RequestSummary] isAuth:', isAuth)
    console.log('[RequestSummary] token:', useTypedSelector ? 'exists' : 'none')

    if (!isAuth) {
      console.log('[RequestSummary] Not auth — navigating to AuthGateScreen')
      navigation.navigate("AuthGateScreen")
      return
    }

    console.log('[RequestSummary] Auth check passed, building payload...')

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
        ...(placeOfService && { placeOfService }),
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
    let iconContent = <Text size={20} leading="legacy" family="system">📅</Text>
    let title = ""
    let subtitle = ""
    let titleColor: "primary" | "brand" = "primary"

    if (dateType === "asap") {
      iconBg = RED
      iconContent = <Text size={20} leading="legacy" family="system">⚡</Text>
      title = t("as_soon_as_possible")
      subtitle = t("pros_respond_fastest") || "Pros respond fastest in this mode"
      titleColor = "brand"
    } else if (dateType === "hours48") {
      iconBg = PINK2
      iconContent = <Text size={20} leading="legacy" family="system">🕐</Text>
      title = t("within_48_hours")
      const deadline = moment().add(48, "hours").format("ddd, MMM D · h:mm A")
      subtitle = `By ${deadline}`
    } else if (dateType === "week") {
      iconBg = PINK2
      iconContent = <Text size={20} leading="legacy" family="system">📅</Text>
      title = t("within_a_week")
      const deadline = moment().add(7, "days").format("ddd, MMM D")
      subtitle = `By ${deadline}`
    } else if (dateType === "notDecided" || !dateType) {
      iconBg = BG2
      iconContent = <Text size={20} leading="legacy" color="tertiary" family="system">?</Text>
      title = t("havent_decided_yet")
      subtitle = t("pros_will_suggest_time") || "Pros will suggest a time when they reply"
    } else if (selectedDate) {
      // Specific date
      const d = moment(selectedDate)
      iconBg = "white"
      iconContent = (
        <DmView style={a.items_center}>
          <DmView style={[dsStyles.textWrap, a.px_6, a.py_2]}>
            <Text size={px(8)} color="inverse" family="system" style={dsStyles.text}>
              {d.format("MMM").toUpperCase()}
            </Text>
          </DmView>
          <Text size={16} leading="legacy" family="system">
            {d.format("D")}
          </Text>
          <Text size={px(8)} weight="bold" color="tertiary" style={dsStyles.text}>
            {d.format("ddd").toUpperCase()}
          </Text>
        </DmView>
      )
      title = d.format("ddd, MMM D, YYYY")
      subtitle = selectedTimeSlot ? `${selectedTimeSlot.start} – ${selectedTimeSlot.end}` : ""
    }

    return (
      <DmView style={[dsStyles.container, a.overflow_hidden, { borderColor: BORDER1 }]}>
        <DmView style={[a.flex_row, a.items_center, a.p_14]}>
          <DmView
            style={[dsStyles.box, a.items_center, a.justify_center, a.mr_12, {
              backgroundColor: iconBg,
              ...(dateType === "notDecided" || !dateType ? { borderWidth: 1, borderStyle: "dashed", borderColor: "#D9D9D9" } : {}),
              ...(selectedDate && !dateType ? { borderWidth: 1, borderColor: BORDER1 } : {}),
            }]}
          >
            {iconContent}
          </DmView>
          <DmView style={a.flex_1}>
            <Text size={15} leading="legacy" family="system" color={titleColor} style={{ letterSpacing: -0.2 }}>
              {title}
            </Text>
            {!!subtitle && (
              <Text size={12} weight="medium" leading="legacy" style={[a.mt_2, { color: FG3 }]}>
                {subtitle}
              </Text>
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
        style={[a.flex_row, a.items_center, a.px_12, a.py_14, !isLast ? { borderBottomWidth: 1, borderBottomColor: BORDER_DIVIDER } : undefined]}
      >
        {/* Avatar */}
        {pro.photo ? (
          <Image
            source={{ uri: pro.photo }}
            style={[dsStyles.image, a.mr_12]}
          />
        ) : (
          <DmView style={[dsStyles.image, a.mr_12, a.items_center, a.justify_center, { backgroundColor: PINK }]}>
            <Text size={16} weight="bold" leading="legacy" color="brand">{initial}</Text>
          </DmView>
        )}

        {/* Name + rating */}
        <DmView style={a.flex_1}>
          <Text size={14} weight="bold" leading="legacy">{pro.name}</Text>
          <DmView style={[a.flex_row, a.items_center, a.mt_2]}>
            {pro.rating ? (
              <>
                <StarIcon width={12} height={12} color="#FF9D00" />
                <Text size={12} weight="bold" leading="legacy" style={[dsStyles.text2, { color: FG3 }]}>
                  {pro.rating.toFixed(1)}
                </Text>
                {pro.reviewsCount ? (
                  <Text size={12} leading="legacy" style={[a.ml_2, { color: FG3 }]}>
                    · {pro.reviewsCount} {t("reviews")}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text size={12} leading="legacy" style={{ color: FG3 }}>
                {t("new_pro")}
              </Text>
            )}
            <Text size={12} leading="legacy" style={[a.ml_4, { color: FG3 }]}>
              · {pro.proType === "company" ? t("business") : t("individual")}
            </Text>
          </DmView>
        </DmView>

        {/* Remove button */}
        {prosState.length > 1 && (
          <DmView
            onPress={() => handleRemovePro(pro.id)}
            style={[dsStyles.iconWrap, a.items_center, a.justify_center, { borderColor: BORDER1 }]}
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
    <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mb_8]}>
      <Text size={11} weight="bold" leading="legacy" style={[dsStyles.text, { color: FG3, textTransform: "uppercase" }]}>
        {label}{count !== undefined ? ` · ${count}` : ""}
      </Text>
      {showEdit && (
        <DmView onPress={handleGoBack} hitSlop={HIT_SLOP_DEFAULT}>
          <Text size={12} weight="bold" leading="legacy" color="brand">{t("edit")}</Text>
        </DmView>
      )}
    </DmView>
  )

  // ── Q&A answers ──
  const answeredQuestions = questionsAnswers.filter((qa) => {
    return qa.answer || qa.optionId || qa.optionsIds?.length || qa.date || qa.startTime || qa.files?.length
  })

  return (
    <SafeAreaView style={[a.flex_1, dsStyles.safeArea]} edges={["top"]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12, dsStyles.row, { borderBottomColor: BORDER1 }]}>
        <DmView
          style={[dsStyles.iconWrap2, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={RED}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={px(17)} weight="bold">
            {t("review_request")}
          </Text>
        </DmView>
        <DmView style={dsStyles.box2} />
      </DmView>

      <AppScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: BG2 }}
      >
        {/* Hero — Map with fade + service title */}
        <DmView style={[dsStyles.safeArea, { borderBottomWidth: 1, borderBottomColor: BORDER1 }]}>
          <DmView style={dsStyles.box3} pointerEvents="none">
            <MapView
              style={a.flex_1}
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
              <MapPinMarker
                coordinate={{
                  latitude: address.coords.lat,
                  longitude: address.coords.lon,
                }}
              />
            </MapView>
            {/* Fade overlay at bottom */}
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
              style={styles.mapFade}
            />
          </DmView>

          {/* Title block overlapping the map fade */}
          <DmView style={[a.px_16, a.pb_16, { marginTop: -60 }]}>
            <DmView style={[a.flex_row, a.items_center, dsStyles.yourRequestRow, a.px_10, a.self_start, a.mb_8]}>
              <Text size={11} weight="bold" leading="legacy" color="inverse" style={[dsStyles.text, { textTransform: "uppercase" }]}>
                {t("your_request")}
              </Text>
            </DmView>
            <Text size={24} leading={{ fixed: px(28) }} family="system" style={{ letterSpacing: -0.3 }}>
              {categoryName}
            </Text>
            <DmView style={[a.flex_row, a.items_center, a.mt_6]}>
              <LocationIcon width={12} height={12} />
              <Text size={13} weight="medium" leading="legacy" style={[a.ml_4, { color: FG3 }]}>
                {address.address}{address.city ? ` · ${address.city}` : ""}
              </Text>
            </DmView>
          </DmView>
        </DmView>

        {/* Sections */}
        <DmView style={[a.px_16, a.mt_20]}>
          {/* When section */}
          {renderSectionHeader(t("when"))}
          {renderWhenCard()}

          {/* Selected professionals */}
          <DmView style={a.mt_24}>
            {renderSectionHeader(t("selected_pros"), prosState.length, true)}
            <DmView style={[dsStyles.container, a.overflow_hidden, { borderColor: BORDER1 }]}>
              {prosState.map((pro, idx) => renderProRow(pro, idx, idx === prosState.length - 1))}
            </DmView>
          </DmView>

          {/* Your answers */}
          {answeredQuestions.length > 0 && (
            <DmView style={a.mt_24}>
              {renderSectionHeader(t("your_answers"), answeredQuestions.length)}
              <DmView style={[dsStyles.container, a.overflow_hidden, { borderColor: BORDER1 }]}>
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
                      style={[a.flex_row, a.p_14, idx < answeredQuestions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: BORDER_DIVIDER } : undefined]}
                    >
                      {/* Numbered circle */}
                      <DmView style={[dsStyles.textWrap2, a.items_center, a.justify_center, a.mr_12]}>
                        <Text size={11} leading="legacy" color="inverse" family="system">{idx + 1}</Text>
                      </DmView>
                      <DmView style={a.flex_1}>
                        <Text size={12} weight="semibold" leading="legacy" style={{ color: FG3 }}>
                          {questionText}
                        </Text>
                        <Text size={14} weight="semibold" leading="legacy" style={a.mt_4}>
                          {displayValue}
                        </Text>
                      </DmView>
                    </DmView>
                  )
                })}
              </DmView>
            </DmView>
          )}

          {/* Notes */}
          {!!notes && (
            <DmView style={a.mt_24}>
              {renderSectionHeader(t("notes"))}
              <DmView style={[dsStyles.container, a.p_14, a.overflow_hidden, { borderColor: BORDER1 }]}>
                <Text size={13} leading="legacy">{notes}</Text>
              </DmView>
            </DmView>
          )}
        </DmView>
      </AppScrollView>

      {/* Sticky footer */}
      <DmView
        style={[dsStyles.buttonWrap, a.pt_12, styles.footerShadow, { paddingBottom: insets.bottom + 15 }]}
      >
        <Button
          title={t("send_request")}
          onPress={handleSubmit}
          isLoading={isLoading}
          disabled={prosState.length === 0}
          size={px(50)}
          labelWeight="bold"
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
