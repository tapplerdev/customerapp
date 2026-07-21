import React from "react"
import moment from "moment"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { localizeDateString } from "helpers/digits"
import { NotificationsItemType } from "types/notification"

interface Props {
  item: NotificationsItemType
  onPress: (item: NotificationsItemType) => void
}

// Mirrors proapp's NotificationsComponent: date / title / body rows,
// bold while unread, regular once read.
const NotificationItem: React.FC<Props> = ({ item, onPress }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const isUnread = !item.readAt

  const formatDate = (date: string) => {
    const m = moment(date)
    const formatted = m.isSame(moment(), "day")
      ? `${t("today")} ${m.format("h:mm A")}`
      : m.format("DD/MM/YYYY")
    return localizeDateString(formatted, isAr)
  }

  return (
    <DmView onPress={() => onPress(item)}>
      <DmView className="px-[16] py-[18]">
        <DmText
          className={clsx(
            "text-12 leading-[15px]",
            isUnread ? "font-custom700" : "font-custom400"
          )}
        >
          {formatDate(item.createdAt)}
        </DmText>
        <DmText
          className={clsx(
            "mt-[5] text-13 leading-[16px]",
            isUnread ? "font-custom700" : "font-custom400"
          )}
          numberOfLines={1}
        >
          {item.title}
        </DmText>
        <DmText
          className={clsx(
            "mt-[5] text-12 leading-[15px]",
            isUnread ? "font-custom700" : "font-custom400"
          )}
          numberOfLines={1}
        >
          {item.body}
        </DmText>
      </DmView>
      <DmView className="h-[0.5] bg-grey19" />
    </DmView>
  )
}

export default React.memo(NotificationItem)
