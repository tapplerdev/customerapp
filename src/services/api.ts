import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { API_URL } from "config"
// Firebase 26 deleted the namespaced API; deleteToken is now modular and takes
// the Messaging instance.
import { deleteToken, getMessaging } from "@react-native-firebase/messaging"
import { chatReadRegistry } from "services/chatReadRegistry"
import { withRetryAfter } from "utils/authErrors"
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
import {
  AreaGeometryResponse,
  FoodMenuType,
  PointAreasResponse,
} from "types/food"
import {
  ChatType,
  ChatMessageType,
  ListChatsResponse,
  ListMessagesResponse,
} from "types/chat"
import {
  CreateJobRequest,
  JobProType,
  JobType,
  ListJobsResponse,
} from "types/job"
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

// The Idempotency-Key header (be#416) on a create, when the caller has one.
// A header, never a body field: an older API refuses unknown body fields
// (forbidNonWhitelisted) but ignores a header.
const idempotencyHeader = (key?: string) =>
  key ? { headers: { "Idempotency-Key": key } } : {}

// The pros listing's one page: the server's perPage cap (anything above is
// clamped to 100). The screen loads no further pages.
export const PROS_LIST_PER_PAGE = 100

// Prevent multiple simultaneous refresh attempts
let isRefreshing = false
let refreshPromise: Promise<any> | null = null

// Request logging is for development only. A release build's console reaches
// the device log, and these lines carry response bodies (names, phone numbers,
// addresses) and the auth state. The arguments are built inside the callback,
// so a release build doesn't serialise every response just to drop it.
const devLog = (line: () => unknown[]) => {
  if (__DEV__) console.log(...line())
}

// Whether the store still holds the account a request was sent as. Logout
// only clears the store, so a late answer for account A can land after B has
// signed in, and nothing it carries may be applied to B's session.
const stillSignedInAs = (
  apiBase: { getState: () => unknown },
  userId?: number
) => {
  const { auth } = apiBase.getState() as RootState
  return !!auth.token && auth.user?.id === userId
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiBase, extraOptions) => {
  const url = typeof args === "string" ? args : args.url
  devLog(() => [
    `[API] ${typeof args === "string" ? "GET" : (args as FetchArgs).method || "GET"} ${API_URL}${url}`,
  ])

  // The token and account this request goes out with, compared with the
  // store when a 401 comes back.
  const sentState = apiBase.getState() as RootState
  const sentWith = sentState.auth.token
  const sentBy = sentState.auth.user?.id

  const result = await baseQuery(args, apiBase, extraOptions)

  if (result?.error) {
    devLog(() => [
      `[API] ❌ Error:`,
      result.error!.status,
      JSON.stringify(result.error!.data || result.error).substring(0, 200),
    ])
  } else {
    devLog(() => [
      `[API] ✅ Success: ${JSON.stringify(result.data).substring(0, 100)}...`,
    ])
  }

  if (result?.error?.status !== 401) {
    return result
  }

  devLog(() => [`[API] 🔒 Got 401 for ${url}`])

  // Decide from the store as it is NOW, not as it was when the request went
  // out. Signed out, or a DIFFERENT account signed in meanwhile: hand the 401
  // back. Refreshing would use B's refresh token to replay A's request as B,
  // and a refused refresh would sign B out. (A request sent with no token is
  // a guest's, and its 401 has nothing to refresh either.)
  if (!sentWith || !stillSignedInAs(apiBase, sentBy)) {
    devLog(() => [`[API] 🔒 Sent by another session — returning the 401`])
    return result
  }

  const { refreshToken, isAuth, token } = (apiBase.getState() as RootState).auth

  // Another request already refreshed while this one was out: the new token
  // is in the store, so a plain retry is all this needs. A second refresh
  // would only spend the rotated refresh token again.
  if (token !== sentWith) {
    devLog(() => [`[API] 🔒 Token already refreshed — retrying`])
    return await baseQuery(args, apiBase, extraOptions)
  }

  if (!refreshToken || !isAuth) {
    devLog(() => [
      `[API] 🔒 No refresh token or not auth — returning 401 silently`,
    ])
    return result
  }

  devLog(() => [`[API] 🔒 Attempting token refresh...`])

  try {
    // If another request is already refreshing, wait for it
    if (isRefreshing && refreshPromise) {
      await refreshPromise
      // The refresh can settle after a sign-out or another sign-in.
      if (!stillSignedInAs(apiBase, sentBy)) return result
      return await baseQuery(args, apiBase, extraOptions)
    }

    isRefreshing = true
    // POST with the token in the body (backend #419): same answers as the
    // old GET /auth/refresh/:token, without the token in a URL that access
    // logs keep. Single-flight as before, and bounded by the base query's
    // 20 s timeout.
    refreshPromise = baseQuery(
      { url: "/auth/refresh", method: "POST", body: { refreshToken } },
      apiBase,
      extraOptions
    )

    const refreshResult = await refreshPromise

    // The session changed while the refresh was out: its answer belongs to
    // the old one, so neither store its tokens nor sign out on its refusal.
    // That covers another account signing in, and the same account signing
    // out and back in (a fresh pair the old refresh must not touch). Only
    // this refresh or a sign-in moves the token off `sentWith` here.
    if (
      !stillSignedInAs(apiBase, sentBy) ||
      (apiBase.getState() as RootState).auth.token !== sentWith
    ) {
      isRefreshing = false
      refreshPromise = null
      return result
    }

    if (refreshResult.data) {
      const data = refreshResult.data as { token: string; refreshToken: string }
      devLog(() => [
        `[API] 🔒 Token refresh SUCCESS — retrying original request`,
      ])
      apiBase.dispatch(
        setTokens({ token: data.token, refreshToken: data.refreshToken })
      )

      isRefreshing = false
      refreshPromise = null

      // Retry original request with new token
      return await baseQuery(args, apiBase, extraOptions)
    } else {
      devLog(() => [
        `[API] 🔒 Token refresh FAILED:`,
        JSON.stringify(
          refreshResult.error?.data || refreshResult.error
        ).substring(0, 200),
      ])
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
        devLog(() => [
          `[API] 🔒 Refresh token invalid (${String(refreshStatus)}) — logging out`,
        ])
        // Kill the push token at Firebase too (services/session does the same,
        // plus the backend call this dead session cannot make): a signed-out
        // phone must not keep receiving the account's pushes.
        void Promise.resolve()
          .then(() => deleteToken(getMessaging()))
          .catch(() => undefined)
        apiBase.dispatch(logout())
        apiBase.dispatch(api.util.resetApiState())
      } else {
        devLog(() => [
          `[API] 🔒 Refresh unreachable (${String(refreshStatus)}) — keeping session`,
        ])
      }
      return result
    }
  } catch (e: any) {
    // Exceptions here are code/network failures, never an auth verdict —
    // keep the session.
    devLog(() => [
      `[API] 🔒 Token refresh EXCEPTION (keeping session):`,
      e?.message || e,
    ])
    isRefreshing = false
    refreshPromise = null
    return result
  }
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Auth",
    "Preset",
    "Jobs",
    "Chats",
    "Notifications",
    "OfferHistory",
  ],
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
        (typeof search === "string" && search
          ? `&search=${encodeURIComponent(search)}`
          : ""),
    }),

    getServiceById: builder.query<ServiceType, number>({
      query: (id) => `/services/${id}`,
    }),

    customerSignUp: builder.mutation<
      CustomerSignUpResponse,
      CustomerSignUpRequest
    >({
      query: (body) => ({ url: "/customers", method: "POST", body }),
      // A 429's wait is in Retry-After, which the caller can't see otherwise.
      transformErrorResponse: withRetryAfter,
    }),

    auth: builder.mutation<AuthResponse, AuthRequest>({
      query: (body) => ({ url: "/auth", method: "POST", body }),
      transformErrorResponse: withRetryAfter,
    }),

    getCustomerMe: builder.query<CustomerMeResponse, void>({
      query: () => "/customers/me",
      providesTags: ["Auth"],
    }),

    updateCustomer: builder.mutation<CustomerMeResponse, UpdateCustomerRequest>(
      {
        query: (body) => ({ url: "/customers", method: "PATCH", body }),
        // Only on success. RTK Query invalidates on isRejectedWithValue too, so a
        // FAILED update refetched Auth as well — harmless for a form the user
        // resubmits by hand, but BootstrapScreen PATCHes automatically whenever
        // the server's language differs from the app's, and the refetch handed it
        // a new object that still differed. A 400 became an unbounded PATCH/GET
        // loop for the rest of the session.
        invalidatesTags: (_result, error) => (error ? [] : ["Auth"]),
      }
    ),

    getProsForCategory: builder.query<
      ListProsResponse,
      {
        categoryId: number
        placeOfService?: string
        // With placeOfService fixedLocations only (utils/fixedLocation).
        fixedLocationId?: number
        customerAddress?: { latitude: number; longitude: number }
        filterOptionsIds?: number[]
        filterRanges?: { filterId: number; min?: number; max?: number }[]
        proType?: string
        distanceKm?: number
        minRating?: number
        maxResponseTimeHours?: number
        creditCardPayment?: boolean
        sortBy?: "distance" | "rating" | "responseTime"
      }
    >({
      query: ({
        categoryId,
        placeOfService,
        fixedLocationId,
        customerAddress,
        filterOptionsIds,
        filterRanges,
        proType,
        distanceKm,
        minRating,
        maxResponseTimeHours,
        creditCardPayment,
        sortBy,
      }) => {
        const params = new URLSearchParams()
        if (placeOfService) {
          params.append("placeOfService", placeOfService)
        }
        if (fixedLocationId != null) {
          params.append("fixedLocationId", String(fixedLocationId))
        }
        params.append("distanceKmFromCustomer", String(distanceKm ?? 50))
        if (customerAddress) {
          params.append(
            "customerAddress[latitude]",
            String(customerAddress.latitude)
          )
          params.append(
            "customerAddress[longitude]",
            String(customerAddress.longitude)
          )
        }
        if (filterOptionsIds?.length) {
          filterOptionsIds.forEach((id) =>
            params.append("filterOptionsIds[]", String(id))
          )
        }
        if (filterRanges?.length) {
          filterRanges.forEach(({ filterId, min, max }) =>
            params.append(
              "filterRanges[]",
              `${filterId}:${min ?? ""}:${max ?? ""}`
            )
          )
        }
        if (proType) params.append("proType", proType)
        if (minRating) params.append("minRating", String(minRating))
        if (maxResponseTimeHours)
          params.append("maxResponseTimeHours", String(maxResponseTimeHours))
        if (creditCardPayment) params.append("creditCardPayment", "true")
        if (sortBy) params.append("sortBy", sortBy)
        // The card view (backend #423): each pro as ProCard, its preloads and
        // the profile it opens read it, paged by pro. Without it the list
        // paged joined rows (a pro with stickers filled several of the 20)
        // and a sorted list had no limit at all. The screen has no "load
        // more", so it asks for one page of the most the server gives.
        params.append("view", "card")
        params.append("page", "1")
        params.append("perPage", String(PROS_LIST_PER_PAGE))
        return `/pros/category/${categoryId}?${params.toString()}`
      },
    }),

    createCustomerAddress: builder.mutation<
      CustomerSavedAddress,
      CreateCustomerAddressRequest
    >({
      query: (body) => ({ url: "/customers/addresses", method: "POST", body }),
      invalidatesTags: ["Auth"],
    }),

    deleteCustomerAddress: builder.mutation<void, number>({
      query: (id) => ({ url: `/customers/addresses/${id}`, method: "DELETE" }),
      invalidatesTags: ["Auth"],
    }),

    // Job posts and food orders. With an Idempotency-Key (be#416), a retry of
    // an attempt that did land answers 201 with that job instead of creating
    // a second one.
    createJob: builder.mutation<
      JobType,
      CreateJobRequest & { idempotencyKey?: string }
    >({
      query: ({ idempotencyKey, ...body }) => ({
        url: "/jobs",
        method: "POST",
        body,
        ...idempotencyHeader(idempotencyKey),
      }),
      invalidatesTags: ["Jobs"],
    }),

    getCustomerJobs: builder.query<
      ListJobsResponse,
      { page?: number; perPage?: number } | void
    >({
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

    // The profile view (backend #423): what ProProfileScreen and the screens
    // sharing this cache entry read (FoodMenu, FoodCheckout, RequestDetails,
    // the listing's image preload), without the history, media, user and
    // document chains the full pro loads.
    getProProfile: builder.query<
      ProType,
      { proId: number; serviceCategoryId?: number }
    >({
      query: ({ proId, serviceCategoryId }) => {
        const url = `/pros/${proId}?view=profile`
        return serviceCategoryId
          ? `${url}&serviceCategoryId=${serviceCategoryId}`
          : url
      },
    }),

    // hasMenu categories: the pro's latest APPROVED menu snapshot + delivery
    // zone info. Item ids/prices here are exactly what job submission is
    // validated against, so order lines are built from this response only.
    getProMenu: builder.query<
      FoodMenuType,
      { proId: number; serviceCategoryId: number }
    >({
      query: ({ proId, serviceCategoryId }) =>
        `/pros/category/${serviceCategoryId}/${proId}/menu`,
    }),

    // Backend-authoritative delivery-zone advisory — same ST_Distance check
    // createJob enforces. Coords ride in the body, not the URL. A query (not
    // a mutation) so the checkout can read isFetching/error for fail-open.
    checkDelivery: builder.query<
      {
        deliverable: boolean
        deliveryRadius: number | null
        // A pro can cap how far a customer may travel from for pickup.
        // ProsServeJobLocation enforces it at createJob, so the checkout
        // reads it here rather than surfacing a raw 400 at Submit.
        pickupReachable: boolean
        pickupRadius: number | null
      },
      {
        proId: number
        serviceCategoryId: number
        latitude: number
        longitude: number
      }
    >({
      query: ({ proId, serviceCategoryId, latitude, longitude }) => ({
        url: `/pros/category/${serviceCategoryId}/${proId}/delivery-check`,
        method: "POST",
        body: { latitude, longitude },
      }),
    }),

    // Which curated area a point falls in. Used to turn the pro's coordinates
    // into an area we can outline on a pickup order, without ever putting a pin
    // on their exact address before they've accepted.
    getPointAreas: builder.query<
      PointAreasResponse,
      { latitude: number; longitude: number }
    >({
      query: ({ latitude, longitude }) =>
        `/service-areas/point?latitude=${latitude}&longitude=${longitude}`,
    }),

    // Server-simplified area outline (GeoJSON, [lng, lat] order) — the same
    // endpoint the pro app's opportunity map uses.
    getAreaGeometry: builder.query<
      AreaGeometryResponse,
      { type: string; id: string }
    >({
      query: ({ type, id }) => `/service-areas/geometry?type=${type}&id=${id}`,
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

    respondToOpportunity: builder.mutation<
      JobProType,
      {
        jobId: number
        proId: number
        selectionStatus: "offer" | "customerRejected"
      }
    >({
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
      query: ({ jobId, proId }) => `/jobs/${jobId}/pros/${proId}/offer-history`,
      // The customer never revises an offer, so nothing on this side could
      // invalidate it — the socket does, when the pro's revision lands (see
      // useChatSocket). Without that the history sheet showed whatever was true
      // the first time it was opened for the rest of the session.
      providesTags: ["OfferHistory"],
    }),

    // Stored in-app notifications (same backend table + endpoints as proapp;
    // the API filters to the authed customer). NotificationsScreen pages by
    // 20; the HomeHeader bell reads getUnreadNotificationsCount below. Both
    // are refreshed by the "Notifications" tag.
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

    // The bell's count (backend #423): one COUNT of the caller's unread rows,
    // instead of a page of 100 rows reduced to a number (which also stopped
    // counting at 100). Same tag, so a read or a socket event refreshes it.
    getUnreadNotificationsCount: builder.query<
      { count: number },
      { excludeEventPrefix?: string }
    >({
      query: ({ excludeEventPrefix }) =>
        "/notifications/unread-count" +
        (excludeEventPrefix
          ? `?excludeEventPrefix=${encodeURIComponent(excludeEventPrefix)}`
          : ""),
      providesTags: ["Notifications"],
    }),

    markNotificationAsRead: builder.mutation<NotificationsItemType, number>({
      query: (id) => ({
        url: `/notifications/${id}/mark-as-read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),

    markAllNotificationsAsRead: builder.mutation<NotificationsItemType[], void>(
      {
        query: () => ({
          url: "/notifications/mark-all-as-read",
          method: "PATCH",
        }),
        invalidatesTags: ["Notifications"],
      }
    ),

    openChat: builder.query<
      ChatType,
      { categoryId: number; recipientId: number; jobId?: number }
    >({
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
          if (
            preview.notReadMessages > 0 &&
            chatReadRegistry.has(preview.chat.id)
          ) {
            preview.notReadMessages = 0
          }
        })
        return response
      },
      providesTags: ["Chats"],
    }),

    getChatMessages: builder.query<
      ListMessagesResponse,
      { chatId: number; page?: number; perPage?: number }
    >({
      query: ({ chatId, page = 1, perPage = 20 }) =>
        `/chats/${chatId}/messages?page=${page}&perPage=${perPage}`,
    }),

    sendMessage: builder.mutation<
      ChatMessageType,
      {
        chatId: number
        text?: string
        files?: string[]
        location?: { latitude: number; longitude: number }
        idempotencyKey?: string
      }
    >({
      query: ({ chatId, idempotencyKey, ...body }) => ({
        url: `/chats/${chatId}/messages`,
        method: "POST",
        body,
        ...idempotencyHeader(idempotencyKey),
      }),
      invalidatesTags: ["Chats"],
    }),

    uploadFile: builder.mutation<
      { storageKey: string },
      { path: string; mime?: string; filename?: string }
    >({
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

    // The endpoint has accepted customers since it was written —
    // @UseAuth([AuthUserType.pro, AuthUserType.customer]) — but only the pro
    // app ever called it, so no customer had a registration token and every
    // push the backend tried to send them was dropped on its own side.
    // No cache tag: this writes device state, not anything the app reads back.
    registerNotificationsDevice: builder.mutation<
      { id: number },
      { registrationToken: string }
    >({
      query: (body) => ({
        url: "/notifications/registration-token",
        method: "POST",
        body,
      }),
    }),
    // Sign-out on this device (services/session), after the push token's
    // removal below: ends the session server-side (backend #419). No guard,
    // always 204, even for a token already gone, so it can't fail a sign-out.
    logout: builder.mutation<void, { refreshToken?: string }>({
      query: (body) => ({ url: "/auth/logout", method: "POST", body }),
    }),
    // Sign-out on this device (services/session). Names the token so a call
    // landing after a quick re-login under a new token cannot delete it.
    removeNotificationsDevice: builder.mutation<
      void,
      { registrationToken: string }
    >({
      query: (body) => ({
        url: "/notifications/registration-token/remove",
        method: "POST",
        body,
      }),
    }),
  }),
})

export const {
  useRegisterNotificationsDeviceMutation,
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
  useGetProMenuQuery,
  useLazyGetProMenuQuery,
  useCheckDeliveryQuery,
  useGetPointAreasQuery,
  useGetAreaGeometryQuery,
  useCancelJobMutation,
  useRespondToOpportunityMutation,
  useGetOfferHistoryQuery,
  useCreateReviewMutation,
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  useGetUnreadNotificationsCountQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} = api
