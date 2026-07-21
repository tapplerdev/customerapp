import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useLazyGetCustomerJobDetailsQuery } from "services/api"
import { RootStackParamList } from "navigation/types"
import { JobType, QuestionAnswerType } from "types/job"

/**
 * The details payload's questionsAnswers rows are RICH (nested question /
 * option objects); the request flow consumes the flat create shape
 * (questionId + optionId/optionsIds/answer). Normalize before seeding —
 * passing the rich rows straight through would seed garbage.
 */
const toFlatAnswers = (qaRows: any[] | undefined): QuestionAnswerType[] =>
  (qaRows ?? [])
    .map((qa: any) => ({
      questionId: qa.questionId ?? qa.question?.id,
      answer: qa.answer || undefined,
      optionId: qa.optionId ?? undefined,
      optionsIds: qa.options?.length
        ? qa.options.map((o: any) => o?.id).filter((id: any) => id != null)
        : undefined,
      date: qa.date || undefined,
      startTime: qa.startTime || undefined,
      endTime: qa.endTime || undefined,
    }))
    .filter((qa: any) => qa.questionId != null)

/**
 * Shared engine for "Repost request" (ended jobs) and "Find other pros"
 * (all invited pros declined): re-enters the request flow at the pros
 * listing, prefilled from the job's stored snapshot — category, address
 * (snapshot, never the saved-addresses list), place of service, answers.
 * Always produces a BRAND-NEW job through the normal flow; nothing is
 * cloned server-side.
 */
const useRepostRequest = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [fetchJobDetails] = useLazyGetCustomerJobDetailsQuery()

  /** Accepts a jobId (fetches details, cache-first) or an already-loaded
   *  details payload. Resolves true when navigation happened. */
  const repostFromJob = useCallback(
    async (jobOrId: number | JobType): Promise<boolean> => {
      try {
        const job: JobType =
          typeof jobOrId === "number"
            ? await fetchJobDetails(jobOrId, true).unwrap()
            : jobOrId

        const category = job.serviceCategory
        const addr = job.address?.address
        const loc: any = addr?.location
        const lat = loc?.lat ?? loc?.latitude ?? job.address?.location?.lat
        const lng = loc?.lng ?? loc?.longitude ?? job.address?.location?.lng
        if (!category || lat == null || lng == null) return false

        // Through the search animation (lottie) like a brand-new request; the
        // listing then re-presents the first-arrival question flow pre-filled
        // (forceQuestionFlow), so a repost FEELS like starting fresh.
        navigation.navigate("SearchAnimationScreen", {
          nextParams: {
            categoryId: category.id,
            categoryName: isAr ? category.nameAr : category.nameEn,
            serviceId: category.serviceId ?? 0,
            address: {
              address: addr?.streetAddress || "",
              city: addr?.city || "",
              governorate: addr?.governorate || "",
              coords: { lat, lon: lng },
            },
            placeOfService: job.placeOfService,
            initialAnswers: toFlatAnswers(job.questionsAnswers as any[]),
            forceQuestionFlow: true,
          },
        })
        return true
      } catch (e) {
        console.log("Repost prefill failed:", e)
        return false
      }
    },
    [fetchJobDetails, navigation, isAr]
  )

  return repostFromJob
}

export default useRepostRequest
