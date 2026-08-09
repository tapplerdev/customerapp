import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Image as RNImage,
  Keyboard,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from "react-native"
// Using RN's built-in KeyboardAvoidingView (react-native-keyboard-controller not installed in customer app yet)
import { KeyboardAvoidingView } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
import { pick, types } from "react-native-document-picker"
import {
  api,
  useGetChatsQuery,
  useGetCustomerJobDetailsQuery,
  useLazyGetProProfileQuery,
  useSendMessageMutation,
} from "services/api"
import useRepostRequest from "hooks/useRepostRequest"
import { format } from "date-fns"

import { RootStackScreenProps } from "navigation/types"
import useChatContext from "hooks/useChatContext"
import useMessagePagination from "hooks/useMessagePagination"
import useMessageGroups, { FlatItem } from "hooks/useMessageGroups"
import useAttachments from "hooks/useAttachments"
import MessageComponent from "components/MessageComponent/MessageComponent"
import { ChatMessageType } from "types/chat"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"
import { checkProfanity } from "@tappler/shared/src/profanity"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { scheduleLayoutAnimation } from "helpers/layoutAnimation"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SendArrow from "assets/icons/sendArrow.svg"
import MessageBlockedModal from "components/MessageBlockedModal/MessageBlockedModal"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import { NEAR_FULL_PUSH_BACK_SCALE } from "@tappler/shared/src/components/NativePushBackSheet/NativePushBackSheet"
import CallIcon from "assets/icons/call.svg"
import ReviewsIcon from "assets/icons/my-reviews.svg"
import DetailsIcon from "assets/icons/details-icon.svg"
import CameraIcon from "assets/icons/camera-icon.svg"
import DocumentIcon from "assets/icons/my-documents.svg"
import LocationIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import OfferHistorySheet from "components/OfferHistorySheet/OfferHistorySheet"
import JobMenuSheet from "screens/dashboardScreens/JobDetailScreen/components/JobMenuSheet"
import ChevronDownIcon from "assets/icons/chevron-down.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import ClockIcon from "assets/icons/clock-red-big.svg"
import MapView, { Marker } from "react-native-maps"
import LinearGradient from "react-native-linear-gradient"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"
import { useTypedSelector } from "store"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"

// Short, soft reflow used when the composer expands into / collapses out of its
// focused (toolbar) layout. Opacity property fades the appearing toolbar row.
// Scheduled via scheduleLayoutAnimation (helpers/layoutAnimation), which also
// owns the Android experimental flag and coalesces same-frame schedules.
const COMPOSER_ANIM = LayoutAnimation.create(
  180,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
)

type Props = RootStackScreenProps<"MessagesDetailsScreen">

const MessagesDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { chatPreview: chatPreviewParam } = route.params
  // The route param is a NAVIGATION-TIME SNAPSHOT — after the pro revises an
  // offer, the header badge kept the old rate because the screen never saw the
  // refetched list. Prefer the live cache entry (the offer-updated socket
  // message invalidates Chats); fall back to the snapshot mid-refetch.
  const { liveChatPreview } = useGetChatsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      liveChatPreview: data?.data?.find(
        (c) => c.chat.id === chatPreviewParam.chat.id
      ),
    }),
  })
  const chatPreview = liveChatPreview ?? chatPreviewParam
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  // RTL: RN swaps textAlign left↔right AND marginStart is logical under
  // force-RTL, so "left"/marginStart auto-flip to the right/right-gap in Arabic
  // (and stay left in English) — matching DmText's base text-left. Do NOT use
  // "right" here: it swaps to the visual LEFT in Arabic.
  const rtlText = { textAlign: "left" } as const
  const rtlRow = { marginStart: 12, textAlign: "left" } as const
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  // Deep module hooks
  const context = useChatContext(chatPreview)
  // Offer history sheet (opened from the header's offer strip)
  const [isOfferHistoryVisible, setOfferHistoryVisible] = useState(false)
  // Header ••• menu
  const [isMenuVisible, setMenuVisible] = useState(false)
  // Warm the history in the background so the sheet's first open renders
  // instantly from cache (its own open-refetch still revalidates silently).
  const prefetchOfferHistory = api.usePrefetch("getOfferHistory")
  useEffect(() => {
    const proId = chatPreview.chat.proId
    if (context.jobId && proId && context.offerAmount != null) {
      prefetchOfferHistory(
        { jobId: context.jobId, proId },
        { ifOlderThan: 60 }
      )
    }
  }, [context.jobId, chatPreview.chat.proId, context.offerAmount])

  // Warm the pro's profile too. Tapping the header awaits this same query
  // before it navigates — deliberately, so ProProfileScreen renders from cache
  // instead of flashing a loader — but that put the whole round trip AFTER the
  // tap and before anything moved, which is the pause. Fetching it while the
  // customer reads the conversation means the await resolves from cache and the
  // push is immediate.
  //
  // GET /pros/:id is the heaviest read on this screen, so ifOlderThan keeps a
  // revisited chat from refetching it every time.
  const prefetchProProfile = api.usePrefetch("getProProfile")
  useEffect(() => {
    const proId = context.pro?.id
    if (!proId) return
    prefetchProProfile(
      { proId, serviceCategoryId: context.serviceCategoryId || 0 },
      { ifOlderThan: 120 }
    )
  }, [context.pro?.id, context.serviceCategoryId])
  // Own display name for the More sheet's "You" participant row.
  const authUser = useTypedSelector((store) => store.auth.user)
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
  // Violation modal (ported from proapp): non-null = visible, holds the localized description
  const [blockedModalText, setBlockedModalText] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Composer focus drives the Airbnb-style reflow: idle = single row, focused =
  // text on top + a toolbar row below (see the input-bar JSX for the mechanics).
  const [isInputFocused, setIsInputFocused] = useState(false)
  // Tracks the KEYBOARD, not focus — they differ (simulator with hardware
  // keyboard, external keyboards): the bar only swaps its safe-area padding
  // for the compact 12pt when the keyboard actually covers the bottom inset.
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  // Ref mirror so re-fired events (iOS emits willShow again on QuickType-bar
  // frame changes) don't re-schedule animations for a state that isn't changing.
  const keyboardVisibleRef = useRef(false)
  React.useEffect(() => {
    // willShow/willHide keeps the swap in sync with the KAV slide on iOS;
    // Android only emits did* events.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const onShow = () => {
      if (keyboardVisibleRef.current) return
      keyboardVisibleRef.current = true
      scheduleLayoutAnimation(COMPOSER_ANIM)
      setIsKeyboardVisible(true)
    }
    const onHide = () => {
      if (!keyboardVisibleRef.current) return
      keyboardVisibleRef.current = false
      scheduleLayoutAnimation(COMPOSER_ANIM)
      setIsKeyboardVisible(false)
    }
    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false)
  // "More" sheet — single everything-about-this-conversation entry point
  // (replaces the old action bar + offer bar + decorative three-dot menu).
  // Lazily mount the sheet's MapView on first open — sheet content is mounted
  // with the screen (RN-Modal pattern), and a map instance per chat open
  // would be wasted cost for sheets never opened.
  // Stacked "full request" sheet — presents ON TOP of the More sheet
  // (Airbnb's Show-reservation pattern; the native controller presents from
  // the top-most VC, so stacking is supported by design).
  const [requestSheetVisible, setRequestSheetVisible] = useState(false)
  // Lazy-mount the request sheet's map hero on first open (same reasoning as
  // don't pay a map instance for a sheet that was never opened).
  const [requestSheetOpened, setRequestSheetOpened] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const [sendMessage] = useSendMessageMutation()
  const [getProProfile] = useLazyGetProProfileQuery()
  // Full job for the More sheet's at-a-glance rows — chat-list jobs are slim
  // (no address/dates). Cached by RTK, shared with the card's prefetch.
  const { data: glanceJob } = useGetCustomerJobDetailsQuery(
    context.jobId ?? 0,
    { skip: !context.jobId }
  )
  // "Repost request" on the ended strip: re-enter the request flow
  // pre-filled from THIS job's stored snapshot — a fresh job through the
  // normal path, never a backend clone. glanceJob subscribes the same
  // details query, so the hook's cache-first fetch is warm.
  const repostFromJob = useRepostRequest()
  const handleRepostRequest = useCallback(() => {
    if (context.jobId) repostFromJob(context.jobId)
  }, [context.jobId, repostFromJob])

  const canSend = messageText.trim().length > 0 || attachments.pending.length > 0

  // Preload recent photos on mount so they're ready when sheet opens
  React.useEffect(() => {
    attachments.loadRecentPhotos()
  }, [])

  // ── Attachment handlers ──
  const closeAttachmentSheet = () => setAttachmentSheetVisible(false)

  // Full-request sheet stacks ON TOP — the More sheet stays open behind it.
  const openRequestSheet = () => {
    setRequestSheetOpened(true)
    setRequestSheetVisible(true)
  }
  const closeRequestSheet = () => setRequestSheetVisible(false)

  const handleOpenAttachmentSheet = () => {
    Keyboard.dismiss()
    setTimeout(() => setAttachmentSheetVisible(true), 100)
  }

  const handleCameraPress = () => {
    closeAttachmentSheet()
    attachments.addFromCamera()
  }

  const handleGalleryPress = () => {
    closeAttachmentSheet()
    attachments.addFromGallery()
  }

  const handleUploadFile = async () => {
    closeAttachmentSheet()
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
    closeAttachmentSheet()
    navigation.navigate("PickAddressScreen" as any)
  }

  // Fixed height for the native sheet (it cannot self-measure this content —
  // the camera-roll strip fills in after first layout): top pad 10 + header 28
  // + photo strip 84 + divider 1 + upload row 48 + divider 1 + location row 48
  // = 220, plus bottom inset & inactive note. Strip is 84 = the 70pt tile plus
  // its pb-[14]; keep this in step with photoStripItem in styles.ts, and with
  // proapp, which uses the same numbers.
  const attachmentSheetHeight =
    222 + insets.bottom + (context.isJobInactive ? 26 : 0)

  const renderAttachmentSheetContent = () => (
    <>
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
    </>
  )

  // Route a send failure to the right UI. The backend returns a stable code
  // in validationErrors.text; VIOLATIONS (profanity / contact-info) get the
  // proapp-style bottom modal — the blocked text is already restored into the
  // input by the caller, so "Edit message" just dismisses. Non-violations
  // (couldn't-verify / network) keep the lightweight banner.
  const handleSendFailure = useCallback(
    (e: any) => {
      const code = e?.data?.validationErrors?.text?.[0]
      if (code === "CHAT_BLOCK_PROFANITY") {
        setBlockedModalText(t("message_violates_community_standards"))
        return
      }
      if (code === "CHAT_BLOCK_CONTACT_INFO") {
        setBlockedModalText(t("chat_block_contact_info"))
        return
      }
      setSendError(
        code === "CHAT_BLOCK_UNVERIFIED" ? t("chat_block_unverified") : t("failed_to_send")
      )
    },
    [t]
  )

  // ── Send handler ──
  const handleSend = useCallback(async () => {
    const text = messageText.trim()
    if (!text && attachments.pending.length === 0) return

    // Deterministic client-side profanity fast-block (both text-only and
    // attachment-caption sends flow through here). Same modal as a server
    // CHAT_BLOCK_PROFANITY reject — indistinguishable to the user. The typed
    // text stays in the input so they can edit; the server re-checks on send.
    if (text && checkProfanity(text).blocked) {
      setBlockedModalText(t("message_violates_community_standards"))
      return
    }

    setSendError(null)
    setMessageText("")

    if (attachments.pending.length > 0) {
      try {
        await attachments.sendWithAttachments(text)
      } catch (e: any) {
        setMessageText(text)
        handleSendFailure(e)
      }
    } else {
      // Optimistic: show the bubble immediately (matches proapp + the location/
      // attachment paths), then swap for the server message on success, or
      // remove it + show the reason on a block/failure.
      const optimisticId = -Date.now()
      pagination.addOptimisticMessage({
        id: optimisticId,
        ownerType: "customer",
        text,
        createdAt: new Date().toISOString(),
      } as ChatMessageType)
      try {
        const newMsg = await sendMessage({ chatId: context.chatId, text }).unwrap()
        pagination.replaceOptimisticMessage(optimisticId, newMsg)
      } catch (e: any) {
        pagination.removeOptimisticMessage(optimisticId)
        setMessageText(text)
        handleSendFailure(e)
      }
    }
  }, [messageText, attachments, context.chatId, sendMessage, pagination, t, handleSendFailure])

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
      pagination.removeOptimisticMessage(optimisticId)
      handleSendFailure(e)
    }
  }, [context.chatId, sendMessage, pagination, t, handleSendFailure])

  // Listen for address picked from PickAddressScreen
  React.useEffect(() => {
    const handler = (data: any) => {
      if (!data?.coords) return
      // Only act when focused — the bus is shared: without this, picking an
      // address for SEARCH while this chat sits in the stack would silently
      // send a location message to the pro.
      setTimeout(() => {
        if (!navigation.isFocused()) return
        sendLocation(data.coords)
      }, 600)
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

  // Composer controls — shared between the idle (single-row) and focused
  // (toolbar-row) layouts so their look/behaviour can't drift. Only one layout
  // renders at a time, so reusing the same element in both is safe.
  const plusButton = (
    <DmView
      onPress={handleOpenAttachmentSheet}
      className="w-[30] h-[30] rounded-full bg-grey26 items-center justify-center"
    >
      <DmView className="absolute bg-grey2" style={styles.plusHorizontal} />
      <DmView className="absolute bg-grey2" style={styles.plusVertical} />
    </DmView>
  )

  const sendButton = (
    <DmView
      onPress={canSend ? handleSend : undefined}
      style={[
        styles.sendButton,
        { backgroundColor: canSend ? colors.red : colors.grey29 },
      ]}
    >
      <SendArrow
        width={22}
        height={22}
        color={canSend ? colors.white : colors.grey6}
      />
    </DmView>
  )

  // ── More sheet content ──
  // Rendered by the sheet on both platforms, and by the native sheet's hidden
  // measuring twin — keep it a
  // plain element with no visibility assumptions.
  const moreJob = chatPreview.chat.job
  const moreServiceName = moreJob?.serviceCategory
    ? isAr
      ? moreJob.serviceCategory.nameAr
      : moreJob.serviceCategory.nameEn
    : chatPreview.chat.serviceCategory
      ? isAr
        ? chatPreview.chat.serviceCategory.nameAr
        : chatPreview.chat.serviceCategory.nameEn
      : ""

  // Near-full-screen detent like Airbnb's Details sheet: fixed ✕ header,
  // content scrolls beneath it.
  const nearFullSheetHeight = windowHeight - insets.top + 6

  // At-a-glance facts (area + when). Same accessors as RequestDetailsScreen,
  // incl. the "asap" fallback for undated requests.
  const glanceSource: any = glanceJob ?? moreJob
  const glanceArea =
    glanceSource?.address?.address?.city ||
    glanceSource?.address?.address?.governorate ||
    ""
  const glanceSlotRaw: any = glanceSource?.timeSlots?.[0]
  const glanceSlot = glanceSlotRaw
    ? [glanceSlotRaw.start, glanceSlotRaw.end].filter(Boolean).join(" – ")
    : ""
  const glanceWhen = glanceSource?.dates?.[0]?.date
    ? [
        format(new Date(glanceSource.dates[0].date), "EEEE, dd MMM"),
        glanceSlot,
      ]
        .filter(Boolean)
        .join("  ·  ")
    : glanceSource?.dateType === "asap"
      ? t("as_soon_as_possible")
      : ""
  // Coords chain mirrors RequestDetailsScreen (lat/latitude + lng/longitude
  // fallbacks on the nested address location).
  const glanceLoc: any = glanceSource?.address?.address?.location
  const glanceLat = glanceLoc?.lat ?? glanceLoc?.latitude
  const glanceLng = glanceLoc?.lng ?? glanceLoc?.longitude
  const glanceHasCoords = glanceLat != null && glanceLng != null
  // Full-request sheet data — glanceJob IS the /details payload here (QA
  // included), so no extra query is needed on the customer side.
  const requestAddress = [
    glanceSource?.address?.address?.streetAddress,
    glanceSource?.address?.address?.city,
    glanceSource?.address?.address?.governorate,
  ]
    .filter(Boolean)
    .join(", ")
  const requestQA: any[] = (glanceJob as any)?.questionsAnswers ?? []
  // Pre-filter to renderable label/value rows so the card's dividers can key
  // off the REAL last item (a skipped tail row would leave a dangling line).
  const requestQARows = requestQA
    .map((qa: any) => {
      const label = isAr
        ? qa.question?.textAr || qa.question?.text
        : qa.question?.text
      const optionLabels = qa.options?.length
        ? qa.options
            .map((o: any) =>
              isAr ? o.labelAr ?? o.valueAr ?? o.label ?? o.value : o.label ?? o.value
            )
            .filter(Boolean)
            .join(", ")
        : ""
      const value =
        qa.answer ||
        optionLabels ||
        qa.date ||
        (qa.startTime && qa.endTime ? `${qa.startTime} - ${qa.endTime}` : "") ||
        (qa.files?.length ? `${qa.files.length} file(s)` : "")
      if (!label && !value) return null
      return { key: qa.id ?? qa.questionId, label, value }
    })
    .filter(Boolean) as { key: number; label?: string; value?: string }[]

  const requestSheetContent = (
    <DmView className="flex-1 bg-white" style={styles.sheetContentRound}>
      <DmView className="items-end px-[24] pt-[16] pb-[2]">
        <DmView onPress={closeRequestSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <CloseIcon width={13} height={13} />
        </DmView>
      </DmView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // No overscroll bounce: short sheet content shouldn't rubber-band (reads
        // as "the content is draggable"). With bounce off, a drag at the top
        // passes to the native sheet's pan → only the whole modal drags.
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Map hero — Airbnb's photo-hero slot, static + lazy-mounted */}
        {glanceHasCoords && requestSheetOpened && (
          <DmView className="mt-[14]" style={styles.requestHero} pointerEvents="none">
            <MapView
              style={styles.glanceMap}
              liteMode
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              region={{
                latitude: glanceLat,
                longitude: glanceLng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.002,
              }}
            >
              <Marker coordinate={{ latitude: glanceLat, longitude: glanceLng }}>
                <MapMarkerIcon width={32} height={40} />
              </Marker>
            </MapView>
          </DmView>
        )}

        <DmText className="mt-[16] text-20 leading-[25px] font-custom600 text-black" numberOfLines={2} style={rtlText}>
          {moreServiceName}
        </DmText>
        <DmText className="mt-[3] text-13 leading-[17px] font-custom400 text-grey3" style={rtlText}>
          {context.proName}
        </DmText>
        {context.offerAmount != null && (
          <DmView className="self-start bg-red rounded-full px-[10] py-[3] mt-[8]">
            <DmText className="text-11 leading-[14px] font-custom600 text-white">
              {`${t("offer")} · ${context.offerAmount} ${t("EGP")}`}
            </DmText>
          </DmView>
        )}

        {!!glanceWhen && (
          <DmView className="flex-row items-center mt-[18] rounded-13 bg-grey58 px-[14] py-[12]">
            <DmView className="w-[36] h-[36] rounded-full bg-white items-center justify-center">
              <ClockIcon width={17} height={17} />
            </DmView>
            <DmView className="flex-1 mx-[12]">
              <DmText className="text-11 leading-[14px] font-custom600 text-grey2" style={rtlText}>
                {t("date_and_time")}
              </DmText>
              <DmText className="mt-[2] text-14 leading-[18px] font-custom600 text-black" style={rtlText}>
                {glanceWhen}
              </DmText>
            </DmView>
          </DmView>
        )}

        {!!requestAddress && (
          <DmView className="flex-row items-center mt-[10] rounded-13 bg-grey58 px-[14] py-[12]">
            <DmView className="w-[36] h-[36] rounded-full bg-white items-center justify-center">
              <LocationIcon width={17} height={17} />
            </DmView>
            <DmView className="flex-1 mx-[12]">
              <DmText className="text-11 leading-[14px] font-custom600 text-grey2" style={rtlText}>
                {t("address")}
              </DmText>
              <DmText className="mt-[2] text-13 leading-[18px] font-custom400 text-black" style={rtlText}>
                {requestAddress}
              </DmText>
            </DmView>
          </DmView>
        )}

        {requestQARows.length > 0 && (
          <>
            <DmText className="mt-[24] text-16 leading-[20px] font-custom600 text-black" style={rtlText}>
              {t("request_specifications")}
            </DmText>
            <DmView className="mt-[12] rounded-13 bg-grey58 px-[14] py-[4]">
              {requestQARows.map((row, rowIndex) => (
                <DmView
                  key={row.key}
                  className={
                    rowIndex < requestQARows.length - 1
                      ? "py-[11] border-b-0.5 border-grey29"
                      : "py-[11]"
                  }
                >
                  {!!row.label && (
                    <DmText className="text-13 leading-[17px] font-custom600 text-black" style={rtlText}>
                      {row.label}
                    </DmText>
                  )}
                  {!!row.value && (
                    <DmText className="mt-[3] text-13 leading-[18px] font-custom400 text-grey2" style={rtlText}>
                      {row.value}
                    </DmText>
                  )}
                </DmView>
              ))}
            </DmView>
          </>
        )}
      </ScrollView>
    </DmView>
  )

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <DmView className="bg-white">
          <DmView className="flex-row items-center px-[20] pt-[10] pb-[14]">
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

            {/* Three dots — three 6pt circles, same as the pro app's, drawn
                rather than an asset (there is no dots icon in this app and the
                pro app's "dots-vertical" is a 2x5 grid, not this).
                self-start keeps it level with the NAME line instead of centring
                against the whole name/last-seen block. Only for jobs: a direct
                message has no request to show or cancel. */}
            {context.hasJob && (
              <DmView
                onPress={() => setMenuVisible(true)}
                className="self-start h-[30] flex-row items-center justify-center px-[6]"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
                <DmView className="bg-black rounded-full w-[6] h-[6] mx-[1]" />
              </DmView>
            )}
          </DmView>

          {/* Offer pill — the same one the pro app shows, so the two sides of a
              negotiation render the price identically: indented 70%-width pill,
              black hairline, red label cell, amount large enough to read at a
              glance. Tap still opens the full negotiation trail.

              The inline "History ›" is gone with the slim strip it belonged to;
              the pro app dropped it in the same move. This is CHROME, not a
              bubble, so it mirrors naturally under force-RTL and needs no isAr
              pre-flipping (that rule is for message bubbles).

              Label is "Offer", not the pro app's "Your offer" — over here it is
              the PRO's offer, not the reader's. */}
          {context.offerAmount != null && (
            <DmView
              className="mt-[4] mb-[4] ml-[55] border-0.3 border-black rounded-5 h-[38] flex-row items-center overflow-hidden"
              style={{ width: "70%" }}
              onPress={() => setOfferHistoryVisible(true)}
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
                <DmText
                  className="ml-[4] text-11 leading-[14px] font-custom400"
                  style={{ marginTop: 4 }}
                >
                  {t("EGP")}
                </DmText>
              </DmView>
            </DmView>
          )}

          {/* Action bar — restored verbatim from 1cbacf5^, which is the commit
              that folded these three into the More sheet AND introduced the
              repost strip in their place. They never coexisted, so there is no
              prior arrangement to preserve: the bar goes here and the ended
              strip sits below it, which it only does for ended jobs anyway.
              No border-b of its own (the original had one): the header block
              already closes with a divider, and the ended strip carries
              border-t, so one here would double the hairline.
              Call and My Review are informational, exactly as before — only
              My Request was ever tappable. It now opens the in-app request
              sheet rather than navigating to RequestDetailsScreen; the sheet is
              what replaced that flow (see the More sheet's card comment). */}
          {context.hasJob && (
            <DmView className="px-[16] pt-[8] pb-[10] flex-row justify-around items-center">
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
                onPress={openRequestSheet}
              >
                <DetailsIcon width={20} height={24} />
                <DmText className="mx-[5] text-13 leading-[16] font-custom400">
                  {t("my_request")}
                </DmText>
              </DmView>
            </DmView>
          )}

          {/* Ended strip: expiry is STATE, not just an event — the thread's
              red line records when it happened; this chrome stays glanceable
              forever and carries the job-level action. `ended` only (admin
              cancellations excluded deliberately). */}
          {chatPreview.chat.job?.status === "ended" && (
            <DmView
              className="flex-row items-center px-[14] py-[10] border-t-0.5 border-grey4"
              onPress={handleRepostRequest}
            >
              <DmText
                className="text-13 leading-[16px] font-custom400 text-grey2"
                style={{ textAlign: "left" }}
              >
                {t("request_ended")}
              </DmText>
              <DmView className="flex-1" />
              <DmText className="text-12 leading-[15px] font-custom600 text-red">
                {`${t("repost_request")} ›`}
              </DmText>
            </DmView>
          )}
          <DmView className="border-b-0.5 border-grey4" />
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

        {/* Input bar — the rounded outer sheet (see inputBarSheet) */}
        <DmView
          className="w-full bg-white"
          style={[
            styles.inputBarSheet,
            styles.inputBarShadow,
            // Keyboard up: it covers the home-indicator area, so the safe-area
            // inset would just be a dead band above it. Keyed on the KEYBOARD,
            // not focus — focusing without a software keyboard (simulator with
            // hardware keys) must keep the safe-area padding.
            { paddingBottom: isKeyboardVisible ? 12 : insets.bottom + 10 },
          ]}
        >
          <DmView className="px-[20] pt-[12]">
            {/* Rounded, soft-bordered composer card. Idle = single row; focusing
                expands it — the text jumps to the top and the +/send controls
                drop to a toolbar row below (Airbnb-style). The TextInput never
                unmounts across the reflow, so focus/keyboard is preserved. */}
            <DmView
              style={[
                styles.composerCard,
                isInputFocused && styles.composerCardFocused,
              ]}
            >
              <DmView className="flex-row items-center">
                {!isInputFocused && plusButton}
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  onFocus={() => {
                    scheduleLayoutAnimation(COMPOSER_ANIM)
                    setIsInputFocused(true)
                  }}
                  onBlur={() => {
                    scheduleLayoutAnimation(COMPOSER_ANIM)
                    setIsInputFocused(false)
                  }}
                  placeholder={t("type_a_message")}
                  placeholderTextColor={colors.greyPlaceholder}
                  multiline
                  maxLength={1000}
                  style={[
                    styles.textInput,
                    isInputFocused && styles.textInputFocused,
                    takeFontStyles("font-custom400", i18n.language),
                    { textAlign: isAr ? "right" : "left" },
                  ]}
                />
                {!isInputFocused && sendButton}
              </DmView>

              {isInputFocused && (
                <DmView
                  className="flex-row items-center justify-between"
                  style={styles.toolbarRow}
                >
                  {plusButton}
                  {sendButton}
                </DmView>
              )}
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

      {/* Attachment sheet. One component for both platforms now: native
          push-back on iOS, react-native-modal on Android — the same shell every
          other action sheet in this app uses. Android was on gorhom, which also
          meant it opened by REF while iOS opened by STATE; that split is gone.
          Height is passed because the camera-roll strip populates after first
          layout, so the native self-measure lands short. */}
      <NativeActionSheet
        isVisible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        height={attachmentSheetHeight}
      >
        {/* No grabber — swipe-down still dismisses (pan is on the whole sheet) */}
        <DmView
          className="bg-white rounded-t-12 pt-[10]"
          style={{ paddingBottom: insets.bottom + 2 }}
        >
          {renderAttachmentSheetContent()}
        </DmView>
      </NativeActionSheet>

      {/* Full-request sheet. Near-full (windowHeight - insets.top), so it
          passes NEAR_FULL_PUSH_BACK_SCALE — the native 0.92 that size was
          tuned for — rather than the short-sheet default. It used to stack on
          top of the More sheet; now My Request opens it directly. */}
      <NativeActionSheet
        isVisible={requestSheetVisible}
        onClose={closeRequestSheet}
        height={nearFullSheetHeight}
        pushBackScale={NEAR_FULL_PUSH_BACK_SCALE}
      >
        {requestSheetContent}
      </NativeActionSheet>

      {/* Violation modal (profanity / contact-info) — same UX as the proapp.
          The blocked text is already back in the input; the button dismisses. */}
      <MessageBlockedModal
        isVisible={!!blockedModalText}
        description={blockedModalText ?? ""}
        onClose={() => setBlockedModalText(null)}
      />
      <OfferHistorySheet
        isVisible={isOfferHistoryVisible}
        onClose={() => setOfferHistoryVisible(false)}
        jobId={context.jobId ?? undefined}
        proId={chatPreview.chat.proId ?? undefined}
      />

      {/* The same ••• menu JobDetailScreen uses, not a lookalike — that screen's
          own comment records what happens when this menu gets reimplemented
          (the food branch grew a copy that drifted on icon and dot sizing).
          Details opens the in-app request sheet, the same surface the My
          Request action opens, rather than pushing RequestDetailsScreen — two
          entry points to two different renderings of one thing is how they
          drift apart.
          Cancel goes to the job screen rather than running here: the flow is
          three chained modals (confirm, then reasons, then the mutation) that
          live there, and an irreversible action is worth showing in full
          context. Omitted entirely once the job is no longer active, which is
          the rule JobDetailScreen already applies. */}
      <JobMenuSheet
        isVisible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onShowDetails={() => {
          setMenuVisible(false)
          setTimeout(() => openRequestSheet(), 400)
        }}
        cancelLabel={t("cancel_service_request")}
        onCancel={
          context.jobId && !context.isJobInactive
            ? () => {
                setMenuVisible(false)
                setTimeout(
                  () =>
                    navigation.navigate("JobDetailScreen", {
                      jobId: context.jobId as number,
                    }),
                  400
                )
              }
            : undefined
        }
      />
    </SafeAreaView>
  )
}

export default MessagesDetailsScreen
