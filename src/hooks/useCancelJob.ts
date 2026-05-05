import { useCallback, useState } from "react"
import { useCancelJobMutation } from "services/api"

const CANCEL_REASONS = [
  "I did not receive enough offers",
  "Offers are expensive or not suitable",
  "I hired a local pro",
  "Other Reasons",
] as const

const useCancelJob = (params: {
  jobId: number
  onSuccess: () => void
  onError: () => void
}) => {
  const { jobId, onSuccess, onError } = params

  const [cancelJobMutation] = useCancelJobMutation()
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [otherReasonText, setOtherReasonText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleReason = useCallback((reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    )
  }, [])

  const hasOtherSelected = selectedReasons.includes("Other Reasons")
  const canSubmit = selectedReasons.length > 0

  const handleSubmitCancel = useCallback(async () => {
    const reasons = selectedReasons.map((r) =>
      r === "Other Reasons" && otherReasonText ? otherReasonText : r
    )
    if (reasons.length === 0) return

    setIsSubmitting(true)
    try {
      await cancelJobMutation({ jobId, reasons }).unwrap()
      onSuccess()
    } catch {
      onError()
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedReasons, otherReasonText, jobId, cancelJobMutation, onSuccess, onError])

  const reset = useCallback(() => {
    setSelectedReasons([])
    setOtherReasonText("")
  }, [])

  return {
    cancelReasons: CANCEL_REASONS,
    selectedReasons,
    toggleReason,
    otherReasonText,
    setOtherReasonText,
    handleSubmitCancel,
    isSubmitting,
    hasOtherSelected,
    canSubmit,
    reset,
  }
}

export default useCancelJob
