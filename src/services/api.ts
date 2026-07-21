import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { API_URL } from "config"
import { chatReadRegistry } from "services/chatReadRegistry"
import { RootState } from "store"
import { setTokens, logout } from "store/auth/slice"
import { PresetType, ServiceType, ServicesResponse } from "types/cms"
import {
  CustomerSignUpRequest,
  CustomerSignUpResponse,
  AuthRequest,
  AuthResponse,
  CustomerMeResponse,
  UpdateCustomerRequest,
  CreateCustomerAddressRequest,
  CustomerSavedAddress,
} from "types/auth"
import { ListProsResponse, ProType } from "types/pro"
import { ChatType, ChatMessageType, ListChatsResponse, ListMessagesResponse } from "types/chat"
import { CreateJobRequest, JobProType, JobType, ListJobsResponse } from "types/job"
import { CreateReviewRequest, ReviewType } from "types/review"
import {
  ListNotificationsRequest,
  ListNotificationsResponse,
  NotificationsItemType,
} from "types/notification"

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  // Bound every request: a hung server (e.g. jammed DB pooler accepting
  // connections it never answers) otherwise wedges RTK forever — in-flight
  // entries never resolve, polling loops stall until app restart.
  timeout: 20000,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState
    const { token } = state.auth
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    return headers
  },
})

// Prevent multiple simultaneous refresh attempts
let isRefreshing = false
let refreshPromise: Promise<any> | null = null

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiBase, extraOptions) => {
  const url = typeof args === "string" ? args : args.url
  console.log(`[API] ${typeof args === "string" ? "GET" : (args as FetchArgs).method || "GET"} ${API_URL}${url}`)

  const result = await baseQuery(args, apiBase, extraOptions)

  if (result?.error) {
    console.log(`[API] ❌ Error:`, result.error.status, JSON.stringify(result.error.data || result.error).substring(0, 200))
  } else {
    const dataPreview = JSON.stringify(result.data).substring(0, 100)
    console.log(`[API] ✅ Success: ${dataPreview}...`)
  }

  if (result?.error?.status !== 401) {
    return result
  }

  console.log(`[API] 🔒 Got 401 for ${url}`)

  const state = apiBase.getState() as RootState
  const { refreshToken, isAuth, token } = state.auth

  console.log(`[API] 🔒 Auth state: isAuth=${isAuth}, hasToken=${!!token}, hasRefreshToken=${!!refreshToken}`)

  if (!refreshToken || !isAuth) {
    console.log(`[API] 🔒 No refresh token or not auth — returning 401 silently`)
    return result
  }

  console.log(`[API] 🔒 Attempting token refresh...`)

  try {
    // If another request is already refreshing, wait for it
    if (isRefreshing && refreshPromise) {
      await refreshPromise
      return await baseQuery(args, apiBase, extraOptions)
    }

    isRefreshing = true
    refreshPromise = baseQuery(
      { url: `/auth/refresh/${refreshToken}`, method: "GET" },
      apiBase,
      extraOptions,
    )

    const refreshResult = await refreshPromise

    if (refreshResult.data) {
      const data = refreshResult.data as { token: string; refreshToken: string }
      console.log(`[API] 🔒 Token refresh SUCCESS — retrying original request`)
      apiBase.dispatch(setTokens({ token: data.token, refreshToken: data.refreshToken }))

      isRefreshing = false
      refreshPromise = null

      // Retry original request with new token
      return await baseQuery(args, apiBase, extraOptions)
    } else {
      console.log(`[API] 🔒 Token refresh FAILED:`, JSON.stringify(refreshResult.error?.data || refreshResult.error).substring(0, 200))
      isRefreshing = false
      refreshPromise = null
      // Only a definitive rejection from a live server means the session is
      // truly invalid. 401/403 = token rejected; 404 = the refresh token no
      // longer exists server-side (expired, or evicted by a login elsewhere —
      // the server answered "not found", so retrying can only 404 again → a
      // permanent zombie session if we kept it). Network errors / timeouts /
      // 5xx = backend unreachable (e.g. local restart): keep and retry later.
      const refreshStatus = refreshResult.error?.status
      if (
        refreshStatus === 401 ||
        refreshStatus === 403 ||
        refreshStatus === 404
      ) {
        console.log(`[API] 🔒 Refresh token invalid (${String(refreshStatus)}) — logging out`)
        apiBase.dispatch(logout())
        apiBase.dispatch(api.util.resetApiState())
      } else {
        console.log(`[API] 🔒 Refresh unreachable (${String(refreshStatus)}) — keeping session`)
      }
      return result
    }
  } catch (e: any) {
    // Exceptions here are code/network failures, never an auth verdict —
    // keep the session.
    console.log(`[API] 🔒 Token refresh EXCEPTION (keeping session):`, e?.message || e)
    isRefreshing = false
    refreshPromise = null
    return result
  }
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Auth", "Preset", "Jobs", "Chats", "Notifications"],
  endpoints: (builder) => ({
    getActivePreset: builder.query<PresetType, void>({
      query: () => "/cms/presets/active",
      providesTags: ["Preset"],
    }),

    getServices: builder.query<ServicesResponse, void | string>({
      // Optional search: server full-text matches service names + category
      // names/keywords (same contract the pro app uses)
      query: (search) =>
        "/services?page=1&perPage=100&sort=ASC" +
        (typeof search === "string" && search ? `&search=${encodeURIComponent(search)}` : ""),
    }),

    getServiceById: builder.query<ServiceType, number>({
      query: (id) => `/services/${id}`,
    }),

    customerSignUp: builder.mutation<CustomerSignUpResponse, CustomerSignUpRequest>({
      query: (body) => ({ url: "/customers", method: "POST", body }),
    }),

    auth: builder.mutation<AuthResponse, AuthRequest>({
      query: (body) => ({ url: "/auth", method: "POST", body }),
    }),

    getCustomerMe: builder.query<CustomerMeResponse, void>({
      query: () => "/customers/me",
      providesTags: ["Auth"],
    }),

    updateCustomer: builder.mutation<CustomerMeResponse, UpdateCustomerRequest>({
      query: (body) => ({ url: "/customers", method: "PATCH", body }),
      invalidatesTags: ["Auth"],
    }),

    getProsForCategory: builder.query<
      ListProsResponse,
      {
        categoryId: number
        placeOfService?: string
        customerAddress?: { latitude: number; longitude: number }
        filterOptionsIds?: number[]
        filterRanges?: { filterId: number; min?: number; max?: number }[]
        proType?: string
        distanceKm?: number
        minRating?: number
        maxResponseTimeHours?: number
        creditCardPayment?: boolean
      }
    >({
      query: ({ categoryId, placeOfService, customerAddress, filterOptionsIds, filterRanges, proType, distanceKm, minRating, maxResponseTimeHours, creditCardPayment }) => {
        const params = new URLSearchParams()
        if (placeOfService) {
          params.append("placeOfService", placeOfService)
        }
        params.append("distanceKmFromCustomer", String(distanceKm ?? 50))
        if (customerAddress) {
          params.append("customerAddress[latitude]", String(customerAddress.latitude))
          params.append("customerAddress[longitude]", String(customerAddress.longitude))
        }
        if (filterOptionsIds?.length) {
          filterOptionsIds.forEach((id) => params.append("filterOptionsIds[]", String(id)))
        }
        if (filterRanges?.length) {
          filterRanges.forEach(({ filterId, min, max }) =>
            params.append("filterRanges[]", `${filterId}:${min ?? ""}:${max ?? ""}`)
          )
        }
        if (proType) params.append("proType", proType)
        if (minRating) params.append("minRating", String(minRating))
        if (maxResponseTimeHours) params.append("maxResponseTimeHours", String(maxResponseTimeHours))
        if (creditCardPayment) params.append("creditCardPayment", "true")
        return `/pros/category/${categoryId}?${params.toString()}`
      },
    }),

    createCustomerAddress: builder.mutation<CustomerSavedAddress, CreateCustomerAddressRequest>({
      query: (body) => ({ url: "/customers/addresses", method: "POST", body }),
      invalidatesTags: ["Auth"],
    }),

    deleteCustomerAddress: builder.mutation<void, number>({
      query: (id) => ({ url: `/customers/addresses/${id}`, method: "DELETE" }),
      invalidatesTags: ["Auth"],
    }),

    createJob: builder.mutation<JobType, CreateJobRequest>({
      query: (body) => ({ url: "/jobs", method: "POST", body }),
      invalidatesTags: ["Jobs"],
    }),

    getCustomerJobs: builder.query<ListJobsResponse, { page?: number; perPage?: number } | void>({
      query: (params) => {
        const p = params || {}
        const qp = new URLSearchParams()
        if (p.page) qp.append("page", p.page.toString())
        if (p.perPage) qp.append("perPage", p.perPage.toString())
        const qs = qp.toString()
        return `/jobs/customer-jobs${qs ? `?${qs}` : ""}`
      },
      providesTags: ["Jobs"],
    }),

    getCustomerJobDetails: builder.query<JobType, number>({
      query: (id) => `/jobs/customer-jobs/${id}/details`,
      providesTags: ["Jobs"],
    }),

    getCustomerJobById: builder.query<JobType, number>({
      query: (id) => `/jobs/customer-jobs/${id}`,
      providesTags: ["Jobs"],
    }),

    getProProfile: builder.query<ProType, { proId: number; serviceCategoryId?: number }>({
      query: ({ proId, serviceCategoryId }) => {
        const url = `/pros/${proId}`
        return serviceCategoryId ? `${url}?serviceCategoryId=${serviceCategoryId}` : url
      },
    }),

    createReview: builder.mutation<ReviewType, CreateReviewRequest>({
      query: (body) => ({ url: "/reviews", method: "POST", body }),
      invalidatesTags: ["Jobs"],
    }),

    cancelJob: builder.mutation<JobType, { jobId: number; reasons: string[] }>({
      query: ({ jobId, reasons }) => ({
        url: `/jobs/${jobId}/cancel`,
        method: "PATCH",
        body: { reasons },
      }),
      invalidatesTags: ["Jobs"],
    }),

    respondToOpportunity: builder.mutation<JobProType, { jobId: number; proId: number; selectionStatus: "offer" | "customerRejected" }>({
      query: ({ jobId, proId, selectionStatus }) => ({
        url: `/jobs/${jobId}/pros/${proId}`,
        method: "PATCH",
        body: { selectionStatus },
      }),
      // Chats too: visibility reads the pro's selectionStatus out of the chat
      // payload, so Select must surface the thread in Messages immediately.
      invalidatesTags: ["Jobs", "Chats"],
    }),

    // Negotiation trail for the chat header's offer strip → history sheet.
    // Backend gates customers to their own job.
    getOfferHistory: builder.query<
      { data: Array<{ id: number; ratePerHour: number; createdAt: string }> },
      { jobId: number; proId: number }
    >({
      query: ({ jobId, proId }) =>
        `/jobs/${jobId}/pros/${proId}/offer-history`,
    }),

    // Stored in-app notifications (same backend table + endpoints as proapp;
    // the API filters to the authed customer). The HomeHeader bell subscribes
    // with { page: 1, perPage: 100 } and the NotificationsScreen pages by 20 —
    // two cache entries, both refreshed by the "Notifications" tag.
    getNotifications: builder.query<
      ListNotificationsResponse,
      ListNotificationsRequest
    >({
      query: (body) => {
        const params = new URLSearchParams()
        params.append("page", String(body.page))
        params.append("perPage", String(body.perPage || 20))
        params.append("sort", body.sort || "DESC")
        if (body.excludeEventPrefix) {
          params.append("excludeEventPrefix", body.excludeEventPrefix)
        }
        return `/notifications?${params}`
      },
      providesTags: ["Notifications"],
    }),

    markNotificationAsRead: builder.mutation<NotificationsItemType, number>({
      query: (id) => ({
        url: `/notifications/${id}/mark-as-read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),

    markAllNotificationsAsRead: builder.mutation<NotificationsItemType[], void>({
      query: () => ({
        url: "/notifications/mark-all-as-read",
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),

    openChat: builder.query<ChatType, { categoryId: number; recipientId: number; jobId?: number }>({
      query: ({ categoryId, recipientId, jobId }) => {
        const url = `/chats/open/service-categories/${categoryId}/recipient/${recipientId}`
        return jobId ? `${url}?jobId=${jobId}` : url
      },
      providesTags: ["Chats"],
    }),

    getChats: builder.query<ListChatsResponse, void>({
      query: () => "/chats",
      // In-flight-read wins: a refetch that started BEFORE the customer read
      // a chat can land AFTER the local zero carrying pre-read server counts —
      // without this guard it would resurrect the unread state. (Mirrors the
      // proapp pattern.)
      transformResponse: (response: ListChatsResponse) => {
        response?.data?.forEach((preview) => {
          if (preview.notReadMessages > 0 && chatReadRegistry.has(preview.chat.id)) {
            preview.notReadMessages = 0
          }
        })
        return response
      },
      providesTags: ["Chats"],
    }),

    getChatMessages: builder.query<ListMessagesResponse, { chatId: number; page?: number; perPage?: number }>({
      query: ({ chatId, page = 1, perPage = 20 }) =>
        `/chats/${chatId}/messages?page=${page}&perPage=${perPage}`,
    }),

    sendMessage: builder.mutation<ChatMessageType, { chatId: number; text?: string; files?: string[]; location?: { latitude: number; longitude: number } }>({
      query: ({ chatId, ...body }) => ({
        url: `/chats/${chatId}/messages`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Chats"],
    }),

    uploadFile: builder.mutation<{ storageKey: string }, { path: string; mime?: string; filename?: string }>({
      query: (file) => {
        const formData = new FormData()
        formData.append("file", {
          type: file.mime || "image/jpeg",
          uri: file.path,
          name: file.filename || file.path.split("/").pop() || "upload.jpg",
        } as any)
        return {
          url: "/files",
          method: "POST",
          body: formData,
        }
      },
    }),

    // NO success invalidation on purpose: the optimistic zero below is the
    // truth (the server converges via the PATCH), and the success refetch is
    // exactly why the list/unread lagged a round trip behind reading a chat.
    // Invalidate only when the PATCH FAILS. (Mirrors the proapp.)
    markAllAsRead: builder.mutation<ChatMessageType[], number>({
      query: (chatId) => ({
        url: `/chats/${chatId}/messages/mark-all-as-read`,
        method: "PATCH",
      }),
      async onQueryStarted(chatId, { dispatch, queryFulfilled }) {
        chatReadRegistry.add(chatId)
        const zero = () =>
          dispatch(
            api.util.updateQueryData("getChats", undefined, (draft) => {
              const preview = draft?.data?.find((c) => c.chat.id === chatId)
              if (preview) preview.notReadMessages = 0
            })
          )
        zero()
        try {
          await queryFulfilled
          chatReadRegistry.commit(chatId)
          zero() // repair anything a mid-flight refetch resurrected
        } catch {
          chatReadRegistry.remove(chatId)
          dispatch(api.util.invalidateTags(["Chats"]))
        }
      },
    }),

    archiveChat: builder.mutation<ChatType, number>({
      query: (chatId) => ({
        url: `/chats/${chatId}/archive`,
        method: "PATCH",
      }),
      invalidatesTags: ["Chats"],
    }),
  }),
})

export const {
  useGetActivePresetQuery,
  useLazyGetActivePresetQuery,
  useGetServicesQuery,
  useCustomerSignUpMutation,
  useAuthMutation,
  useGetCustomerMeQuery,
  useLazyGetCustomerMeQuery,
  useUpdateCustomerMutation,
  useLazyGetProsForCategoryQuery,
  useCreateCustomerAddressMutation,
  useDeleteCustomerAddressMutation,
  useCreateJobMutation,
  useGetCustomerJobsQuery,
  useGetServiceByIdQuery,
  useLazyGetServiceByIdQuery,
  useGetCustomerJobByIdQuery,
  useGetCustomerJobDetailsQuery,
  useLazyGetCustomerJobDetailsQuery,
  useLazyGetCustomerJobByIdQuery,
  useLazyOpenChatQuery,
  useGetChatsQuery,
  useGetChatMessagesQuery,
  useLazyGetChatMessagesQuery,
  useSendMessageMutation,
  useUploadFileMutation,
  useMarkAllAsReadMutation,
  useArchiveChatMutation,
  useGetProProfileQuery,
  useLazyGetProProfileQuery,
  useCancelJobMutation,
  useRespondToOpportunityMutation,
  useGetOfferHistoryQuery,
  useCreateReviewMutation,
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} = api
