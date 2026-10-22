import React, { useCallback, useMemo, useRef } from "react"
import { Animated, Dimensions, I18nManager } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { Swipeable } from "react-native-gesture-handler"
import FastImage from "react-native-fast-image"
import { format, isToday, isYesterday } from "date-fns"

import { ChatPreviewType } from "types/chat"

import LocationIcon from "assets/icons/location-red.svg"
import DocumentIcon from "assets/icons/my-documents.svg"
import { parseOfferUpdate } from "components/OfferUpdateCard/OfferUpdateCard"
import { localizeDateString } from "helpers/digits"

import styles from "./styles"
import { Text, a } from "@tappler/shared/src/ds"

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
          // Arabic gets Arabic-Indic digits + ص/م meridiem (١١:٢٧ م)
          return localizeDateString(format(date, "h:mm a"), isAr)
        }
        if (isYesterday(date)) {
          return t("yesterday")
        }
        return isAr
          ? localizeDateString(format(date, "yyyy/MM/dd"), true)
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
        style={[styles.container, a.justify_center, a.items_center, styles.archiveAction]}
      >
        <Text size={13} weight="semibold" leading="legacy" color="inverse">
          {t("archive")}
        </Text>
      </DmView>
    )

    const content = (
      <DmView onPress={onPress} style={styles.box}>
        <DmView style={[styles.boxWrap, a.pt_10]}>
          <DmView style={[a.flex_row, a.items_start]}>
            {/* Avatar */}
            {proPhoto ? (
              <DmView style={[styles.imageWrap, a.overflow_hidden, a.mr_10]}>
                <FastImage
                  source={{ uri: proPhoto }}
                  style={styles.avatar}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </DmView>
            ) : (
              <DmView style={[styles.textWrap, a.items_center, a.justify_center, a.mr_10]}>
                <Text size={16} weight="semibold" leading="legacy" color="inverse">
                  {proName.charAt(0)}
                </Text>
              </DmView>
            )}
            <DmView style={a.flex_1}>
              {/* Name + time */}
              <DmView style={[a.flex_row, a.items_center, a.justify_between]}>
                <Text
                  size={15}
                  weight="semibold"
                  leading="legacy"
                  style={a.flex_1}
                  numberOfLines={1}
                >
                  {proName}
                </Text>
                <Text size={11} leading="legacy" color="tertiary" style={styles.text}>
                  {formatTime(lastMessage?.createdAt || chat.createdAt)}
                </Text>
              </DmView>
              {/* Service name + unread badge */}
              <DmView style={[a.flex_row, a.items_center, a.justify_between, a.mt_2]}>
                <Text
                  size={13}
                  weight="medium"
                  leading="legacy"
                  style={a.flex_1}
                  numberOfLines={1}
                >
                  {serviceName}
                </Text>
                {notReadMessages > 0 && (
                  <DmView style={[styles.textWrap2, a.items_center, a.justify_center]}>
                    <Text size={13} weight="bold" leading="legacy" color="inverse">
                      {notReadMessages > 99 ? "99+" : notReadMessages}
                    </Text>
                  </DmView>
                )}
              </DmView>
              {/* Last message preview with media indicators */}
              <DmView style={[a.mt_4, a.flex_row, a.items_center]}>
                {hasImages && (
                  <DmView style={[a.flex_row, a.items_center, a.mr_4]}>
                    {imageFiles.slice(0, 4).map((f) => (
                      <DmView
                        key={f.id}
                        style={[styles.container2, a.overflow_hidden, a.mr_2]}
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
                  <DmView style={styles.iconWrap}>
                    <LocationIcon width={10} height={13} fill="#000" />
                  </DmView>
                )}
                {!lastMsg?.text && hasDocs && !hasImages && (
                  <DmView style={styles.iconWrap}>
                    <DocumentIcon width={10} height={13} fill="#000" />
                  </DmView>
                )}
                <Text
                  size={11}
                  leading="legacy"
                  color="tertiary"
                  style={a.flex_1}
                  numberOfLines={1}
                >
                  {lastMsg?.text
                    ? (() => {
                        // Structured offer revision ("offer_updated:50:60") must not
                        // hit t() raw (":" is i18next's ns separator → mangled "50.60");
                        // show the event + the new price instead.
                        const offerUpdate =
                          lastMsg.ownerType === "system" ? parseOfferUpdate(lastMsg.text) : null
                        const displayText = offerUpdate
                          ? `${t("offer_updated")} · ${offerUpdate.next} ${t("EGP")}`
                          : lastMsg.ownerType === "system" ? t(lastMsg.text) : lastMsg.text
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
                    <Text
                      size={11}
                      leading="legacy"
                      color="tertiary"
                      style={styles.italic}
                    >
                      {t("waiting_for_pro_response")}
                    </Text>
                  )}
                </Text>
              </DmView>
            </DmView>
          </DmView>
        </DmView>
        <DmView style={[styles.box2, a.border_b_1]} />
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
