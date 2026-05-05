import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { format } from "date-fns"

import { ChatMessageType } from "types/chat"
import styles from "./styles"

interface Props {
  item: ChatMessageType
  isFirstInGroup: boolean
  isLastInGroup: boolean
  showTimestamp?: boolean
  showReadReceipt?: boolean
  readByName?: string
}

const MessageComponent: React.FC<Props> = React.memo(
  ({ item, isFirstInGroup, isLastInGroup, showTimestamp = true, showReadReceipt = false, readByName = "" }) => {
    const { t, i18n } = useTranslation()
    const isAr = i18n.language === "ar"

    const isMyMessage = item.ownerType === "customer"
    const isSystem = item.ownerType === "system"

    const time = format(new Date(item.createdAt), "h:mm a")

    // System messages — right-aligned, timestamp above
    if (isSystem) {
      return (
        <DmView style={{ paddingBottom: isLastInGroup ? 12 : 2 }}>
          {showTimestamp && (
            <DmView className="pb-[4] pt-[4] items-end pr-[49]">
              <DmText className="text-10 leading-[13px] font-custom400 text-grey3">
                {time}
              </DmText>
            </DmView>
          )}
          <DmView className="flex pr-[49] items-end">
            <DmText className="text-11 leading-[14px] font-custom400 text-red">
              {t(item.text || "")}
            </DmText>
          </DmView>
        </DmView>
      )
    }

    // Regular messages
    const bubbleBg = isMyMessage ? "bg-[#3A3A3A]" : "bg-[#F5F5F5]"
    const textColor = isMyMessage ? "text-white" : "text-black"

    const topLeftRadius = 12
    const topRightRadius = 12
    let bottomLeftRadius = 12
    let bottomRightRadius = 12

    if (isLastInGroup) {
      if (isMyMessage) {
        bottomRightRadius = 2
      } else {
        bottomLeftRadius = 2
      }
    }

    return (
      <DmView style={{ paddingBottom: isLastInGroup ? 12 : 2 }}>
        {/* Timestamp — above bubble */}
        {showTimestamp && (
          <DmView
            className={`pb-[4] pt-[4] ${isMyMessage ? "items-end pr-[49]" : "items-start pl-[53]"}`}
          >
            <DmText className="text-10 leading-[13px] font-custom400 text-grey3">
              {time}
            </DmText>
          </DmView>
        )}

        {/* Message bubble */}
        <DmView
          className={isMyMessage ? "items-end pr-[49] ml-[80]" : "items-start pl-[53] pr-[80]"}
        >
          <DmView
            className={`${bubbleBg} py-[8] px-[14]`}
            style={[
              styles.bubbleMaxWidth,
              {
                borderTopLeftRadius: topLeftRadius,
                borderTopRightRadius: topRightRadius,
                borderBottomLeftRadius: bottomLeftRadius,
                borderBottomRightRadius: bottomRightRadius,
              },
            ]}
          >
            <DmText
              className={`font-custom400 ${textColor}`}
              style={[styles.messageText, { textAlign: isAr ? "right" : "left" }]}
            >
              {item.text}
            </DmText>
          </DmView>
        </DmView>

        {/* Read by — below bubble */}
        {showReadReceipt && (
          <DmView className="items-end pr-[49] pt-[3]">
            <DmText className="text-9 leading-[12px] font-custom400 text-black">
              {t("read_by")} {readByName}
            </DmText>
          </DmView>
        )}
      </DmView>
    )
  },
)

export default MessageComponent
