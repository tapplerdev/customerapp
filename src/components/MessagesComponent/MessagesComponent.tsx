import React, { useCallback, useMemo, useRef } from "react"
import { Animated, Dimensions, I18nManager } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { Swipeable } from "react-native-gesture-handler"
import FastImage from "react-native-fast-image"
import { format, isToday, isYesterday } from "date-fns"

import { ChatPreviewType } from "types/chat"

import LocationIcon from "assets/icons/location-red.svg"
import DocumentIcon from "assets/icons/my-documents.svg"

import styles from "./styles"

const SCREEN_WIDTH = Dimensions.get("window").width

interface Props {
  item: ChatPreviewType
  onPress: () => void
  onArchive?: (chatId: number) => void
}

const MessagesComponent: React.FC<Props> = React.memo(
  ({ item, onPress, onArchive }) => {
    const { t, i18n } = useTranslation()
    const isAr = i18n.language === "ar"
    const swipeableRef = useRef<Swipeable>(null)
    const heightAnim = useRef(new Animated.Value(1)).current
    const translateAnim = useRef(new Animated.Value(0)).current

    const { chat, notReadMessages, lastMessage } = item
    const proName = chat.pro?.businessName || chat.pro?.registeredName || ""
    const proPhoto = chat.pro?.profilePhoto150 || chat.pro?.profilePhoto
    const serviceName = isAr
      ? chat.serviceCategory?.nameAr
      : chat.serviceCategory?.nameEn

    const lastMsg = lastMessage
    const imageFiles = useMemo(
      () => (lastMsg?.files || []).filter((f) => f.mimeType?.startsWith("image/")),
      [lastMsg?.files]
    )
    const docFiles = useMemo(
      () => (lastMsg?.files || []).filter((f) => !f.mimeType?.startsWith("image/")),
      [lastMsg?.files]
    )
    const hasLocation = !!lastMsg?.location
    const hasImages = imageFiles.length > 0
    const hasDocs = docFiles.length > 0

    const formatTime = useCallback(
      (dateStr?: string) => {
        if (!dateStr) return ""
        const date = new Date(dateStr)
        if (isToday(date)) {
          return format(date, "h:mm a")
        }
        if (isYesterday(date)) {
          return t("yesterday")
        }
        return isAr
          ? format(date, "yyyy/MM/dd")
          : format(date, "dd/MM/yyyy")
      },
      [isAr, t],
    )

    const handleArchive = useCallback(() => {
      swipeableRef.current?.close()
      const direction = I18nManager.isRTL ? SCREEN_WIDTH : -SCREEN_WIDTH
      Animated.timing(translateAnim, {
        toValue: direction,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          onArchive?.(chat.id)
        })
      })
    }, [chat.id, onArchive, translateAnim, heightAnim])

    const renderArchiveAction = () => (
      <DmView
        onPress={handleArchive}
        className="bg-red justify-center items-center"
        style={styles.archiveAction}
      >
        <DmText className="text-white text-13 font-custom600">
          {t("archive")}
        </DmText>
      </DmView>
    )

    const content = (
      <DmView onPress={onPress} className="bg-white">
        <DmView className="px-[15] pt-[10] pb-[13]">
          <DmView className="flex-row items-start">
            {/* Avatar */}
            {proPhoto ? (
              <DmView className="w-[40] h-[40] rounded-full overflow-hidden mr-[10]">
                <FastImage
                  source={{ uri: proPhoto }}
                  style={styles.avatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </DmView>
            ) : (
              <DmView className="w-[40] h-[40] rounded-full bg-red items-center justify-center mr-[10]">
                <DmText className="text-white text-16 font-custom600">
                  {proName.charAt(0)}
                </DmText>
              </DmView>
            )}
            <DmView className="flex-1">
              {/* Name + time */}
              <DmView className="flex-row items-center justify-between">
                <DmText
                  className="text-15 font-custom600 text-black flex-1"
                  numberOfLines={1}
                >
                  {proName}
                </DmText>
                <DmText className="text-11 font-custom400 text-grey3 mr-[5]">
                  {formatTime(lastMessage?.createdAt || chat.createdAt)}
                </DmText>
              </DmView>
              {/* Service name + unread badge */}
              <DmView className="flex-row items-center justify-between mt-[2]">
                <DmText
                  className="text-13 font-custom500 text-black flex-1"
                  numberOfLines={1}
                >
                  {serviceName}
                </DmText>
                {notReadMessages > 0 && (
                  <DmView className="bg-red rounded-full w-[24] h-[24] items-center justify-center">
                    <DmText className="text-white text-13 font-custom700">
                      {notReadMessages > 99 ? "99+" : notReadMessages}
                    </DmText>
                  </DmView>
                )}
              </DmView>
              {/* Last message preview with media indicators */}
              <DmView className="mt-[4] flex-row items-center">
                {hasImages && (
                  <DmView className="flex-row items-center mr-[4]">
                    {imageFiles.slice(0, 4).map((f) => (
                      <DmView
                        key={f.id}
                        className="w-[20] h-[20] rounded-[3] overflow-hidden mr-[2]"
                      >
                        <FastImage
                          source={{ uri: f.url150 || f.url720 || f.url }}
                          style={styles.thumbnail}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      </DmView>
                    ))}
                  </DmView>
                )}
                {!lastMsg?.text && hasLocation && (
                  <DmView className="mr-[3]">
                    <LocationIcon width={10} height={13} fill="#000" />
                  </DmView>
                )}
                {!lastMsg?.text && hasDocs && !hasImages && (
                  <DmView className="mr-[3]">
                    <DocumentIcon width={10} height={13} fill="#000" />
                  </DmView>
                )}
                <DmText
                  className="text-11 font-custom400 text-grey3 flex-1"
                  numberOfLines={1}
                >
                  {lastMsg?.text
                    ? (() => {
                        const displayText = lastMsg.ownerType === "system" ? t(lastMsg.text) : lastMsg.text
                        return displayText.length > 40
                          ? displayText.substring(0, 40) + "..."
                          : displayText
                      })()
                    : hasDocs
                    ? docFiles[0].originalName || docFiles[0].fileName
                    : hasLocation
                    ? t("location")
                    : hasImages
                    ? imageFiles.length === 1
                      ? t("photo")
                      : `${imageFiles.length} ${t("photos")}`
                    : ""}{!lastMsg && (
                    <DmText
                      className="text-11 font-custom400 text-grey3"
                      style={styles.italic}
                    >
                      {t("waiting_for_pro_response")}
                    </DmText>
                  )}
                </DmText>
              </DmView>
            </DmView>
          </DmView>
        </DmView>
        <DmView className="mr-[15] border-b-1 border-grey4" />
      </DmView>
    )

    if (!onArchive) {
      return content
    }

    const isRTL = I18nManager.isRTL

    return (
      <Animated.View
        style={{
          transform: [{ translateX: translateAnim }],
          maxHeight: heightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 200],
          }),
          overflow: "hidden",
        }}
      >
        <Swipeable
          ref={swipeableRef}
          renderRightActions={!isRTL ? renderArchiveAction : undefined}
          renderLeftActions={isRTL ? renderArchiveAction : undefined}
          overshootRight={false}
          overshootLeft={false}
        >
          {content}
        </Swipeable>
      </Animated.View>
    )
  },
)

export default MessagesComponent
