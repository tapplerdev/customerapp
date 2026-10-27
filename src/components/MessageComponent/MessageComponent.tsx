import React, { useRef, useState } from "react"
import SystemEventBubble from "components/SystemEventBubble/SystemEventBubble"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image as RNImage,
  Linking,
  Platform,
  StyleSheet,
} from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import OfferUpdateCard, {
  parseOfferUpdate,
} from "components/OfferUpdateCard/OfferUpdateCard"
import moment from "moment"
import "moment/locale/ar"
import Autolink from "react-native-autolink"
import MapView from "react-native-maps"
import MapPinMarker from "@tappler/shared/src/components/MapPinMarker"
import FastImage from "react-native-fast-image"

import { ChatMessageType, ChatFileType } from "types/chat"
import colors from "@tappler/shared/src/styles/colors"
import ImageViewerModal from "components/ImageViewerModal/ImageViewerModal"
import DocumentViewerModal from "@tappler/shared/src/components/DocumentViewerModal"

import DocumentIcon from "assets/icons/job-details.svg"
import { Text, a, px } from "@tappler/shared/src/ds"
import { messageComponentStyles } from "./styles"

const SCREEN_WIDTH = Dimensions.get("window").width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH - 129

interface Props {
  item: ChatMessageType
  isFirstInGroup: boolean
  isLastInGroup: boolean
  showTimestamp?: boolean
  showReadReceipt?: boolean
  readByName?: string
  isUploading?: boolean
  // What the order is, for the lines whose wording depends on it. The server
  // posts one key per step for both modes ("food_order_delivered" is also a
  // pickup's last step), so the chat screen says which kind of order this is.
  isFoodOrder?: boolean
  isPickup?: boolean
}

// ── Fade-in image tile ──
const FadeInImageTile: React.FC<{
  uri: string
  width: number | string
  height: number
  onPress?: () => void
}> = ({ uri, width, height, onPress }) => {
  const opacity = useRef(new Animated.Value(0)).current
  const isLocal = uri?.startsWith("file://") || uri?.startsWith("/") || uri?.startsWith("ph://") || uri?.startsWith("assets-library://")
  const ImageComp = isLocal ? RNImage : FastImage

  return (
    <DmView onPress={onPress} style={{ width, height, overflow: "hidden", backgroundColor: "#E0E0E0" }}>
      <Animated.View style={{ opacity, flex: 1 }}>
        <ImageComp
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onLoad={() => {
            Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start()
          }}
        />
      </Animated.View>
    </DmView>
  )
}

// The four lifecycle steps. They get bubble WEIGHT (see SystemEventBubble's
// tone) but not the alarm red, which stays for the two that end the order.
const FOOD_PROGRESS_KEYS = [
  "food_order_accepted",
  "food_order_preparing",
  "food_order_with_courier",
  // Its pickup counterpart — same stage, so the same progress tone. Without
  // it a pickup order's "ready to collect" line rendered as an alert.
  "food_order_ready_for_pickup",
  "food_order_delivered",
]

const MessageComponent: React.FC<Props> = React.memo(
  ({
    item,
    isFirstInGroup,
    isLastInGroup,
    showTimestamp = true,
    showReadReceipt = false,
    readByName = "",
    isUploading = false,
    isFoodOrder = false,
    isPickup = false,
  }) => {
    const { t, i18n } = useTranslation()
    const isAr = i18n.language === "ar"

    const isMyMessage = item.ownerType === "customer"
    const isSystem = item.ownerType === "system"

    // Per-message viewer state
    const [isViewerVisible, setViewerVisible] = useState(false)
    const [viewerIndex, setViewerIndex] = useState(0)
    const [docViewerFile, setDocViewerFile] = useState<ChatFileType | null>(null)
    // The viewer mounts on this row's first document tap (every message would
    // otherwise carry its own Modal) and then stays, so its close can slide.
    const [isDocViewerMounted, setDocViewerMounted] = useState(false)

    // Locale-set per instance so timestamps read in Arabic ("١٢:٤٧ ص") when the
    // app is Arabic and English ("12:47 AM") otherwise — mirrors proapp (moment).
    const time = moment(item.createdAt)
      .locale(isAr ? "ar" : "en")
      .format("h:mm A")

    const imageFiles = item.files?.filter((f) => f.mimeType?.startsWith("image/")) || []
    const docFiles = item.files?.filter((f) => !f.mimeType?.startsWith("image/")) || []
    const hasFiles = (item.files?.length || 0) > 0
    const hasLocation = !!item.location
    const hasMedia = hasFiles || hasLocation

    // A message with NO text, NO files and NO location is an attachment whose
    // file rows are gone (every chat attachment sent before the backend's
    // 2026-04-07 fix was swept by the nightly unused-file cron, which deleted
    // the storage objects AND the `files` rows). Without this branch the
    // bubble renders as a bare empty grey pill — the "broken bubble" users
    // report as "photos don't show in this chat". Say so instead.
    const isOrphanedAttachment = !item.text && !hasMedia

    // Media items for viewer (full res)
    const mediaItems = imageFiles.map((f) => ({
      uri: f.url1920 || f.url,
    }))

    const handleImagePress = (index: number) => {
      if (isUploading) return
      setViewerIndex(index)
      setViewerVisible(true)
    }

    const handleDocPress = (file: ChatFileType) => {
      if (isUploading) return
      setDocViewerMounted(true)
      setDocViewerFile(file)
    }

    // ── System messages ──
    if (isSystem) {
      // Structured offer revision → a real red bubble, not a grey centred note.
      const offerUpdate = parseOfferUpdate(item.text)
      // Events, not chrome — the quiet red line got skimmed.
      //
      // All six food keys get bubble WEIGHT, but only the two that END the
      // order get the alarm red; the four lifecycle steps use the tinted
      // tone. Red carries no signal by itself here — every system row in this
      // app is already red, including good news like an offer arriving — so
      // the axis that means anything is line-vs-bubble. Five stacked solid
      // reds for one food order would devalue the two that matter.
      const isFoodProgress = FOOD_PROGRESS_KEYS.includes(item.text || "")
      const eventTextKey =
        item.text === "job_expired" ||
        item.text === "job_cancelled_by_customer" ||
        item.text === "food_order_cancelled_by_pro" ||
        item.text === "food_order_declined_by_pro" ||
        isFoodProgress
          ? item.text
          : null
      const isExpiryEvent = !!eventTextKey
      // The wording some of the server's keys need for THIS order. The server
      // posts "food_order_delivered" as a pickup's last step too, which reads
      // "Your order was delivered" to someone who walked in and collected it;
      // and a moderated order is not a "request" (job_cancelled_by_tappler is
      // the service-request line, and the one the server posts for both).
      const textKeyFor = (key: string): string => {
        if (isPickup && key === "food_order_delivered") {
          return "food_order_picked_up"
        }
        if (isFoodOrder && key === "job_cancelled_by_tappler") {
          return "food_order_cancelled_by_tappler_descr"
        }
        return key
      }
      // Which side a system row sits on is decided by WHO DID IT, not by the
      // fact that it is a system row. The customer's own actions belong with
      // the customer's messages; the pro's belong with the pro's. Getting this
      // wrong reads as the other party having done something they did not.
      const isOwnAction =
        item.text === "job_cancelled_by_customer" ||
        item.text === "opportunity_accepted"
      // Every food_order_* system message is the RESTAURANT's doing, so they
      // belong on the pro's side — the opposite of the two above.
      const isProAction = (item.text ?? "").startsWith("food_order_")
      return (
        <DmView style={{ paddingBottom: isLastInGroup ? 12 : 2 }}>
          {/* Sides are PINNED (iMessage-style): own/system on the physical right,
              others on the physical left, in both languages. Native forceRTL flips
              layout in Arabic, so the isAr branch pre-flips to cancel it out. */}
          {/* The card carries its own inline time — outer stamp would double
              it. Follows whichever side its line lands on. */}
          {showTimestamp && !offerUpdate && !isExpiryEvent && (
            <DmView
              style={[
                a.py_4,
                isOwnAction ? (isAr ? messageComponentStyles.textWrapOwnActionAr : messageComponentStyles.textWrapOwnActionNotAr) : (isAr ? messageComponentStyles.textWrapOwnActionNotAr : messageComponentStyles.textWrapOwnActionAr),
              ]}
            >
              <Text size={10} color="tertiary">
                {time}
              </Text>
            </DmView>
          )}
          {eventTextKey ? (
            // Same rule as everywhere else in this file: the side is decided by
            // WHO DID IT.
            //
            // job_expired is nobody's doing and job_cancelled_by_customer is
            // the customer's, so both belong on the own/system side — which is
            // why this used to be hardcoded there. The food keys were then
            // added to the same allowlist without revisiting it, so a
            // restaurant cancelling rendered on the CUSTOMER's side, reading
            // as though they had cancelled their own order. The class string
            // below was byte-identical to the customer's own bubble.
            <DmView
              style={[
                messageComponentStyles.systemEventBubbleWrap,
                isProAction ? (isAr ? messageComponentStyles.systemEventBubbleWrapProActionAr : messageComponentStyles.systemEventBubbleWrapProActionNotAr) : (isAr ? messageComponentStyles.systemEventBubbleWrapProActionNotAr : messageComponentStyles.systemEventBubbleWrapProActionAr),
              ]}
            >
              <SystemEventBubble
                textKey={textKeyFor(eventTextKey)}
                time={time}
                incoming={isProAction}
                tone={isFoodProgress ? "progress" : "alert"}
              />
            </DmView>
          ) : offerUpdate ? (
            // Laid out like an INCOMING bubble, unlike the pro app's copy: the
            // PRO changed the price, so on this screen it belongs on the pro's
            // side. Pinned to the right it sat with the customer's own messages
            // and read as if the customer had revised their own offer.
            // Same 49pt near gutter and 80pt far gutter as a message bubble,
            // mirrored. Pinned, not mirrored by RTL — the isAr classes are
            // pre-flipped so it lands on the physical left in both languages.
            <DmView
              style={[
                messageComponentStyles.systemEventBubbleWrap,
                isAr ? messageComponentStyles.systemEventBubbleWrapProActionAr : messageComponentStyles.systemEventBubbleWrapProActionNotAr,
              ]}
            >
              <OfferUpdateCard
                previous={offerUpdate.previous}
                next={offerUpdate.next}
                time={time}
              />
            </DmView>
          ) : (
            // Side by author. "You accepted this pro's offer" is the customer
            // speaking about themselves, so it belongs on their side — it was
            // previously lumped in with the pro's lines and read as if the pro
            // had accepted something. Anything else here is the pro's doing and
            // stays on the incoming side.
            <DmView
              style={[
                messageComponentStyles.systemEventBubbleWrap,
                isOwnAction ? (isAr ? messageComponentStyles.textWrapOwnActionAr : messageComponentStyles.textWrapOwnActionNotAr) : (isAr ? messageComponentStyles.textWrapOwnActionNotAr : messageComponentStyles.textWrapOwnActionAr),
              ]}
            >
              <Text size={11} leading="tight" color="brand">
                {t(textKeyFor(item.text || ""))}
              </Text>
            </DmView>
          )}
        </DmView>
      )
    }

    // ── Bubble styling ──
    const bubbleBg = isMyMessage ? "#3A3A3A" : "#F5F5F5"
    const textColor = isMyMessage ? "#FFFFFF" : "#000000"
    const linkColor = isMyMessage ? "#8AB4F8" : colors.red

    const r = 12
    const small = 2
    // Native RTL swaps Left/Right corner radii in Arabic — pre-flip so the
    // squared "tail" lands on the same physical corner in both languages
    // (own: bottom-right, other: bottom-left), matching the pinned sides.
    const tailLeft = isAr ? isMyMessage : !isMyMessage
    const bubbleRadius = {
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: isLastInGroup && tailLeft ? small : r,
      borderBottomRightRadius: isLastInGroup && !tailLeft ? small : r,
    }

    const bubbleWidth = BUBBLE_MAX_WIDTH

    // ── Image grid ──
    const renderImageGrid = () => {
      if (imageFiles.length === 0) return null
      const gridHeight = 200
      const gap = 2

      if (imageFiles.length === 1) {
        return (
          <FadeInImageTile
            uri={imageFiles[0].url720 || imageFiles[0].url}
            width="100%"
            height={gridHeight}
            onPress={() => handleImagePress(0)}
          />
        )
      }

      if (imageFiles.length === 2) {
        const halfW = (bubbleWidth - gap) / 2
        return (
          <DmView style={[a.flex_row, { height: gridHeight }]}>
            <FadeInImageTile uri={imageFiles[0].url720 || imageFiles[0].url} width={halfW} height={gridHeight} onPress={() => handleImagePress(0)} />
            <DmView style={{ width: gap }} />
            <FadeInImageTile uri={imageFiles[1].url720 || imageFiles[1].url} width={halfW} height={gridHeight} onPress={() => handleImagePress(1)} />
          </DmView>
        )
      }

      if (imageFiles.length === 3) {
        const leftW = (bubbleWidth * 2) / 3 - gap
        const rightW = bubbleWidth / 3
        const halfH = (gridHeight - gap) / 2
        return (
          <DmView style={[a.flex_row, { height: gridHeight }]}>
            <FadeInImageTile uri={imageFiles[0].url720 || imageFiles[0].url} width={leftW} height={gridHeight} onPress={() => handleImagePress(0)} />
            <DmView style={{ width: gap }} />
            <DmView style={{ width: rightW }}>
              <FadeInImageTile uri={imageFiles[1].url720 || imageFiles[1].url} width={rightW} height={halfH} onPress={() => handleImagePress(1)} />
              <DmView style={{ height: gap }} />
              <FadeInImageTile uri={imageFiles[2].url720 || imageFiles[2].url} width={rightW} height={halfH} onPress={() => handleImagePress(2)} />
            </DmView>
          </DmView>
        )
      }

      // 4+ images
      const leftW = (bubbleWidth * 2) / 3 - gap
      const rightW = bubbleWidth / 3
      const rightItems = imageFiles.slice(1, 4)
      const rightItemH = (gridHeight - gap * (rightItems.length - 1)) / rightItems.length
      return (
        <DmView style={[a.flex_row, { height: gridHeight }]}>
          <FadeInImageTile uri={imageFiles[0].url720 || imageFiles[0].url} width={leftW} height={gridHeight} onPress={() => handleImagePress(0)} />
          <DmView style={{ width: gap }} />
          <DmView style={{ width: rightW }}>
            {rightItems.map((file, idx) => (
              <React.Fragment key={file.id || idx}>
                {idx > 0 && <DmView style={{ height: gap }} />}
                <FadeInImageTile uri={file.url720 || file.url} width={rightW} height={rightItemH} onPress={() => handleImagePress(idx + 1)} />
              </React.Fragment>
            ))}
          </DmView>
        </DmView>
      )
    }

    // ── Document cards ──
    const renderDocuments = () => {
      if (docFiles.length === 0) return null
      return docFiles.map((file) => {
        const ext = file.extension || file.originalName?.split(".").pop() || ""
        return (
          <DmView
            key={file.id}
            onPress={() => handleDocPress(file)}
            style={[a.flex_row, a.items_center, { padding: 10, width: bubbleWidth }]}
          >
            <DmView
              style={[a.items_center, a.justify_center, {
                width: 36,
                height: 36,
                borderRadius: 6,
                backgroundColor: isMyMessage ? "#4A4A4A" : "#E0E0E0",
              }]}
            >
              <DocumentIcon width={18} height={18} color={isMyMessage ? "#FFFFFF" : "#000000"} />
            </DmView>
            <DmView style={[a.flex_1, a.ml_10]}>
              <Text
                size={13}
                weight="semibold"
                leading="legacy"
                style={{ color: textColor }}
                numberOfLines={1}
              >
                {file.originalName || file.fileName}
              </Text>
              <Text
                size={11}
                leading="legacy"
                style={[a.mt_2, { color: isMyMessage ? "#AAAAAA" : "#737385" }]}
              >
                {ext.toUpperCase()}
              </Text>
            </DmView>
          </DmView>
        )
      })
    }

    // ── Location ──
    const renderLocation = () => {
      if (!item.location) return null

      const openInMaps = () => {
        const { latitude, longitude } = item.location!
        const url = Platform.select({
          ios: `maps:0,0?q=${latitude},${longitude}`,
          android: `geo:0,0?q=${latitude},${longitude}`,
        })
        if (url) Linking.openURL(url)
      }

      return (
        <DmView onPress={openInMaps}>
          <MapView
            style={{ width: bubbleWidth, height: 150 }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            pointerEvents="none"
            initialRegion={{
              latitude: item.location.latitude,
              longitude: item.location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
          >
            <MapPinMarker coordinate={{ latitude: item.location.latitude, longitude: item.location.longitude }} />
          </MapView>
          <DmView style={[a.px_14, a.py_6]}>
            <Text size={12} weight="medium" leading="legacy" style={{ color: linkColor }}>
              {t("view_on_maps")} {"\u203A"}
            </Text>
          </DmView>
        </DmView>
      )
    }

    // ── Main render ──
    return (
      <DmView style={{ paddingBottom: isLastInGroup ? 12 : 2 }}>
        {/* Timestamp */}
        {showTimestamp && (
          <DmView
            style={[
              a.py_4,
              isMyMessage ? (isAr ? messageComponentStyles.textWrapOwnActionAr : messageComponentStyles.textWrapOwnActionNotAr) : (isAr ? messageComponentStyles.textWrapNotMyMessageAr : messageComponentStyles.textWrapNotMyMessageNotAr),
            ]}
          >
            <Text size={10} color="tertiary">
              {time}
            </Text>
          </DmView>
        )}

        {/* Bubble — own pinned physical-right, others physical-left (see note above) */}
        <DmView
          style={isMyMessage ? (isAr ? messageComponentStyles.systemEventBubbleWrapProActionNotAr : messageComponentStyles.systemEventBubbleWrapProActionAr) : (isAr ? messageComponentStyles.boxWrapNotMyMessageAr : messageComponentStyles.boxWrapNotMyMessageNotAr)}
        >
          <DmView
            style={[
              {
                backgroundColor: bubbleBg,
                overflow: "hidden",
                maxWidth: bubbleWidth,
              },
              bubbleRadius,
              !hasMedia && { paddingVertical: 8, paddingHorizontal: 14 },
            ]}
          >
            {/* Attachment whose file rows no longer exist — see note above */}
            {isOrphanedAttachment ? (
              <DmView style={[a.flex_row, a.items_center]}>
                <DocumentIcon
                  width={14}
                  height={14}
                  color={isMyMessage ? "#AAAAAA" : "#737385"}
                />
                <Text
                  size={12}
                  leading={{ fixed: px(16) }}
                  style={{ marginStart: 8, fontStyle: "italic", color: isMyMessage ? "#AAAAAA" : "#737385", textAlign: isAr ? "right" : "left" }}
                >
                  {t("attachment_unavailable")}
                </Text>
              </DmView>
            ) : hasMedia && isUploading ? (
              <DmView>
                <DmView style={{ opacity: 0.4 }}>
                  {renderImageGrid()}
                  {renderDocuments()}
                  {renderLocation()}
                </DmView>
                <DmView style={[a.items_center, a.justify_center, StyleSheet.absoluteFill]}>
                  <ActivityIndicator size="small" color={isMyMessage ? "#FFFFFF" : "#000000"} />
                </DmView>
              </DmView>
            ) : (
              <>
                {renderImageGrid()}
                {renderDocuments()}
                {renderLocation()}
              </>
            )}

            {/* Text with auto-linking */}
            {item.text ? (
              <DmView style={hasMedia ? { paddingHorizontal: 14, paddingTop: 5, paddingBottom: 8 } : undefined}>
                <Autolink
                  text={item.text}
                  url
                  phone
                  email
                  linkStyle={{
                    textDecorationLine: "underline",
                    color: linkColor,
                  }}
                  textProps={{
                    style: {
                      fontSize: 13,
                      lineHeight: 20,
                      color: textColor,
                      textAlign: isAr ? "right" : "left",
                    },
                  }}
                />
              </DmView>
            ) : null}
          </DmView>
        </DmView>

        {/* Read receipt */}
        {showReadReceipt && (
          <DmView style={[messageComponentStyles.readByWrap, isAr ? messageComponentStyles.textWrapOwnActionAr : messageComponentStyles.textWrapOwnActionNotAr]}>
            <Text size={9}>
              {t("read_by")} {readByName}
            </Text>
          </DmView>
        )}

        {/* Image viewer — per message */}
        {mediaItems.length > 0 && (
          <ImageViewerModal
            isVisible={isViewerVisible}
            onClose={() => setViewerVisible(false)}
            images={mediaItems}
            initialIndex={viewerIndex}
          />
        )}

        {/* Document viewer — per message. Stays mounted once opened, so
            closing slides it down. */}
        {isDocViewerMounted && (
          <DocumentViewerModal
            isVisible={!!docViewerFile}
            onClose={() => setDocViewerFile(null)}
            uri={docViewerFile?.url ?? ""}
            fileName={
              docViewerFile
                ? docViewerFile.originalName || docViewerFile.fileName
                : ""
            }
          />
        )}
      </DmView>
    )
  },
)

export default MessageComponent
