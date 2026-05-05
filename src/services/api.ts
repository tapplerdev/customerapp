import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { API_URL } from "config"
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

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
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
  const result = await baseQuery(args, apiBase, extraOptions)

  if (result?.error?.status !== 401) {
    return result
  }

  const state = apiBase.getState() as RootState
  const { refreshToken, isAuth } = state.auth

  if (!refreshToken || !isAuth) {
    apiBase.dispatch(logout())
    apiBase.dispatch(api.util.resetApiState())
    return result
  }

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
      apiBase.dispatch(setTokens({ token: data.token, refreshToken: data.refreshToken }))

      isRefreshing = false
      refreshPromise = null

      // Retry original request with new token
      return await baseQuery(args, apiBase, extraOptions)
    } else {
      isRefreshing = false
      refreshPromise = null
      apiBase.dispatch(logout())
      apiBase.dispatch(api.util.resetApiState())
      return result
    }
  } catch {
    isRefreshing = false
    refreshPromise = null
    apiBase.dispatch(logout())
    apiBase.dispatch(api.util.resetApiState())
    return result
  }
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Auth", "Preset", "Jobs", "Chats"],
  endpoints: (builder) => ({
    getActivePreset: builder.query<PresetType, void>({
      query: () => "/cms/presets/active",
      providesTags: ["Preset"],
    }),

    getServices: builder.query<ServicesResponse, void>({
      query: () => "/services?page=1&perPage=100&sort=ASC",
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
        proType?: string
        distanceKm?: number
        minRating?: number
        maxResponseTimeHours?: number
        creditCardPayment?: boolean
      }
    >({
      query: ({ categoryId, placeOfService, customerAddress, filterOptionsIds, proType, distanceKm, minRating, maxResponseTimeHours, creditCardPayment }) => {
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
      invalidatesTags: ["Jobs"],
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

    markAllAsRead: builder.mutation<ChatMessageType[], number>({
      query: (chatId) => ({
        url: `/chats/${chatId}/messages/mark-all-as-read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Chats"],
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
  useCreateReviewMutation,
} = api
