import React, { useRef, useState } from "react"
import { Alert, Dimensions, Image, Modal, ScrollView, TextInput, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"
import ImageCropPicker, { ImageOrVideo } from "react-native-image-crop-picker"
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel"
import { useRequestGallery } from "@tappler/shared/src/hooks/permissionHooks"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { openPermissionAlert } from "utils/openPermissionAlert"
import { RootStackScreenProps } from "navigation/types"
import { useCreateReviewMutation, useGetCustomerJobByIdQuery } from "services/api"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import StarIcon from "assets/icons/star.svg"
import CameraPlusIcon from "assets/icons/camera-plus.svg"
import CloseIcon from "assets/icons/close.svg"
import styles from "./styles"

const SCREEN_WIDTH = Dimensions.get("window").width

type Props = RootStackScreenProps<"ReviewFormScreen">

const RATING_CATEGORIES = [
  { key: "qualityScore", label: "quality_of_work" },
  { key: "completionInTimeScore", label: "arrive_completed_on_time" },
  { key: "jobAwarenessScore", label: "awareness_of_work" },
  { key: "honestyScore", label: "honesty_transparency" },
  { key: "responseTimeScore", label: "quick_response" },
]

const ReviewFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId, proId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { data: job } = useGetCustomerJobByIdQuery(jobId)
  const [createReview] = useCreateReviewMutation()

  const jobPro = job?.pros?.find((p) => p.proId === proId)
  const pro = jobPro?.pro
  const displayName = pro?.businessName || pro?.registeredName
  const photoUrl = pro?.profilePhoto150 || pro?.profilePhoto

  const [proCompletedJob, setProCompletedJob] = useState<boolean | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState("")
  const [isLoading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<ImageOrVideo[]>([])
  const [viewerVisible, setViewerVisible] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const carouselRef = useRef<ICarouselInstance>(null)

  const handlePickPhotos = async () => {
    if (photos.length >= 4) {
      Alert.alert(t("error"), t("max_4_photos"))
      return
    }
    const hasPermission = await useRequestGallery()
    if (!hasPermission) {
      openPermissionAlert()
      return
    }
    try {
      const images = await ImageCropPicker.openPicker({
        multiple: true,
        maxFiles: 4 - photos.length,
        mediaType: "photo",
      })
      setPhotos((prev) => [...prev, ...images].slice(0, 4))
    } catch (e: any) {
      // Ignore cancelled picker
    }
  }

  const handleDeletePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleViewPhoto = (index: number) => {
    setViewerIndex(index)
    setViewerVisible(true)
  }

  const setScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  const allScoresFilled = RATING_CATEGORIES.every((cat) => scores[cat.key] > 0)
  const isFormReady = proCompletedJob !== null && allScoresFilled

  const handleSubmit = async () => {
    if (!isFormReady) return
    try {
      setLoading(true)
      await createReview({
        jobId,
        proId,
        qualityScore: scores.qualityScore,
        completionInTimeScore: scores.completionInTimeScore,
        jobAwarenessScore: scores.jobAwarenessScore,
        honestyScore: scores.honestyScore,
        responseTimeScore: scores.responseTimeScore,
        comment: comment || " ",
        proCompletedJob: proCompletedJob!,
      }).unwrap()

      Alert.alert(t("review_submitted"), t("review_submitted_descr"), [
        { text: t("OK"), onPress: () => navigation.popToTop() },
      ])
    } catch (error: any) {
      Alert.alert(t("error"), error?.data?.message || t("an_error_occurred"))
    } finally {
      setLoading(false)
    }
  }

  const renderStarRating = (key: string) => {
    const currentScore = scores[key] || 0
    return (
      <DmView className="flex-row items-center mt-[8]">
        {[1, 2, 3, 4, 5].map((star) => (
          <DmView
            key={star}
            onPress={() => setScore(key, star)}
            hitSlop={HIT_SLOP_DEFAULT}
            className="mr-[8]"
          >
            <StarIcon
              width={28}
              height={28}
              fill={star <= currentScore ? "#DF0000" : "#E0E0E0"}
              color={star <= currentScore ? "#DF0000" : "#E0E0E0"}
              strokeWidth={0}
            />
          </DmView>
        ))}
      </DmView>
    )
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
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1" />
        <DmView className="w-[32]" />
      </DmView>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pro photo + name */}
        <DmView className="items-center mt-[10]">
          {photoUrl ? (
            <DmView className="w-[100] h-[100] rounded-full overflow-hidden">
              <FastImage
                source={{ uri: photoUrl }}
                style={styles.profilePhoto}
                resizeMode={FastImage.resizeMode.cover}
              />
            </DmView>
          ) : (
            <DmView className="w-[100] h-[100] rounded-full bg-grey8 items-center justify-center">
              <DmText className="text-36 font-custom700 text-grey3">
                {displayName?.charAt(0)}
              </DmText>
            </DmView>
          )}
          <DmText className="mt-[12] text-16 font-custom600 text-black">
            {displayName}
          </DmText>
        </DmView>

        {/* Your Review label between separators */}
        <DmView className="mt-[20] mb-[16] flex-row items-center px-[16]">
          <DmView className="flex-1 h-[0.5] bg-grey19" />
          <DmText className="mx-[12] text-14 font-custom600 text-red">
            {t("your_review")}
          </DmText>
          <DmView className="flex-1 h-[0.5] bg-grey19" />
        </DmView>

        <DmView className="px-[20]">
          {/* Did pro complete the job? */}
          <DmText className="text-14 font-custom600 text-black">
            {t("did_pro_complete_job")}
          </DmText>
          <DmView className="mt-[10]">
            <DmChecbox
              variant="circle"
              title={t("yes")}
              isChecked={proCompletedJob === true}
              onPress={() => setProCompletedJob(true)}
              className="mb-[10]"
            />
            <DmChecbox
              variant="circle"
              title={t("no")}
              isChecked={proCompletedJob === false}
              onPress={() => setProCompletedJob(false)}
            />
          </DmView>

          {/* 5 Rating categories */}
          {RATING_CATEGORIES.map((cat) => (
            <DmView key={cat.key} className="mt-[20]">
              <DmText className="text-14 font-custom600 text-black">
                {t(cat.label)}
              </DmText>
              {renderStarRating(cat.key)}
              <DmView className="mt-[12] h-[0.5] bg-grey19" />
            </DmView>
          ))}

          {/* Written review */}
          <DmView className="mt-[20]">
            <DmText className="text-14 font-custom600 text-black">
              {t("write_your_review")}{" "}
              <DmText className="text-12 font-custom400 text-grey3">
                ({t("optional")})
              </DmText>
            </DmText>
            <DmView
              className="mt-[10] rounded-4"
              style={[styles.reviewInputBorder, { borderColor: colors.grey5 }]}
            >
              <TextInput
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
                style={[
                  styles.reviewTextInput,
                  { textAlign: isAr ? "right" : "left", color: colors.black },
                ]}
              />
            </DmView>
          </DmView>

          {/* Submit photos */}
          <DmView className="mt-[20]">
            <DmText className="text-14 font-custom600 text-black">
              {t("submit_photos_of_work")}
            </DmText>
            <DmText className="text-12 font-custom400 text-grey3">
              {t("max_4_photos")}{" "}
              <DmText className="text-12 font-custom400 text-grey3">
                ({t("optional")})
              </DmText>
            </DmText>

            {/* Photo previews */}
            {photos.length > 0 && (
              <DmView className="mt-[10] flex-row flex-wrap">
                {photos.map((photo, idx) => (
                  <DmView key={idx} className="mr-[10] mb-[10]">
                    <DmView
                      className="w-[80] h-[80] rounded-10 overflow-hidden"
                      onPress={() => handleViewPhoto(idx)}
                    >
                      <Image
                        source={{ uri: photo.path }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                      />
                    </DmView>
                    <DmView
                      className="absolute top-[-8] right-[-8]"
                      onPress={() => handleDeletePhoto(idx)}
                    >
                      <DmView className="w-[20] h-[20] rounded-full border-1 border-grey2 bg-white items-center justify-center">
                        <CloseIcon width={8} height={8} />
                      </DmView>
                    </DmView>
                  </DmView>
                ))}
              </DmView>
            )}

            {/* Upload button */}
            {photos.length < 4 && (
              <DmView
                className="mt-[10] flex-row items-center justify-center py-[10] rounded-4"
                style={styles.uploadBorder}
                onPress={handlePickPhotos}
              >
                <CameraPlusIcon width={40} height={26} />
                <DmText className="text-13 font-custom600 text-red ml-[4]">
                  {t("upload_photos_videos")}
                </DmText>
              </DmView>
            )}
          </DmView>

          {/* Submit button */}
          <DmView className="mt-[30] px-[20]">
            <ActionBtn
              title={t("submit_review")}
              onPress={handleSubmit}
              disable={!isFormReady}
              isLoading={isLoading}
              textClassName="text-14 font-custom600"
            />
          </DmView>
        </DmView>
      </ScrollView>

      {/* Photo viewer modal */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <DmView className="flex-1" style={styles.modalOverlay}>
          {/* Close button — white circle, top left */}
          <DmView
            className="absolute z-10"
            style={styles.closePosition}
            onPress={() => setViewerVisible(false)}
          >
            <DmView
              className="w-[32] h-[32] rounded-full bg-white items-center justify-center"
              style={styles.closeShadow}
            >
              <CloseIcon width={12} height={12} fill={colors.red} />
            </DmView>
          </DmView>

          {/* Main image — swipeable carousel */}
          <DmView className="flex-1 items-center justify-center">
            <Carousel
              ref={carouselRef}
              width={SCREEN_WIDTH}
              height={SCREEN_WIDTH * 0.752}
              data={photos}
              defaultIndex={viewerIndex}
              onSnapToItem={(index) => setViewerIndex(index)}
              loop={false}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.path }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.752 }}
                  resizeMode="cover"
                />
              )}
            />
          </DmView>

          {/* Thumbnails — centered at bottom */}
          <DmView
            className="absolute left-0 right-0 items-center justify-center"
            style={styles.thumbnailsBottom}
          >
            <DmView className="flex-row">
              {photos.map((photo, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setViewerIndex(idx)
                    carouselRef.current?.scrollTo({ index: idx, animated: true })
                  }}
                  style={[
                    styles.thumbnailBase,
                    { borderColor: idx === viewerIndex ? "#fff" : "transparent" },
                  ]}
                >
                  <Image
                    source={{ uri: photo.path }}
                    style={styles.fullSize}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </DmView>
          </DmView>
        </DmView>
      </Modal>
    </SafeAreaView>
  )
}

export default ReviewFormScreen
