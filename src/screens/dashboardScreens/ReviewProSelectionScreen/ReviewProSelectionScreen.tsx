import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetCustomerJobByIdQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import CloseIcon from "assets/icons/close.svg"

type Props = RootStackScreenProps<"ReviewProSelectionScreen">

const ReviewProSelectionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { data: job } = useGetCustomerJobByIdQuery(jobId)

  const categoryName = job?.serviceCategory
    ? isAr ? job.serviceCategory.nameAr : job.serviceCategory.nameEn
    : ""

  // Pros that can be reviewed: have offer status and no review yet
  const reviewablePros = job?.pros?.filter((p) =>
    p.selectionStatus === "offer" && !p.review
  ) || []

  const handleSelectPro = (proId: number) => {
    navigation.navigate("ReviewFormScreen", { jobId, proId })
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

      {/* Title */}
      <DmView className="px-[16] mt-[20]">
        <DmText className="text-18 font-custom700 text-black text-center">
          {t("select_pro_to_review")}
        </DmText>
      </DmView>

      {/* Pro list */}
      <DmView className="mt-[30] items-center">
        {reviewablePros.map((jobPro) => {
          const pro = jobPro.pro
          if (!pro) return null
          const displayName = pro.businessName || pro.registeredName
          const photoUrl = pro.profilePhoto150 || pro.profilePhoto

          return (
            <DmView
              key={jobPro.proId}
              className="items-center mb-[30]"
              onPress={() => handleSelectPro(jobPro.proId)}
            >
              {photoUrl ? (
                <DmView className="w-[90] h-[90] rounded-full overflow-hidden">
                  <FastImage
                    source={{ uri: photoUrl }}
                    style={{ width: 90, height: 90 }}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </DmView>
              ) : (
                <DmView className="w-[90] h-[90] rounded-full bg-grey8 items-center justify-center">
                  <DmText className="text-30 font-custom700 text-grey3">
                    {displayName?.charAt(0)}
                  </DmText>
                </DmView>
              )}
              <DmText className="mt-[8] text-14 font-custom600 text-black">
                {displayName}
              </DmText>
            </DmView>
          )
        })}
      </DmView>
    </SafeAreaView>
  )
}

export default ReviewProSelectionScreen
