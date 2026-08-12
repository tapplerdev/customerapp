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

  // A completed FOOD order is not a closed conversation.
  //
  // isJobInactive greys out every attachment — camera, gallery, files,
  // location — and a delivered order used to leave job.status on `active`, so
  // this never fired for food. Now that delivery settles the job to
  // `completed`, the moment the customer most needs to send a photo (wrong
  // item, missing item, damaged food) is the exact moment the camera would
  // have gone dim. Text still worked, which is worse than useless when the
  // point is to show somebody what arrived.
  //
  // Service requests are deliberately untouched: those complete when the work
  // and the review are done, and locking attachments there is the existing,
  // intended behaviour.
  const isFoodJob = !!chat.job?.serviceCategory?.hasMenu
  const isJobInactive =
    !!jobStatus &&
    jobStatus !== "active" &&
    !(isFoodJob && jobStatus === "completed")
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
