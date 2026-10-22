import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  I18nManager,
  Image as RNImage,
  Keyboard,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  TextInput,
  useWindowDimensions,
} from "react-native"
import type { FlatList } from "react-native"
// Using RN's built-in KeyboardAvoidingView (react-native-keyboard-controller not installed in customer app yet)
import { KeyboardAvoidingView } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
// react-native-document-picker is npm-deprecated ("the package was renamed")
// and its Android module imports com.facebook.react.bridge.GuardedResultAsyncTask,
// which RN 0.86 deleted — it fails to compile. This is the maintained successor.
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from "@react-native-documents/picker"
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
import CallIcon from "assets/icons/call.svg"
import ReviewsIcon from "assets/icons/my-reviews.svg"
import DetailsIcon from "assets/icons/details-icon.svg"
import CameraIcon from "assets/icons/camera-icon.svg"
import DocumentIcon from "assets/icons/my-documents.svg"
import OrderBill from "components/OrderBill/OrderBill"
import LocationIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import OfferHistorySheet from "components/OfferHistorySheet/OfferHistorySheet"
import JobMenuSheet from "screens/dashboardScreens/JobDetailScreen/components/JobMenuSheet"
import CancelJobFeedbackModal from "components/CancelJobFeedbackModal/CancelJobFeedbackModal"
import { MainModal } from "@tappler/shared/src/components"
import ErrorModal from "components/ErrorModal"
import useCancelJob from "hooks/useCancelJob"
import ChevronDownIcon from "assets/icons/chevron-down.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import ClockIcon from "assets/icons/clock-red-big.svg"
import MapView from "react-native-maps"
import MapPinMarker from "@tappler/shared/src/components/MapPinMarker"
import LinearGradient from "react-native-linear-gradient"
import { useTypedSelector } from "store"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"
import { AppFlatList, AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"

// Short, soft reflow when the input bar swaps its bottom padding as the
// keyboard comes and goes. Kept in lockstep with proapp.
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
  // Cancelling runs HERE rather than sending the customer to the job screen to
  // do it — they opened this menu from the conversation, and bouncing them to
  // another screen to finish an action they already started reads as a dead
  // end. Same two steps the job screen uses (confirm, then reasons), on the
  // same shared components, so the flows cannot drift.
  const [isCancelConfirmVisible, setCancelConfirmVisible] = useState(false)
  const [isCancelFeedbackVisible, setCancelFeedbackVisible] = useState(false)
  const [isCancelErrorVisible, setCancelErrorVisible] = useState(false)
  // The handoffs wait for each card to be GONE (its onModalHide): a modal
  // presented while another is still fading out can fail to show on iOS, or
  // leave an invisible window over the screen. The feedback card cannot be
  // closed while the request is in flight, so it is still up when the result
  // lands.
  const openFeedbackAfterConfirmHideRef = useRef(false)
  const showErrorAfterFeedbackHideRef = useRef(false)
  const cancel = useCancelJob({
    jobId: context.jobId ?? 0,
    onSuccess: () => {
      setCancelFeedbackVisible(false)
      // Stay in the chat. The request is cancelled and the Jobs cache is
      // invalidated by the mutation, so the header's offer pill and the action
      // row settle into their ended state in place — and the pro's own
      // "cancelled by customer" system message lands in this same thread.
      // Popping would hide exactly the screen that shows the outcome.
    },
    onError: () => {
      showErrorAfterFeedbackHideRef.current = true
      setCancelFeedbackVisible(false)
    },
  })
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
  // The composer's input, so Edit message on the blocked-message sheet can put
  // the customer back in it once the sheet is gone.
  const inputRef = useRef<TextInput>(null)
  const refocusAfterSheetRef = useRef(false)
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
    } catch (e) {
      // The cancel code CHANGED with the rename: DOCUMENT_PICKER_CANCELED ->
      // errorCodes.OPERATION_CANCELED. Comparing against the old string would
      // have logged an error every time a user backed out of the picker.
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
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
        <DmView style={[a.px_18, a.pb_10]}>
          <Text size={11} leading="legacy" color="tertiary" align="center" style={styles.italic}>
            {t("attachments_unavailable")}
          </Text>
        </DmView>
      )}

      <DmView style={context.isJobInactive ? { opacity: 0.3 } : undefined}>
        {/* Photos & videos header */}
        <DmView style={[a.flex_row, a.items_center, a.justify_between, a.px_14, a.pb_10]}>
          <Text size={14} weight="semibold" leading="legacy">
            {t("photos_and_videos")}
          </Text>
          <DmView onPress={context.isJobInactive ? undefined : handleGalleryPress}>
            <Text size={13} weight="bold" leading="legacy" color="brand">
              {t("view_library")}
            </Text>
          </DmView>
        </DmView>

        {/* Photo strip */}
        <DmView style={[a.px_14, a.pb_14]}>
          <AppFlatList
            horizontal
            data={attachments.recentPhotos}
            keyExtractor={(item, index) => `photo-${index}`}
            showsHorizontalScrollIndicator={false}
            ListHeaderComponent={
              <DmView
                onPress={context.isJobInactive ? undefined : handleCameraPress}
                style={[a.items_center, a.justify_center, styles.iconWrap, a.mr_6, styles.photoStripItem]}
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
                  style={[a.mr_6, styles.container, a.overflow_hidden, styles.photoStripItem, atMax && !isSelected ? { opacity: 0.4 } : undefined]}
                >
                  <RNImage source={{ uri: item.uri }} style={styles.photoStripImage} />
                  {isSelected && (
                    <DmView
                      style={[
                        a.absolute,
                        styles.textWrap,
                        a.items_center,
                        a.justify_center,
                      ]}
                    >
                      <Text size={10} weight="bold" leading="legacy" color="inverse">
                        {selIndex + 1}
                      </Text>
                    </DmView>
                  )}
                </DmView>
              )
            }}
          />
        </DmView>

        <DmView style={[styles.box, a.mx_14]} />

        {/* Upload file option */}
        <DmView
          style={[a.flex_row, a.items_center, a.px_18, a.py_14]}
          onPress={context.isJobInactive ? undefined : handleUploadFile}
        >
          <DocumentIcon fill={colors.red} width={18} height={20} />
          <Text size={14} weight="medium" style={a.ml_14}>
            {t("upload_file")}
          </Text>
        </DmView>

        <DmView style={[styles.box, { marginStart: 18 }]} />

        {/* Location option */}
        <DmView
          style={[a.flex_row, a.items_center, a.px_18, a.py_14]}
          onPress={context.isJobInactive ? undefined : handleLocationPress}
        >
          <LocationIcon width={18} height={20} />
          <Text size={14} weight="medium" style={a.ml_14}>
            {t("location")}
          </Text>
        </DmView>
      </DmView>
    </>
  )

  // The blocked-message sheet opens from a send, so usually with the keyboard
  // up, and a native sheet presented then opens BEHIND the keyboard: the sheet
  // only moves for an input inside it. All the customer saw was the screen
  // dimming. The typed text stays in the composer. Only this screen's
  // keyboard: a server reject can land after the customer has moved on.
  const showBlockedModal = useCallback(
    (description: string) => {
      refocusAfterSheetRef.current = false
      if (navigation.isFocused()) Keyboard.dismiss()
      setBlockedModalText(description)
    },
    [navigation]
  )

  // Edit message: close the sheet, and once it has gone (onClosed) put the
  // customer back in the composer, keyboard up and their text still there. A
  // swipe or dim-tap close leaves the keyboard down.
  const editBlockedMessage = useCallback(() => {
    refocusAfterSheetRef.current = true
    setBlockedModalText(null)
  }, [])
  const refocusComposerAfterSheet = useCallback(() => {
    const refocus = refocusAfterSheetRef.current
    refocusAfterSheetRef.current = false
    if (refocus && navigation.isFocused()) inputRef.current?.focus()
  }, [navigation])

  // Route a send failure to the right UI. The backend returns a stable code
  // in validationErrors.text; VIOLATIONS (profanity / contact-info) get the
  // proapp-style bottom modal — the blocked text is already restored into the
  // input by the caller, so "Edit message" puts the customer back in it.
  // Non-violations (couldn't-verify / network) keep the lightweight banner.
  const handleSendFailure = useCallback(
    (e: any) => {
      const code = e?.data?.validationErrors?.text?.[0]
      if (code === "CHAT_BLOCK_PROFANITY") {
        showBlockedModal(t("message_violates_community_standards"))
        return
      }
      if (code === "CHAT_BLOCK_CONTACT_INFO") {
        showBlockedModal(t("chat_block_contact_info"))
        return
      }
      setSendError(
        code === "CHAT_BLOCK_UNVERIFIED" ? t("chat_block_unverified") : t("failed_to_send")
      )
    },
    [t, showBlockedModal]
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
      showBlockedModal(t("message_violates_community_standards"))
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
  }, [messageText, attachments, context.chatId, sendMessage, pagination, t, handleSendFailure, showBlockedModal])

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
        <DmView style={[a.items_center, a.justify_center, a.py_8]}>
          <Text size={11} weight="semibold" leading="tight">
            {item.label}
          </Text>
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

  // Composer controls.
  const plusButton = (
    <DmView
      onPress={handleOpenAttachmentSheet}
      style={[styles.box2, a.items_center, a.justify_center, styles.plusButton]}
    >
      <DmView style={[a.absolute, styles.box3, styles.plusHorizontal]} />
      <DmView style={[a.absolute, styles.box3, styles.plusVertical]} />
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
  // A food order carries its detail in foodOrderItems, not in questionsAnswers
  // — menu orders come from the cart/checkout flow, not the question flow,
  // which is why this sheet looked so empty for them.
  const glanceFoodItems: any[] = (glanceJob as any)?.foodOrderItems ?? []
  const glanceIsPickup = (glanceJob as any)?.placeOfService === "pickup"

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
    <DmView style={[a.flex_1, styles.box4, styles.sheetContentRound]}>
      <DmView style={[a.items_end, a.px_24, a.pt_16, a.pb_2]}>
        <DmView onPress={closeRequestSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <CloseIcon width={13} height={13} />
        </DmView>
      </DmView>
      <AppScrollView
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
          <DmView style={[a.mt_14, styles.requestHero]} pointerEvents="none">
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
              <MapPinMarker coordinate={{ latitude: glanceLat, longitude: glanceLng }} />
            </MapView>
          </DmView>
        )}

        <Text size={20} weight="semibold" leading={px(25)} numberOfLines={2} style={[a.mt_16, rtlText]}>
          {moreServiceName}
        </Text>
        <Text size={13} leading={px(17)} color="tertiary" style={[styles.text, rtlText]}>
          {context.proName}
        </Text>
        {context.offerAmount != null && (
          <DmView style={[a.self_start, styles.textWrap2, a.px_10, a.mt_8]}>
            <Text size={11} weight="semibold" leading="tight" color="inverse">
              {`${t("offer")} · ${context.offerAmount} ${t("EGP")}`}
            </Text>
          </DmView>
        )}

        {!!glanceWhen && (
          <DmView style={[a.flex_row, a.items_center, a.mt_18, styles.row, a.px_14, a.py_12]}>
            <DmView style={[styles.iconWrap2, a.items_center, a.justify_center]}>
              <ClockIcon width={17} height={17} />
            </DmView>
            <DmView style={[a.flex_1, a.mx_12]}>
              <Text size={11} weight="semibold" leading="tight" color="secondary" style={rtlText}>
                {t("date_and_time")}
              </Text>
              <Text size={14} weight="semibold" style={[a.mt_2, rtlText]}>
                {glanceWhen}
              </Text>
            </DmView>
          </DmView>
        )}

        {!!requestAddress && (
          <DmView style={[a.flex_row, a.items_center, a.mt_10, styles.row, a.px_14, a.py_12]}>
            <DmView style={[styles.iconWrap2, a.items_center, a.justify_center]}>
              <LocationIcon width={17} height={17} />
            </DmView>
            <DmView style={[a.flex_1, a.mx_12]}>
              <Text size={11} weight="semibold" leading="tight" color="secondary" style={rtlText}>
                {t("address")}
              </Text>
              <Text size={13} style={[a.mt_2, rtlText]}>
                {requestAddress}
              </Text>
            </DmView>
          </DmView>
        )}

        {/* A food order's "request" IS the order, and this sheet showed none of
            it — a map, a category name and an address, then nothing. Not a
            missing feature: RequestDetailsScreen renders the full bill and is
            still registered, and this sheet replaced a navigation to it, so
            the food rendering was dropped in that swap.

            No data change was needed. This sheet already subscribes
            /jobs/customer-jobs/:id/details, whose relation set includes
            foodOrderItems — the same query, same arg, same cache entry that
            RequestDetailsScreen reads. It was holding the whole order and
            rendering a service-request body over it. */}
        {!!glanceFoodItems.length && (
          <>
            {!!glanceJob?.paymentMethod && (
              <DmView style={[a.flex_row, a.items_center, a.mt_10, styles.row, a.px_14, a.py_12]}>
                <DmView style={a.flex_1}>
                  <Text size={11} weight="semibold" leading="tight" color="secondary" style={rtlText}>
                    {t("payment_method")}
                  </Text>
                  <Text size={13} style={[a.mt_2, rtlText]}>
                    {/* NOT t(paymentMethod): the stored value is "creditCard",
                        and there is no such key — it rendered the raw string.
                        The four keys below all exist, and this is exactly what
                        FoodOrderView already does for the same field. */}
                    {glanceJob.paymentMethod === "creditCard"
                      ? t(glanceIsPickup ? "card_on_pickup" : "card_on_delivery")
                      : t(glanceIsPickup ? "cash_on_pickup" : "cash_on_delivery")}
                  </Text>
                </DmView>
              </DmView>
            )}

            {!!glanceJob?.orderNotes && (
              <DmView style={[a.mt_10, styles.row, a.px_14, a.py_12]}>
                <Text size={11} weight="semibold" leading="tight" color="secondary" style={rtlText}>
                  {t("order_notes")}
                </Text>
                <Text size={13} style={[a.mt_2, rtlText]}>
                  {glanceJob.orderNotes}
                </Text>
              </DmView>
            )}

            <OrderBill
              textStyle={rtlText}
              job={glanceJob as any}
              isPickup={glanceIsPickup}
            />
          </>
        )}

        {requestQARows.length > 0 && (
          <>
            <Text size={16} weight="semibold" style={[a.mt_24, rtlText]}>
              {t("request_specifications")}
            </Text>
            <DmView style={[a.mt_12, styles.row, a.px_14, a.py_4]}>
              {requestQARows.map((row, rowIndex) => (
                <DmView
                  key={row.key}
                  style={rowIndex < requestQARows.length - 1 ? styles.containerLength : styles.containerNotLength}
                >
                  {!!row.label && (
                    <Text size={13} weight="semibold" leading={px(17)} style={rtlText}>
                      {row.label}
                    </Text>
                  )}
                  {!!row.value && (
                    <Text size={13} color="secondary" style={[styles.text, rtlText]}>
                      {row.value}
                    </Text>
                  )}
                </DmView>
              ))}
            </DmView>
          </>
        )}
      </AppScrollView>
    </DmView>
  )

  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.box4]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <DmView style={styles.box4}>
          <DmView style={[a.flex_row, a.items_center, a.px_20, a.pt_10, a.pb_14]}>
            <DmView
              onPress={() => navigation.goBack()}
              style={I18nManager.isRTL && styles.iconWrapRtl}
            >
              <ChevronLeftIcon color={colors.red} />
            </DmView>

            <DmView
              style={[a.flex_1, a.flex_row, a.items_center, a.px_10]}
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
                <DmView style={[styles.imageWrap, a.overflow_hidden, a.mr_10]}>
                  <FastImage
                    source={{ uri: context.pro.profilePhoto150 || context.pro.profilePhoto }}
                    style={styles.headerAvatar}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </DmView>
              ) : (
                <DmView style={[styles.textWrap3, a.items_center, a.justify_center, a.mr_10]}>
                  <Text size={14} weight="semibold" leading="legacy" color="inverse">
                    {context.proName.charAt(0)}
                  </Text>
                </DmView>
              )}
              <DmView style={a.flex_1}>
                <Text
                  size={16}
                  weight="semibold"
                  leading="tight"
                  numberOfLines={1}
                >
                  {context.proName}
                </Text>
                {!!context.lastSeenText && (
                  <Text size={11} leading="tight" color="tertiary">
                    {context.lastSeenText}
                  </Text>
                )}
              </DmView>
            </DmView>

            {/* Three dots — three 6pt circles, same as the pro app's, drawn
                rather than an asset (there is no dots icon in this app and the
                pro app's "dots-vertical" is a 2x5 grid, not this).
                self-start keeps it level with the NAME line instead of centring
                against the whole name/last-seen block. Always shown: block and
                report are about the person, not the request, so a direct
                message with no job still has a menu worth opening. */}
            <DmView
              onPress={() => setMenuVisible(true)}
              style={[
                a.self_start,
                styles.row2,
                a.flex_row,
                a.items_center,
                a.justify_center,
                a.px_6,
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <DmView style={styles.box5} />
              <DmView style={styles.box5} />
              <DmView style={styles.box5} />
            </DmView>
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
              style={[a.my_4, styles.row3, a.flex_row, a.items_center, a.overflow_hidden, { width: "70%" }]}
              onPress={() => setOfferHistoryVisible(true)}
            >
              <DmView style={[styles.offerWrap, a.h_full, a.items_center, a.justify_center]}>
                <Text size={13} weight="semibold" leading="tight" color="inverse" style={styles.offer}>
                  {t("offer")}
                </Text>
              </DmView>
              <DmView style={[styles.row4, a.h_full, a.flex_row, a.items_center, a.justify_center]}>
                <Text size={22} weight="medium" leading="tight">
                  {context.offerAmount}
                </Text>
                <Text
                  size={11}
                  leading="tight"
                  style={[a.ml_4, { marginTop: 4 }]}
                >
                  {t("EGP")}
                </Text>
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
            <DmView style={[a.px_16, a.pt_8, a.pb_10, a.flex_row, styles.row5, a.items_center]}>
              <DmView style={[a.flex_row, a.items_center]}>
                <CallIcon width={22} height={22} />
                <Text size={13} leading="legacy" style={styles.call}>
                  {t("call")}
                </Text>
              </DmView>
              <DmView style={[a.flex_row, a.items_center]}>
                <ReviewsIcon width={32} height={20} />
                <Text size={13} leading="legacy" style={styles.call}>
                  {t("my_review")}
                </Text>
              </DmView>
              <DmView
                style={[a.flex_row, a.items_center]}
                onPress={openRequestSheet}
              >
                <DetailsIcon width={20} height={24} />
                <Text size={13} leading="legacy" style={styles.call}>
                  {t("my_request")}
                </Text>
              </DmView>
            </DmView>
          )}

          {/* Ended strip: expiry is STATE, not just an event — the thread's
              red line records when it happened; this chrome stays glanceable
              forever and carries the job-level action. `ended` only (admin
              cancellations excluded deliberately). */}
          {chatPreview.chat.job?.status === "ended" && (
            <DmView
              style={[
                a.flex_row,
                a.items_center,
                a.px_14,
                a.py_10,
                styles.row6,
              ]}
              onPress={handleRepostRequest}
            >
              <Text
                size={13}
                leading="tight"
                color="secondary"
                style={{ textAlign: "left" }}
              >
                {t("request_ended")}
              </Text>
              <DmView style={a.flex_1} />
              <Text size={12} weight="semibold" leading="tight" color="brand">
                {`${t("repost_request")} ›`}
              </Text>
            </DmView>
          )}
          <DmView style={styles.box6} />
        </DmView>

        {/* Messages list */}
        <DmView style={[a.flex_1, styles.relative]}>
          <AppFlatList
            ref={flatListRef}
            data={groups.flatData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            style={[a.flex_1, styles.box4]}
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
                <DmView style={[a.py_16, a.items_center]}>
                  <ActivityIndicator size="small" color={colors.red} />
                </DmView>
              ) : null
            }
            ListEmptyComponent={
              <DmView style={[a.items_center, a.px_30]}>
                <DmView style={[a.px_20, a.py_16, styles.requestSentToProInfoWrap, styles.emptyBg]}>
                  <Text
                    size={13}
                    leading="loose"
                    color="tertiary"
                    align="center"
                    style={styles.italic}
                  >
                    {t("request_sent_to_pro_info")}
                  </Text>
                </DmView>
              </DmView>
            }
          />

          {/* Scroll-to-bottom FAB */}
          {showScrollDown && (
            <DmView
              onPress={scrollToBottom}
              style={[a.absolute, styles.iconWrap3, a.items_center, a.justify_center, styles.scrollFab]}
            >
              <ChevronDownIcon width={16} height={16} color={colors.black} />
            </DmView>
          )}
        </DmView>

        {/* Error banner */}
        {sendError && (
          <DmView style={[styles.tapToDismissWrap, a.px_16, a.py_8]} onPress={() => setSendError(null)}>
            <Text size={12} weight="medium" leading="legacy" color="inverse" align="center">
              {sendError} — {t("tap_to_dismiss")}
            </Text>
          </DmView>
        )}

        {/* Input bar — the rounded outer sheet (see inputBarSheet) */}
        <DmView
          style={[a.w_full, styles.box4, 
            styles.inputBarSheet,
            styles.inputBarShadow,
            // Keyboard up: it covers the home-indicator area, so the safe-area
            // inset would just be a dead band above it. Keyed on the KEYBOARD,
            // not focus — focusing without a software keyboard (simulator with
            // hardware keys) must keep the safe-area padding.
            { paddingBottom: isKeyboardVisible ? 12 : insets.bottom + 10 },
          ]}
        >
          <DmView style={[a.px_20, a.pt_12]}>
            {/* WhatsApp-style: + / field / send on one row, focused or not.
                The field is one line tall until the text fills it, then grows
                a line at a time and scrolls after six (styles). The row is
                bottom-aligned, so the buttons ride the last line. This
                replaced the focus reflow that dropped + and send to a toolbar
                row under the text (2026-10-06 ticket). */}
            <DmView style={styles.composerCard}>
              <DmView style={[a.flex_row, a.items_end]}>
                {plusButton}
                <TextInput
                  ref={inputRef}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder={t("type_a_message")}
                  placeholderTextColor={colors.greyPlaceholder}
                  multiline
                  maxLength={1000}
                  style={[
                    styles.textInput,
                    takeFontStyles("font-custom400", i18n.language),
                    { textAlign: isAr ? "right" : "left" },
                  ]}
                />
                {sendButton}
              </DmView>
            </DmView>
          </DmView>

          {/* Pending attachments preview */}
          {attachments.pending.length > 0 && (
            <DmView style={[a.flex_row, a.flex_wrap, a.px_20, a.pt_8, a.pb_2]}>
              {attachments.pending.map((attachment, index) => (
                <DmView key={index} style={styles.pendingWrapper}>
                  <DmView style={styles.pendingThumb}>
                    {attachments.isImageMime(attachment.mime) ? (
                      <RNImage
                        source={{ uri: attachment.path }}
                        style={styles.pendingImage}
                      />
                    ) : (
                      <DmView style={[a.w_full, a.h_full, styles.iconWrap4, a.items_center, a.justify_center]}>
                        <DocumentIcon width={24} height={30} />
                      </DmView>
                    )}
                  </DmView>
                  <DmView
                    style={[a.absolute, styles.pendingClose, I18nManager.isRTL ? { left: 5, right: undefined } : undefined]}
                    onPress={() => attachments.remove(index)}
                  >
                    <DmView style={[styles.iconWrap5, a.border_1, a.items_center, a.justify_center]}>
                      <CloseIcon width={8} height={8} />
                    </DmView>
                  </DmView>
                </DmView>
              ))}
            </DmView>
          )}
        </DmView>
      </KeyboardAvoidingView>

      {/* Attachment sheet. One component AND one native view for both platforms:
          NativeActionSheet has no react-native-modal in it any more, so Android
          gets Material's BottomSheetDialog through the same TapplerSheetView iOS
          uses. Android was on gorhom, which also meant it opened by REF while iOS
          opened by STATE; that split is gone.
          Height is passed because the camera-roll strip populates after first
          layout, so the native self-measure lands short. */}
      <NativeActionSheet
        isVisible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        height={attachmentSheetHeight}
      >
        {/* No grabber — swipe-down still dismisses (pan is on the whole sheet) */}
        <DmView
          style={[styles.box7, a.pt_10, { paddingBottom: insets.bottom + 2 }]}
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
      >
        {requestSheetContent}
      </NativeActionSheet>

      {/* Violation modal (profanity / contact-info) — same UX as the proapp.
          The blocked text is already back in the input; Edit message closes
          the sheet and refocuses it. */}
      <MessageBlockedModal
        isVisible={!!blockedModalText}
        description={blockedModalText ?? ""}
        onClose={() => setBlockedModalText(null)}
        onEdit={editBlockedMessage}
        onClosed={refocusComposerAfterSheet}
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
          Cancel runs here now, on the shared confirm + reasons modals, so the
          customer finishes in the conversation they started from. Both job
          rows drop out once there is no active job; block and report stay, so
          a direct message still opens a useful menu.

          Every row waits out the sheet's dismissal before presenting its own
          modal — back-to-back native presentations collide otherwise. */}
      <JobMenuSheet
        isVisible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onShowDetails={
          context.hasJob
            ? () => {
                setMenuVisible(false)
                setTimeout(() => openRequestSheet(), 400)
              }
            : undefined
        }
        cancelLabel={t("cancel_service_request")}
        onCancel={
          context.jobId && !context.isJobInactive
            ? () => {
                setMenuVisible(false)
                setTimeout(() => setCancelConfirmVisible(true), 400)
              }
            : undefined
        }
        // UI only for now — the pro app's equivalents are stubs too, because
        // there is no block endpoint and job-reports has no POST (its rows are
        // created by a listener, not by a user). Wired as no-ops rather than
        // omitted so the menu matches across both apps once the endpoints land.
        onBlock={() => setMenuVisible(false)}
        onReport={() => setMenuVisible(false)}
      />

      {/* Are you sure? — then the reasons. Same two steps, same components as
          the job screen. */}
      <MainModal
        isVisible={isCancelConfirmVisible}
        onClose={() => setCancelConfirmVisible(false)}
        title={t("are_you_sure_cancel")}
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={() => {
          openFeedbackAfterConfirmHideRef.current = true
          setCancelConfirmVisible(false)
        }}
        onPressSecond={() => setCancelConfirmVisible(false)}
        onModalHide={() => {
          if (openFeedbackAfterConfirmHideRef.current) {
            openFeedbackAfterConfirmHideRef.current = false
            setCancelFeedbackVisible(true)
          }
        }}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        btnsStyle={styles.mainModalBtns}
        btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
        modalStyle={styles.mainModalModal}
      />

      <CancelJobFeedbackModal
        isVisible={isCancelFeedbackVisible}
        onClose={() => setCancelFeedbackVisible(false)}
        onModalHide={() => {
          if (showErrorAfterFeedbackHideRef.current) {
            showErrorAfterFeedbackHideRef.current = false
            setCancelErrorVisible(true)
          }
        }}
        cancel={cancel}
      />

      {/* Same ErrorModal and same copy the job screen shows when a cancel
          fails — no point inventing a second wording for one outcome. */}
      <ErrorModal
        isVisible={isCancelErrorVisible}
        onClose={() => setCancelErrorVisible(false)}
        descr={t("an_error_occurred")}
      />
    </SafeAreaView>
  )
}

export default MessagesDetailsScreen
