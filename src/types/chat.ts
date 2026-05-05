import { JobType } from "./job"

export type ChatFileType = {
  id: number
  fileName: string
  extension: string
  originalName: string
  mimeType: string
  storageKey: string
  url: string
  url1920?: string
  url720?: string
  url150?: string
}

export type ChatLocationType = {
  id: number
  longitude: number
  latitude: number
}

export type ChatMessageType = {
  id: number
  text?: string
  ownerType: "customer" | "pro" | "system"
  createdAt: string
  updatedAt?: string
  readAt?: string | null
  chatId?: number
  proId?: number
  customerId?: number
  files?: ChatFileType[]
  location?: ChatLocationType
}

export type ChatProType = {
  id: number
  registeredName: string
  businessName?: string
  screenName?: string
  proType?: "individual" | "company"
  profilePhoto?: string
  profilePhoto150?: string
  profilePhoto720?: string
  lastSeen?: string
  accountStatus?: string
}

export type ChatCustomerType = {
  id: number
  firstName?: string
  lastName?: string
}

export type ChatServiceCategoryType = {
  id: number
  nameEn: string
  nameAr: string
}

export type ChatType = {
  id: number
  status: "active" | "archived"
  proId: number
  customerId: number
  pro: ChatProType
  customer?: ChatCustomerType
  serviceCategoryId?: number
  serviceCategory?: ChatServiceCategoryType
  jobId?: number
  job?: JobType
  archivedAt?: string
  createdAt?: string
}

export type ChatPreviewType = {
  chat: ChatType
  notReadMessages: number
  lastMessage?: ChatMessageType
}

export type ListChatsResponse = {
  data: ChatPreviewType[]
}

export type ListMessagesResponse = {
  data: ChatMessageType[]
  page: number
  perPage: number
  total: number
}
