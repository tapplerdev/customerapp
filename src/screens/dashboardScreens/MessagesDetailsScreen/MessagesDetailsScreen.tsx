import React, { useCallback, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Image as RNImage,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  TextInput,
} from "react-native"
// Using RN's built-in KeyboardAvoidingView (react-native-keyboard-controller not installed in customer app yet)
import { KeyboardAvoidingView } from "react-native"
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
import { pick, types } from "react-native-document-picker"
import {
  useLazyGetCustomerJobDetailsQuery,
  useLazyGetProProfileQuery,
  useSendMessageMutation,
} from "services/api"

import { RootStackScreenProps } from "navigation/types"
import useChatContext from "hooks/useChatContext"
import useMessagePagination from "hooks/useMessagePagination"
import useMessageGroups, { FlatItem } from "hooks/useMessageGroups"
import useAttachments from "hooks/useAttachments"
import MessageComponent from "components/MessageComponent/MessageComponent"
import { ChatMessageType } from "types/chat"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SendIcon from "assets/icons/send.svg"
import CallIcon from "assets/icons/call.svg"
import ReviewsIcon from "assets/icons/my-reviews.svg"
import DetailsIcon from "assets/icons/details-icon.svg"
import CameraIcon from "assets/icons/camera-icon.svg"
import DocumentIcon from "assets/icons/my-documents.svg"
import LocationIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import ChevronDownIcon from "assets/icons/chevron-down.svg"
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
    onMessageReplaced: pagination.replaceOptimisticMessage,
  })

  const [messageText, setMessageText] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const attachmentSheetRef = useRef<BottomSheet>(null)
  const flatListRef = useRef<FlatList>(null)
  const [sendMessage] = useSendMessageMutation()
  const [getProProfile] = useLazyGetProProfileQuery()
  const [getJobDetails] = useLazyGetCustomerJobDetailsQuery()

  const canSend = messageText.trim().length > 0 || attachments.pending.length > 0

  // Preload recent photos on mount so they're ready when sheet opens
  React.useEffect(() => {
    attachments.loadRecentPhotos()
  }, [])

  // ── Attachment handlers ──
  const handleOpenAttachmentSheet = () => {
    Keyboard.dismiss()
    setTimeout(() => {
      attachmentSheetRef.current?.expand()
    }, 100)
  }

  const handleCameraPress = () => {
    attachmentSheetRef.current?.close()
    attachments.addFromCamera()
  }

  const handleGalleryPress = () => {
    attachmentSheetRef.current?.close()
    attachments.addFromGallery()
  }

  const handleUploadFile = async () => {
    attachmentSheetRef.current?.close()
    try {
      const [result] = await pick({
        mode: "open",
        type: [types.pdf, types.images, types.doc, types.docx],
      })
      if (result) {
        attachments.add({
          path: result.uri,
          mime: result.type || "application/octet-stream",
          filename: result.name || "file",
        })
      }
    } catch (e: any) {
      if (e?.code !== "DOCUMENT_PICKER_CANCELED") {
        console.log("Document pick error:", e)
      }
    }
  }

  const handleLocationPress = () => {
    attachmentSheetRef.current?.close()
    navigation.navigate("PickAddressScreen" as any)
  }

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  )

  // ── Send handler ──
  const handleSend = useCallback(async () => {
    const text = messageText.trim()
    if (!text && attachments.pending.length === 0) return

    setSendError(null)
    setMessageText("")

    if (attachments.pending.length > 0) {
      try {
        await attachments.sendWithAttachments(text)
      } catch (e: any) {
        setMessageText(text)
        setSendError(e?.message || t("failed_to_send"))
      }
    } else {
      try {
        const newMsg = await sendMessage({ chatId: context.chatId, text }).unwrap()
        pagination.addOptimisticMessage(newMsg)
      } catch (e: any) {
        setMessageText(text)
        setSendError(e?.message || t("failed_to_send"))
      }
    }
  }, [messageText, attachments, context.chatId, sendMessage, pagination, t])

  // ── Scroll handlers ──
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollDown(e.nativeEvent.contentOffset.y > 300)
  }, [])

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !isLoadingMore) {
      setIsLoadingMore(true)
      pagination.loadMore()
      setTimeout(() => setIsLoadingMore(false), 1000)
    }
  }, [pagination.hasMore, pagination.loadMore, isLoadingMore])

  // ── Location sending ──
  const sendLocation = useCallback(async (coords: { lat: number; lon: number }) => {
    const optimisticId = -Date.now()
    const optimisticMsg: ChatMessageType = {
      id: optimisticId,
      ownerType: "customer",
      createdAt: new Date().toISOString(),
      location: { id: 0, latitude: coords.lat, longitude: coords.lon },
    }

    pagination.addOptimisticMessage(optimisticMsg)

    try {
      const realMsg = await sendMessage({
        chatId: context.chatId,
        location: { latitude: coords.lat, longitude: coords.lon },
      }).unwrap()

      pagination.replaceOptimisticMessage(optimisticId, realMsg)
    } catch (e: any) {
      // Remove optimistic on failure
      pagination.replaceOptimisticMessage(optimisticId, { ...optimisticMsg, id: -999999 })
      setSendError(e?.message || t("failed_to_send"))
    }
  }, [context.chatId, sendMessage, pagination, t])

  // Listen for address picked from PickAddressScreen
  React.useEffect(() => {
    const handler = (data: any) => {
      if (data?.coords) {
        sendLocation(data.coords)
      }
    }
    addressEventBus.on("address:pick", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
    }
  }, [sendLocation])

  // ── Render items ──
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
        isUploading={attachments.isMessageUploading(item.message.id)}
      />
    )
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                } catch (e) {
                  console.log("Failed to load pro profile:", e)
                }
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

          {/* Action bar */}
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
                  } catch (e) {
                    console.log("Failed to load job details:", e)
                  }
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
            ref={flatListRef}
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
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardDismissMode="interactive"
            removeClippedSubviews
            windowSize={10}
            maxToRenderPerBatch={10}
            ListFooterComponent={
              isLoadingMore ? (
                <DmView className="py-[16] items-center">
                  <ActivityIndicator size="small" color={colors.red} />
                </DmView>
              ) : null
            }
            ListEmptyComponent={
              <DmView className="items-center px-[30]">
                <DmView className="px-[20] py-[16] rounded-12" style={styles.emptyBg}>
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

          {/* Scroll-to-bottom FAB */}
          {showScrollDown && (
            <DmView
              onPress={scrollToBottom}
              className="absolute bottom-[16] right-[16] w-[36] h-[36] rounded-full bg-white items-center justify-center"
              style={styles.scrollFab}
            >
              <ChevronDownIcon width={16} height={16} color={colors.black} />
            </DmView>
          )}
        </DmView>

        {/* Error banner */}
        {sendError && (
          <DmView className="bg-red px-[16] py-[8]" onPress={() => setSendError(null)}>
            <DmText className="text-12 font-custom500 text-white text-center">
              {sendError} — {t("tap_to_dismiss")}
            </DmText>
          </DmView>
        )}

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

            <DmView style={[styles.inputContainer, { borderColor: colors.grey4 }]}>
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
                onPress={canSend ? handleSend : undefined}
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
                    style={[styles.pendingClose, I18nManager.isRTL ? { left: 5, right: undefined } : undefined]}
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
                renderItem={({ item }) => {
                  const isSelected = attachments.isPhotoSelected(item.uri)
                  const selIndex = attachments.getPhotoSelectionIndex(item.uri)
                  const atMax = attachments.pending.length >= 4 && !isSelected

                  return (
                    <DmView
                      onPress={context.isJobInactive || atMax ? undefined : () => attachments.toggleRecentPhoto(item.uri)}
                      className="mr-[6] rounded-6 overflow-hidden"
                      style={[styles.photoStripItem, atMax && !isSelected ? { opacity: 0.4 } : undefined]}
                    >
                      <RNImage source={{ uri: item.uri }} style={styles.photoStripImage} />
                      {isSelected && (
                        <DmView
                          className="absolute top-[4] right-[4] w-[22] h-[22] rounded-full bg-red items-center justify-center"
                        >
                          <DmText className="text-10 font-custom700 text-white">
                            {selIndex + 1}
                          </DmText>
                        </DmView>
                      )}
                    </DmView>
                  )
                }}
              />
            </DmView>

            <DmView className="h-[0.7] bg-grey19 mx-[14]" />

            {/* Upload file option */}
            <DmView
              className="flex-row items-center px-[18] py-[14]"
              onPress={context.isJobInactive ? undefined : handleUploadFile}
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
              onPress={context.isJobInactive ? undefined : handleLocationPress}
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
