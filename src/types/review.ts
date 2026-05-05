export type CreateReviewRequest = {
  jobId: number
  proId: number
  qualityScore: number
  completionInTimeScore: number
  jobAwarenessScore: number
  honestyScore: number
  responseTimeScore: number
  comment: string
  proCompletedJob: boolean
}

export type ReviewType = {
  id: number
  jobId: number
  proId: number
  customerId: number
  qualityScore: number
  completionInTimeScore: number
  jobAwarenessScore: number
  honestyScore: number
  responseTimeScore: number
  overallScore: number
  comment: string
  proCompletedJob: boolean
  status: "pending" | "approved" | "rejected"
  reviewDate: string
  rejectReason?: string
}
