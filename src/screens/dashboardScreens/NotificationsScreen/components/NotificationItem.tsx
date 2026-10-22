import React from "react"
import moment from "moment"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { localizeDateString } from "helpers/digits"
import { NotificationsItemType } from "types/notification"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
      <DmView style={[a.px_16, a.py_18]}>
        <Text
          size={12}
          weight={isUnread ? "bold" : "regular"}
          leading="tight"
        >
          {formatDate(item.createdAt)}
        </Text>
        <Text
          size={13}
          weight={isUnread ? "bold" : "regular"}
          leading="tight"
          style={styles.text}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          size={12}
          weight={isUnread ? "bold" : "regular"}
          leading="tight"
          style={styles.text}
          numberOfLines={1}
        >
          {item.body}
        </Text>
      </DmView>
      <DmView style={styles.box} />
    </DmView>
  )
}

export default React.memo(NotificationItem)
