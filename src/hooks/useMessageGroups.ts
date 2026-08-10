import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { format, isToday } from "date-fns"
import { ChatMessageType } from "types/chat"

export type MessageItem = {
  type: "message"
  message: ChatMessageType
  isFirstInGroup: boolean
  isLastInGroup: boolean
  showReadReceipt: boolean
  id: string
}

export type DateItem = {
  type: "date"
  label: string
  id: string
}

export type FlatItem = MessageItem | DateItem

type MessageGroup = {
  date: string
  label: string
  messages: ChatMessageType[]
}

const useMessageGroups = (messages: ChatMessageType[]) => {
  const { t } = useTranslation()

  const flatData = useMemo(() => {
    // Step 1: Group by date
    const groups: MessageGroup[] = []
    // "Pro sent you an offer" is dropped: the offer pill in the header already
    // shows the amount, and the pro's own message announcing it sits directly
    // above — so it restated the least surprising thing in the thread in the
    // loudest colour available, which is what stops a REVISION standing out.
    // The pro app drops its own copy of this row for the same reason.
    //
    // Filtered here rather than rendered as null, because grouping runs off
    // this array: a hidden row still holding an index gives its day a date
    // header with nothing under it, and splits the messages either side of it
    // into separate groups with the timestamp printed twice.
    const sortedMessages = [...messages]
      .filter(
        (m) =>
          !(m.ownerType === "system" && m.text === "offer_sent_to_customer"),
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )

    sortedMessages.forEach((msg) => {
      const msgDateObj = new Date(msg.createdAt)
      const msgDate = format(msgDateObj, "yyyy-MM-dd")
      const existing = groups.find((g) => g.date === msgDate)

      let label: string
      if (isToday(msgDateObj)) {
        label = t("today")
      } else {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        if (format(msgDateObj, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
          label = t("yesterday")
        } else {
          label = format(msgDateObj, "MMMM d, yyyy")
        }
      }

      if (existing) {
        existing.messages.push(msg)
      } else {
        groups.push({ date: msgDate, label, messages: [msg] })
      }
    })

    // Step 2: Flatten for inverted FlatList
    const items: FlatItem[] = []
    const reversedGroups = [...groups].reverse()

    reversedGroups.forEach((group) => {
      const reversedMessages = [...group.messages].reverse()

      reversedMessages.forEach((msg, idx) => {
        const originalIdx = reversedMessages.length - 1 - idx
        const nextMsg =
          originalIdx < group.messages.length - 1
            ? group.messages[originalIdx + 1]
            : undefined
        const prevMsg =
          originalIdx > 0
            ? group.messages[originalIdx - 1]
            : undefined

        const isFirstInGroup =
          !prevMsg || prevMsg.ownerType !== msg.ownerType
        const isLastInGroup =
          !nextMsg || nextMsg.ownerType !== msg.ownerType

        const showReadReceipt =
          msg.ownerType === "customer" &&
          !!msg.readAt &&
          (!nextMsg ||
            nextMsg.ownerType !== "customer" ||
            !nextMsg.readAt)

        items.push({
          type: "message" as const,
          message: msg,
          isFirstInGroup,
          isLastInGroup,
          showReadReceipt,
          id: `msg-${msg.id}`,
        })
      })

      items.push({
        type: "date" as const,
        label: group.label,
        id: `date-${group.date}`,
      })
    })

    return items
  }, [messages, t])

  return { flatData }
}

export default useMessageGroups
