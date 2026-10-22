import React, { useRef, useState } from "react"
import { Alert, Dimensions, Image, Modal, TextInput, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"
import ImageCropPicker, { ImageOrVideo } from "react-native-image-crop-picker"
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel"
import { requestGalleryPermission } from "@tappler/shared/src/hooks/permissionHooks"

import { DmChecbox, DmView } from "@tappler/shared/src/components/UI"
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
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

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
    const hasPermission = await requestGalleryPermission()
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
      <DmView style={[a.flex_row, a.items_center, a.mt_8]}>
        {[1, 2, 3, 4, 5].map((star) => (
          <DmView
            key={star}
            onPress={() => setScore(key, star)}
            hitSlop={HIT_SLOP_DEFAULT}
            style={a.mr_8}
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
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={a.flex_1} />
        <DmView style={styles.box} />
      </DmView>

      {/*
        KeyboardAwareScrollView, not a plain ScrollView. The Submit button lives
        INSIDE this scroller and the review comment field is `multiline`, so its
        return key inserts a newline rather than dismissing. A plain ScrollView
        adds no keyboard contentInset on iOS — nothing in this app sets
        automaticallyAdjustKeyboardInsets — so with flexGrow:1 the content is
        exactly the frame height and that 40px tail was the entire scroll range:
        the button stayed under the keys. Same fix as DeleteAccountScreen /
        AddNewAddressScreen / RegisterScreen.
      */}
      <AppKeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pro photo + name */}
        <DmView style={[a.items_center, a.mt_10]}>
          {photoUrl ? (
            <DmView style={[styles.imageWrap, a.overflow_hidden]}>
              <FastImage
                source={{ uri: photoUrl }}
                style={styles.profilePhoto}
                resizeMode={FastImage.resizeMode.cover}
              />
            </DmView>
          ) : (
            <DmView style={[styles.textWrap, a.items_center, a.justify_center]}>
              <Text size={px(36)} weight="bold" color="tertiary">
                {displayName?.charAt(0)}
              </Text>
            </DmView>
          )}
          <Text size={16} weight="semibold" leading="legacy" style={a.mt_12}>
            {displayName}
          </Text>
        </DmView>

        {/* Your Review label between separators */}
        <DmView style={[a.mt_20, a.mb_16, a.flex_row, a.items_center, a.px_16]}>
          <DmView style={[a.flex_1, styles.box2]} />
          <Text size={14} weight="semibold" leading="legacy" color="brand" style={a.mx_12}>
            {t("your_review")}
          </Text>
          <DmView style={[a.flex_1, styles.box2]} />
        </DmView>

        <DmView style={a.px_20}>
          {/* Did pro complete the job? */}
          <Text size={14} weight="semibold" leading="legacy">
            {t("did_pro_complete_job")}
          </Text>
          <DmView style={a.mt_10}>
            <DmChecbox
              variant="circle"
              title={t("yes")}
              isChecked={proCompletedJob === true}
              onPress={() => setProCompletedJob(true)}
              style={a.mb_10}
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
            <DmView key={cat.key} style={a.mt_20}>
              <Text size={14} weight="semibold" leading="legacy">
                {t(cat.label)}
              </Text>
              {renderStarRating(cat.key)}
              <DmView style={[a.mt_12, styles.box2]} />
            </DmView>
          ))}

          {/* Written review */}
          <DmView style={a.mt_20}>
            <Text size={14} weight="semibold" leading="legacy">
              {t("write_your_review")}{" "}
              <Text size={12} leading="legacy" color="tertiary">
                ({t("optional")})
              </Text>
            </Text>
            <DmView
              style={[a.mt_10, styles.inputWrap, styles.reviewInputBorder, { borderColor: colors.grey5 }]}
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
          <DmView style={a.mt_20}>
            <Text size={14} weight="semibold" leading="legacy">
              {t("submit_photos_of_work")}
            </Text>
            <Text size={12} leading="legacy" color="tertiary">
              {t("max_4_photos")}{" "}
              <Text size={12} leading="legacy" color="tertiary">
                ({t("optional")})
              </Text>
            </Text>

            {/* Photo previews */}
            {photos.length > 0 && (
              <DmView style={[a.mt_10, a.flex_row, a.flex_wrap]}>
                {photos.map((photo, idx) => (
                  <DmView key={idx} style={[a.mr_10, a.mb_10]}>
                    <DmView
                      style={[styles.imageWrap2, a.overflow_hidden]}
                      onPress={() => handleViewPhoto(idx)}
                    >
                      <Image
                        source={{ uri: photo.path }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                      />
                    </DmView>
                    <DmView
                      style={[a.absolute, styles.boxWrap]}
                      onPress={() => handleDeletePhoto(idx)}
                    >
                      <DmView style={[styles.iconWrap2, a.border_1, a.items_center, a.justify_center]}>
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
                style={[a.mt_10, a.flex_row, a.items_center, a.justify_center, a.py_10, styles.inputWrap, styles.uploadBorder]}
                onPress={handlePickPhotos}
              >
                <CameraPlusIcon width={40} height={26} />
                <Text size={13} weight="semibold" leading="legacy" color="brand" style={a.ml_4}>
                  {t("upload_photos_videos")}
                </Text>
              </DmView>
            )}
          </DmView>

          {/* Submit button */}
          <DmView style={[a.mt_30, a.px_20]}>
            <Button
              title={t("submit_review")}
              onPress={handleSubmit}
              disabled={!isFormReady}
              isLoading={isLoading}
              label={14}
              labelWeight="semibold"
              labelLeading="legacy"
            />
          </DmView>
        </DmView>
      </AppKeyboardAwareScrollView>

      {/* Photo viewer modal */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <DmView style={[a.flex_1, styles.modalOverlay]}>
          {/* Close button — white circle, top left */}
          <DmView
            style={[a.absolute, styles.boxWrap2, styles.closePosition]}
            onPress={() => setViewerVisible(false)}
          >
            <DmView
              style={[styles.iconWrap3, a.items_center, a.justify_center, styles.closeShadow]}
            >
              <CloseIcon width={12} height={12} fill={colors.red} />
            </DmView>
          </DmView>

          {/* Main image — swipeable carousel */}
          <DmView style={[a.flex_1, a.items_center, a.justify_center]}>
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
            style={[a.absolute, styles.boxWrap3, a.items_center, a.justify_center, styles.thumbnailsBottom]}
          >
            <DmView style={a.flex_row}>
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
