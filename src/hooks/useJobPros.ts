import { useMemo } from "react"
import { JobProType } from "types/job"

const useJobPros = (pros: JobProType[] | undefined) => {
  const selectedPros = useMemo(() =>
    pros?.filter((p) =>
      p.selectionStatus === "selected" ||
      (p.selectionStatus === "offer" && !!p.proOfferSentAt && !p.proOpportunityOfferSentAt) ||
      (p.selectionStatus === "offer" && !!p.opportunityAcceptedAt)
    ) || [],
  [pros])

  const otherPros = useMemo(() =>
    pros?.filter((p) =>
      p.selectionStatus === "opportunity" ||
      (p.selectionStatus === "offer" && !!p.proOpportunityOfferSentAt && !p.opportunityAcceptedAt) ||
      p.selectionStatus === "customerRejected"
    ) || [],
  [pros])

  const offersCount = useMemo(() =>
    otherPros.filter((p) =>
      p.selectionStatus === "opportunity" ||
      (p.selectionStatus === "offer" && !!p.proOpportunityOfferSentAt)
    ).length,
  [otherPros])

  return { selectedPros, otherPros, offersCount }
}

export default useJobPros
