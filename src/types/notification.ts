// Stored in-app notifications (backend `notifications` table, shared with proapp).
// `event` is the system notification key, e.g. "system.job:customer.job.offer.selected" —
// customer-facing keys all live under system.job:/system.account:/system.messages:.
export type NotificationsItemType = {
  id: number
  event: string
  userType: "customer" | "pro" | "employee"
  userId: number
  title: string
  body: string
  readAt?: string | null
  createdAt: string
  updatedAt?: string
  // Event payload persisted alongside the notification. Job events carry
  // jobId (and often a slim job DTO) — used for "View request" deep links.
  data?: {
    jobId?: number
    job?: { id?: number }
    [key: string]: unknown
  }
}

export type ListNotificationsResponse = {
  data: NotificationsItemType[]
  page: number
  perPage: number
  total: number
}

export type ListNotificationsRequest = {
  page: number
  perPage?: number
  sort?: "ASC" | "DESC"
  // Chat unread lives on the Messages tab badge — the bell must exclude
  // system.messages rows (nothing ever marks them read; same rule as proapp).
  excludeEventPrefix?: string
}
