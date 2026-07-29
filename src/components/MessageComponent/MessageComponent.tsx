import React, { useRef, useState } from "react"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image as RNImage,
  Linking,
  Platform,
  StyleSheet,
} from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import OfferUpdateCard, {
  parseOfferUpdate,
} from "components/OfferUpdateCard/OfferUpdateCard"
import moment from "moment"
import "moment/locale/ar"
import Autolink from "react-native-autolink"
import MapView, { Marker } from "react-native-maps"
import FastImage from "react-native-fast-image"

import { ChatMessageType, ChatFileType } from "types/chat"
import colors from "@tappler/shared/src/styles/colors"
import ImageViewerModal from "components/ImageViewerModal/ImageViewerModal"
import DocumentViewerModal from "components/DocumentViewerModal/DocumentViewerModal"

import DocumentIcon from "assets/icons/job-details.svg"

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

const MessageComponent: React.FC<Props> = React.memo(
  ({
    item,
    isFirstInGroup,
    isLastInGroup,
    showTimestamp = true,
    showReadReceipt = false,
    readByName = "",
    isUploading = false,
  }) => {
    const { t, i18n } = useTranslation()
    const isAr = i18n.language === "ar"

    const isMyMessage = item.ownerType === "customer"
    const isSystem = item.ownerType === "system"

    // Per-message viewer state
    const [isViewerVisible, setViewerVisible] = useState(false)
    const [viewerIndex, setViewerIndex] = useState(0)
    const [docViewerFile, setDocViewerFile] = useState<ChatFileType | null>(null)

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
      setDocViewerFile(file)
    }

    // ── System messages ──
    if (isSystem) {
      // Structured offer revision → event card (old → new), not red text.
      const offerUpdate = parseOfferUpdate(item.text)
      return (
        <DmView style={{ paddingBottom: isLastInGroup ? 12 : 2 }}>
          {/* Sides are PINNED (iMessage-style): own/system on the physical right,
              others on the physical left, in both languages. Native forceRTL flips
              layout in Arabic, so the isAr branch pre-flips to cancel it out. */}
          {/* The card carries its own inline time — outer stamp would double it */}
          {showTimestamp && !offerUpdate && (
            <DmView className={`pb-[4] pt-[4] ${isAr ? "items-start pl-[49]" : "items-end pr-[49]"}`}>
              <DmText className="text-10 leading-[13px] font-custom400 text-grey3">
                {time}
              </DmText>
            </DmView>
          )}
          {offerUpdate ? (
            <OfferUpdateCard
              previous={offerUpdate.previous}
              next={offerUpdate.next}
              time={time}
            />
          ) : (
            <DmView className={`flex ${isAr ? "pl-[49] items-start" : "pr-[49] items-end"}`}>
              <DmText className="text-11 leading-[14px] font-custom400 text-red">
                {t(item.text || "")}
              </DmText>
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
          <DmView className="flex-row" style={{ height: gridHeight }}>
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
          <DmView className="flex-row" style={{ height: gridHeight }}>
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
        <DmView className="flex-row" style={{ height: gridHeight }}>
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
            className="flex-row items-center"
            style={{ padding: 10, width: bubbleWidth }}
          >
            <DmView
              className="items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                backgroundColor: isMyMessage ? "#4A4A4A" : "#E0E0E0",
              }}
            >
              <DocumentIcon width={18} height={18} color={isMyMessage ? "#FFFFFF" : "#000000"} />
            </DmView>
            <DmView className="flex-1 ml-[10]">
              <DmText
                className="text-13 font-custom600"
                style={{ color: textColor }}
                numberOfLines={1}
              >
                {file.originalName || file.fileName}
              </DmText>
              <DmText
                className="text-11 font-custom400 mt-[2]"
                style={{ color: isMyMessage ? "#AAAAAA" : "#737385" }}
              >
                {ext.toUpperCase()}
              </DmText>
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
            <Marker coordinate={{ latitude: item.location.latitude, longitude: item.location.longitude }} />
          </MapView>
          <DmView className="px-[14] py-[6]">
            <DmText className="text-12 font-custom500" style={{ color: linkColor }}>
              {t("view_on_maps")} {"\u203A"}
            </DmText>
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
            className={`pb-[4] pt-[4] ${
              isMyMessage
                ? isAr ? "items-start pl-[49]" : "items-end pr-[49]"
                : isAr ? "items-end pr-[53]" : "items-start pl-[53]"
            }`}
          >
            <DmText className="text-10 leading-[13px] font-custom400 text-grey3">
              {time}
            </DmText>
          </DmView>
        )}

        {/* Bubble — own pinned physical-right, others physical-left (see note above) */}
        <DmView
          className={
            isMyMessage
              ? isAr ? "items-start pl-[49] mr-[80]" : "items-end pr-[49] ml-[80]"
              : isAr ? "items-end pr-[53] pl-[80]" : "items-start pl-[53] pr-[80]"
          }
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
              <DmView className="flex-row items-center">
                <DocumentIcon
                  width={14}
                  height={14}
                  color={isMyMessage ? "#AAAAAA" : "#737385"}
                />
                <DmText
                  className="font-custom400"
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    marginStart: 8,
                    fontStyle: "italic",
                    color: isMyMessage ? "#AAAAAA" : "#737385",
                    textAlign: isAr ? "right" : "left",
                  }}
                >
                  {t("attachment_unavailable")}
                </DmText>
              </DmView>
            ) : hasMedia && isUploading ? (
              <DmView>
                <DmView style={{ opacity: 0.4 }}>
                  {renderImageGrid()}
                  {renderDocuments()}
                  {renderLocation()}
                </DmView>
                <DmView style={StyleSheet.absoluteFillObject} className="items-center justify-center">
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
          <DmView className={`pt-[3] ${isAr ? "items-start pl-[49]" : "items-end pr-[49]"}`}>
            <DmText className="text-9 leading-[12px] font-custom400 text-black">
              {t("read_by")} {readByName}
            </DmText>
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

        {/* Document viewer — per message */}
        {docViewerFile && (
          <DocumentViewerModal
            isVisible={!!docViewerFile}
            onClose={() => setDocViewerFile(null)}
            uri={docViewerFile.url}
            fileName={docViewerFile.originalName || docViewerFile.fileName}
          />
        )}
      </DmView>
    )
  },
)

export default MessageComponent
