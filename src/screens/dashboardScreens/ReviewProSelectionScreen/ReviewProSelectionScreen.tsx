import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetCustomerJobByIdQuery } from "services/api"
import { isReviewableJobPro } from "utils/foodOrderState"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import CloseIcon from "assets/icons/close.svg"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

type Props = RootStackScreenProps<"ReviewProSelectionScreen">

const ReviewProSelectionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { data: job } = useGetCustomerJobByIdQuery(jobId)

  const categoryName = job?.serviceCategory
    ? isAr ? job.serviceCategory.nameAr : job.serviceCategory.nameEn
    : ""

  // Pros that can be reviewed: have offer status and no review yet, and for a
  // food order, a delivered order. The daily reminder and an old push can open
  // this screen for an order that has not arrived, and picking its restaurant
  // here would score it for food the customer does not have.
  const reviewablePros = job
    ? job.pros?.filter((p) => isReviewableJobPro(job, p)) || []
    : []

  const handleSelectPro = (proId: number) => {
    navigation.navigate("ReviewFormScreen", { jobId, proId })
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

      {/* Title */}
      <DmView style={[a.px_16, a.mt_20]}>
        <Text size={18} weight="bold" leading="legacy" align="center">
          {t("select_pro_to_review")}
        </Text>
      </DmView>

      {/* Pro list */}
      <DmView style={[a.mt_30, a.items_center]}>
        {reviewablePros.map((jobPro) => {
          const pro = jobPro.pro
          if (!pro) return null
          const displayName = pro.businessName || pro.registeredName
          const photoUrl = pro.profilePhoto150 || pro.profilePhoto

          return (
            <DmView
              key={jobPro.proId}
              style={[a.items_center, a.mb_30]}
              onPress={() => handleSelectPro(jobPro.proId)}
            >
              {photoUrl ? (
                <DmView style={[styles.imageWrap, a.overflow_hidden]}>
                  <FastImage
                    source={{ uri: photoUrl }}
                    style={{ width: 90, height: 90 }}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </DmView>
              ) : (
                <DmView style={[styles.textWrap, a.items_center, a.justify_center]}>
                  <Text size={30} weight="bold" leading="legacy" color="tertiary">
                    {displayName?.charAt(0)}
                  </Text>
                </DmView>
              )}
              <Text size={14} weight="semibold" leading="legacy" style={a.mt_8}>
                {displayName}
              </Text>
            </DmView>
          )
        })}
      </DmView>
    </SafeAreaView>
  )
}

export default ReviewProSelectionScreen
