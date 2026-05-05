import React, { useCallback, useRef, useState } from "react"
import {
  FlatList,
  I18nManager,
  Image as RNImage,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native"
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
import { useLazyGetCustomerJobDetailsQuery, useLazyGetProProfileQuery, useSendMessageMutation } from "services/api"

import { RootStackScreenProps } from "navigation/types"
import useChatContext from "hooks/useChatContext"
import useMessagePagination from "hooks/useMessagePagination"
import useMessageGroups, { FlatItem } from "hooks/useMessageGroups"
import useAttachments from "hooks/useAttachments"
import MessageComponent from "components/MessageComponent/MessageComponent"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SendIcon from "assets/icons/send.svg"
import CallIcon from "assets/icons/call.svg"
import ReviewsIcon from "assets/icons/my-reviews.svg"
import DetailsIcon from "assets/icons/details-icon.svg"
import CameraIcon from "assets/icons/camera-icon.svg"
import DocumentIcon from "assets/icons/my-documents.svg"
import LocationIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"

type Props = RootStackScreenProps<"MessagesDetailsScreen">

const MessagesDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { chatPreview } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  // Deep module hooks
  const context = useChatContext(chatPreview)
  const pagination = useMessagePagination(context.chatId)
  const groups = useMessageGroups(pagination.messages)
  const attachments = useAttachments({
    maxCount: 4,
    chatId: context.chatId,
    onMessageSent: pagination.addOptimisticMessage,
  })

  const [messageText, setMessageText] = useState("")
  const attachmentSheetRef = useRef<BottomSheet>(null)
  const [sendMessage] = useSendMessageMutation()
  const [getProProfile] = useLazyGetProProfileQuery()
  const [getJobDetails] = useLazyGetCustomerJobDetailsQuery()

  const canSend = messageText.trim().length > 0 || attachments.pending.length > 0

  const handleOpenAttachmentSheet = () => {
    attachmentSheetRef.current?.expand()
    attachments.loadRecentPhotos()
  }

  const handleCameraPress = () => {
    attachmentSheetRef.current?.close()
    attachments.addFromCamera()
  }

  const handleGalleryPress = () => {
    attachmentSheetRef.current?.close()
    attachments.addFromGallery()
  }

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  )

  const handleSend = useCallback(async () => {
    const text = messageText.trim()
    if (!text && attachments.pending.length === 0) return

    setMessageText("")

    if (attachments.pending.length > 0) {
      try {
        await attachments.sendWithAttachments(text)
      } catch {}
    } else {
      try {
        const newMsg = await sendMessage({ chatId: context.chatId, text }).unwrap()
        pagination.addOptimisticMessage(newMsg)
      } catch {
        setMessageText(text)
      }
    }
  }, [messageText, attachments, context.chatId, sendMessage, pagination])

  const renderItem = ({ item }: { item: FlatItem }) => {
    if (item.type === "date") {
      return (
        <DmView className="items-center justify-center py-[8]">
          <DmText className="text-11 leading-[14px] font-custom600 text-black">
            {item.label}
          </DmText>
        </DmView>
      )
    }

    return (
      <MessageComponent
        item={item.message}
        isFirstInGroup={item.isFirstInGroup}
        isLastInGroup={item.isLastInGroup}
        showReadReceipt={item.showReadReceipt}
        readByName={context.proName}
      />
    )
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <DmView className="bg-white">
          <DmView className="flex-row items-center px-[19] pb-[5]">
            <DmView
              onPress={() => navigation.goBack()}
              className={I18nManager.isRTL ? "rotate-[180deg]" : ""}
            >
              <ChevronLeftIcon color={colors.red} />
            </DmView>

            <DmView
              className="flex-1 flex-row items-center px-[10]"
              onPress={async () => {
                if (!context.pro?.id) return
                try {
                  await getProProfile({ proId: context.pro.id, serviceCategoryId: context.serviceCategoryId || 0 }, true).unwrap()
                  navigation.navigate("ProProfileScreen", {
                    proId: context.pro.id,
                    serviceCategoryId: context.serviceCategoryId || 0,
                  })
                } catch {}
              }}
            >
              {context.pro?.profilePhoto150 || context.pro?.profilePhoto ? (
                <DmView className="w-[36] h-[36] rounded-full overflow-hidden mr-[10]">
                  <FastImage
                    source={{ uri: context.pro.profilePhoto150 || context.pro.profilePhoto }}
                    style={styles.headerAvatar}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </DmView>
              ) : (
                <DmView className="w-[36] h-[36] rounded-full bg-red items-center justify-center mr-[10]">
                  <DmText className="text-white text-14 font-custom600">
                    {context.proName.charAt(0)}
                  </DmText>
                </DmView>
              )}
              <DmView className="flex-1">
                <DmText
                  className="font-custom600 text-black text-16 leading-[19px] text-left"
                  numberOfLines={1}
                >
                  {context.proName}
                </DmText>
                {!!context.lastSeenText && (
                  <DmText className="font-custom400 text-grey3 text-11 leading-[14px] text-left">
                    {context.lastSeenText}
                  </DmText>
                )}
              </DmView>
            </DmView>

            <DmView className="items-end h-[28] justify-center">
              <DmView className="flex-row">
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
              </DmView>
            </DmView>
          </DmView>

          {/* Offer section */}
          {context.offerAmount != null && (
            <DmView
              className="mt-[4] mb-[4] ml-[55] border-0.3 border-black rounded-5 h-[38] flex-row items-center overflow-hidden"
              style={styles.offerWidth}
            >
              <DmView className="w-2/5 h-full items-center justify-center bg-red5">
                <DmText className="text-13 leading-[16px] font-custom600 text-white tracking-[0.3]">
                  {t("offer")}
                </DmText>
              </DmView>
              <DmView className="w-3/5 h-full flex-row items-center justify-center">
                <DmText className="text-22 leading-[27px] font-custom500">
                  {context.offerAmount}
                </DmText>
                <DmText className="ml-[4] text-11 leading-[14px] font-custom400" style={styles.egpMargin}>
                  EGP
                </DmText>
              </DmView>
            </DmView>
          )}

          {/* Action bar — only show for job-linked chats */}
          {context.hasJob && (
            <DmView className="px-[16] pt-[8] pb-[10] flex-row justify-around items-center border-b-0.5 border-grey4">
              <DmView className="flex-row items-center">
                <CallIcon width={22} height={22} />
                <DmText className="mx-[5] text-13 leading-[16] font-custom400">
                  {t("call")}
                </DmText>
              </DmView>
              <DmView className="flex-row items-center">
                <ReviewsIcon width={32} height={20} />
                <DmText className="mx-[5] text-13 leading-[16] font-custom400">
                  {t("my_review")}
                </DmText>
              </DmView>
              <DmView
                className="flex-row items-center"
                onPress={async () => {
                  if (!context.jobId) return
                  try {
                    await getJobDetails(context.jobId, true).unwrap()
                    navigation.navigate("RequestDetailsScreen", { jobId: context.jobId })
                  } catch {}
                }}
              >
                <DetailsIcon width={20} height={24} />
                <DmText className="mx-[5] text-13 leading-[16] font-custom400">
                  {t("my_request")}
                </DmText>
              </DmView>
            </DmView>
          )}
        </DmView>

        {/* Messages list */}
        <DmView className="flex-1" style={styles.relative}>
          <FlatList
            data={groups.flatData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            className="flex-1 bg-white"
            contentContainerStyle={
              groups.flatData.length === 0
                ? { flex: 1, justifyContent: "center" }
                : { paddingBottom: 10 }
            }
            onEndReached={pagination.loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <DmView className="items-center px-[30]">
                <DmView
                  className="px-[20] py-[16] rounded-12"
                  style={styles.emptyBg}
                >
                  <DmText
                    className="text-13 font-custom400 text-grey3 text-center leading-[20px]"
                    style={styles.italic}
                  >
                    {t("request_sent_to_pro_info")}
                  </DmText>
                </DmView>
              </DmView>
            }
          />
        </DmView>

        {/* Input bar */}
        <DmView
          className="w-full bg-white"
          style={[styles.inputBarShadow, { paddingBottom: insets.bottom + 10 }]}
        >
          <DmView className="flex-row items-center px-[20] pt-[10]">
            <DmView
              onPress={handleOpenAttachmentSheet}
              className="w-[36] h-[36] mr-[10] rounded-full bg-grey5 items-center justify-center"
            >
              <DmView className="absolute bg-grey2" style={styles.plusHorizontal} />
              <DmView className="absolute bg-grey2" style={styles.plusVertical} />
            </DmView>

            <DmView
              style={[styles.inputContainer, { borderColor: colors.grey4 }]}
            >
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder={t("type_a_message")}
                placeholderTextColor={colors.grey2}
                multiline
                maxLength={1000}
                style={[styles.textInput, { textAlign: isAr ? "right" : "left" }]}
              />
              <DmView
                onPress={handleSend}
                style={{
                  opacity: canSend ? 1 : 0.3,
                  marginLeft: 8,
                  marginBottom: Platform.OS === "ios" ? 0 : 2,
                }}
              >
                <SendIcon width={30} height={30} />
              </DmView>
            </DmView>
          </DmView>

          {/* Pending attachments preview */}
          {attachments.pending.length > 0 && (
            <DmView className="flex-row flex-wrap px-[20] pt-[8] pb-[2]">
              {attachments.pending.map((attachment, index) => (
                <DmView key={index} style={styles.pendingWrapper}>
                  <DmView style={styles.pendingThumb}>
                    {attachments.isImageMime(attachment.mime) ? (
                      <RNImage
                        source={{ uri: attachment.path }}
                        style={styles.pendingImage}
                      />
                    ) : (
                      <DmView className="w-full h-full bg-grey4 items-center justify-center rounded-8">
                        <DocumentIcon width={24} height={30} />
                      </DmView>
                    )}
                  </DmView>
                  <DmView
                    className="absolute"
                    style={styles.pendingClose}
                    onPress={() => attachments.remove(index)}
                  >
                    <DmView className="w-[18] h-[18] rounded-full border-1 border-grey2 bg-white items-center justify-center">
                      <CloseIcon width={8} height={8} />
                    </DmView>
                  </DmView>
                </DmView>
              ))}
            </DmView>
          )}
        </DmView>
      </KeyboardAvoidingView>

      {/* Attachment bottom sheet */}
      <BottomSheet
        ref={attachmentSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 2 }}>
          {context.isJobInactive && (
            <DmView className="px-[18] pb-[10]">
              <DmText className="text-11 font-custom400 text-grey3 text-center" style={styles.italic}>
                {t("attachments_unavailable")}
              </DmText>
            </DmView>
          )}

          <DmView style={context.isJobInactive ? { opacity: 0.3 } : undefined}>
            {/* Photos & videos header */}
            <DmView className="flex-row items-center justify-between px-[14] pb-[10]">
              <DmText className="text-14 font-custom600 text-black">
                {t("photos_and_videos")}
              </DmText>
              <DmView onPress={context.isJobInactive ? undefined : handleGalleryPress}>
                <DmText className="text-13 font-custom700 text-red">
                  {t("view_library")}
                </DmText>
              </DmView>
            </DmView>

            {/* Photo strip */}
            <DmView className="px-[14] pb-[14]">
              <FlatList
                horizontal
                data={attachments.recentPhotos}
                keyExtractor={(item, index) => `photo-${index}`}
                showsHorizontalScrollIndicator={false}
                ListHeaderComponent={
                  <DmView
                    onPress={context.isJobInactive ? undefined : handleCameraPress}
                    className="items-center justify-center rounded-6 bg-grey36 mr-[6]"
                    style={styles.photoStripItem}
                  >
                    <CameraIcon width={24} height={20} />
                  </DmView>
                }
                renderItem={({ item }) => (
                  <DmView
                    onPress={context.isJobInactive ? undefined : () => attachments.selectRecentPhoto(item.uri)}
                    className="mr-[6] rounded-6 overflow-hidden"
                    style={styles.photoStripItem}
                  >
                    <RNImage
                      source={{ uri: item.uri }}
                      style={styles.photoStripImage}
                    />
                  </DmView>
                )}
              />
            </DmView>

            <DmView className="h-[0.7] bg-grey19 mx-[14]" />

            {/* Upload file option */}
            <DmView
              className="flex-row items-center px-[18] py-[14]"
              onPress={context.isJobInactive ? undefined : () => attachmentSheetRef.current?.close()}
            >
              <DocumentIcon fill={colors.red} width={18} height={20} />
              <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
                {t("upload_file")}
              </DmText>
            </DmView>

            <DmView className="h-[0.7] bg-grey19" style={{ marginStart: 18 }} />

            {/* Location option */}
            <DmView
              className="flex-row items-center px-[18] py-[14]"
              onPress={context.isJobInactive ? undefined : () => attachmentSheetRef.current?.close()}
            >
              <LocationIcon width={18} height={20} />
              <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
                {t("location")}
              </DmText>
            </DmView>
          </DmView>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  )
}

export default MessagesDetailsScreen
