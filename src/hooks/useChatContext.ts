import { useTranslation } from "react-i18next"
import { differenceInMinutes, differenceInHours, differenceInDays, format } from "date-fns"
import { ChatPreviewType } from "types/chat"

const useChatContext = (chatPreview: ChatPreviewType) => {
  const { t } = useTranslation()
  const chat = chatPreview.chat
  const pro = chat.pro

  const proName = pro?.businessName || pro?.registeredName || ""

  const lastSeenText = (() => {
    if (!pro?.lastSeen) return ""
    const now = new Date()
    const seen = new Date(pro.lastSeen)
    const diffMins = differenceInMinutes(now, seen)
    const diffHrs = differenceInHours(now, seen)
    const diffDys = differenceInDays(now, seen)
    const diffWeeks = Math.floor(diffDys / 7)

    let timeAgo = ""
    if (diffMins < 1) {
      timeAgo = t("just_now")
    } else if (diffMins < 60) {
      timeAgo = `${diffMins} ${diffMins === 1 ? t("minute_ago") : t("minutes_ago")}`
    } else if (diffHrs < 24) {
      timeAgo = `${diffHrs} ${diffHrs === 1 ? t("hour_ago") : t("hours_ago")}`
    } else if (diffDys < 7) {
      timeAgo = `${diffDys} ${diffDys === 1 ? t("day_ago") : t("days_ago")}`
    } else if (diffWeeks <= 4) {
      timeAgo = `${diffWeeks} ${diffWeeks === 1 ? t("week_ago") : t("weeks_ago")}`
    } else {
      timeAgo = format(seen, "dd MMM yyyy")
    }
    return `${t("last_seen")} ${timeAgo}`
  })()

  const hasJob = !!chat.job
  const jobStatus = chat.job?.status
  const isJobInactive = !!jobStatus && jobStatus !== "active"
  const offerAmount = chat.job?.pros?.[0]?.ratePerHour

  return {
    proName,
    lastSeenText,
    isJobInactive,
    offerAmount,
    chatId: chat.id,
    pro,
    hasJob,
    serviceCategoryId: chat.serviceCategoryId,
    jobId: chat.job?.id,
  }
}

export default useChatContext
