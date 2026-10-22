/**
 * Jest only. The backend's answers for customerapp's 18 queries (backend.ts
 * answers RTK Query by endpoint name, services/api.ts), in the states a
 * screen is captured in: DATA (every list has a row or two), EMPTY (every
 * list empty, nothing found), ERROR (every one of them a server error).
 * Mutations have no default answer: a write a screen sends on its own stays
 * in flight (and the request log shows it); a test that presses a save gives
 * its mutation an answer itself.
 *
 * Each answer is the wire's shape, typed by the app's response type: the
 * app's transformResponse still runs on it.
 */
import type { CustomerMeResponse } from "types/auth"
import type { ListChatsResponse, ListMessagesResponse } from "types/chat"
import type { PresetType, ServiceType, ServicesResponse } from "types/cms"
import type { FoodMenuType } from "types/food"
import type { JobType, ListJobsResponse } from "types/job"
import type { ListNotificationsResponse } from "types/notification"
import type { ListProsResponse, ProType } from "types/pro"

import type { BackendFixtures, EndpointAnswer } from "../backend"
import {
  AREA_GEOMETRY,
  CHAT,
  CHAT_MESSAGES,
  CHAT_PREVIEW,
  FOOD_MENU,
  JOB,
  JOB_FOOD,
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
  OFFER_HISTORY,
  POINT_AREAS,
  PRESET,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
  SERVICES,
} from "./entities"
import { CUSTOMER } from "./users"

const data = <T>(value: T): EndpointAnswer => ({ data: value })

/** The path a request asked for (a string, or the url of { url, ... }). */
export const urlOf = (args: unknown) =>
  typeof args === "string"
    ? args
    : String((args as { url?: unknown } | null)?.url ?? "")

/** The number at the end of a path (`/jobs/customer-jobs/8001/details` → 8001). */
const idIn = (args: unknown) => {
  const match = urlOf(args).match(/\/(\d+)(?:\/[a-z-]+)?(?:\?|$)/)
  return match ? Number(match[1]) : NaN
}

/** Page 1 has the rows; any later page is empty, as the end of a list is. */
const firstPageOnly =
  <T>(rows: T[], wrap: (rows: T[]) => unknown) =>
  (args: unknown): EndpointAnswer =>
    data(wrap(/[?&]page=([2-9]|\d{2,})/.test(urlOf(args)) ? [] : rows))

const page = <T>(rows: T[]) => ({
  data: rows,
  page: 1,
  perPage: 20,
  total: rows.length,
})

const JOBS: JobType[] = [JOB, JOB_FOOD]
const PROS: ProType[] = [PRO_INDIVIDUAL, PRO_COMPANY, PRO_FOOD]

const jobById = (args: unknown) => JOBS.find((job) => job.id === idIn(args)) ?? JOB
const serviceById = (args: unknown): ServiceType =>
  SERVICES.find((service) => service.id === idIn(args)) ?? SERVICES[0]
/** `/pros/1003?serviceCategoryId=302` → the pro, whichever category. */
const proById = (args: unknown) => {
  const id = Number(urlOf(args).match(/^\/pros\/(\d+)/)?.[1])
  return PROS.find((pro) => pro.id === id) ?? PRO_INDIVIDUAL
}

/** Every list has a row or two. */
export const DATA: BackendFixtures = {
  getActivePreset: data<PresetType>(PRESET),
  getServices: data<ServicesResponse>({ ...page(SERVICES), perPage: 100 }),
  getServiceById: (args) => data<ServiceType>(serviceById(args)),
  getCustomerMe: data<CustomerMeResponse>(CUSTOMER),
  getProsForCategory: firstPageOnly(PROS.slice(0, 2), (rows) =>
    page(rows) satisfies ListProsResponse
  ),
  getCustomerJobs: firstPageOnly(JOBS, (rows) =>
    page(rows) satisfies ListJobsResponse
  ),
  getCustomerJobDetails: (args) => data<JobType>(jobById(args)),
  getCustomerJobById: (args) => data<JobType>(jobById(args)),
  getProProfile: (args) => data<ProType>(proById(args)),
  getProMenu: data<FoodMenuType>(FOOD_MENU),
  checkDelivery: data({
    deliverable: true,
    deliveryRadius: 10,
    pickupReachable: true,
    pickupRadius: null,
  }),
  getPointAreas: data(POINT_AREAS),
  getAreaGeometry: data(AREA_GEOMETRY),
  getOfferHistory: data(OFFER_HISTORY),
  getNotifications: firstPageOnly(
    [NOTIFICATION_UNREAD, NOTIFICATION_READ],
    (rows) => page(rows) satisfies ListNotificationsResponse
  ),
  openChat: data(CHAT),
  getChats: data<ListChatsResponse>({ data: [CHAT_PREVIEW] }),
  getChatMessages: firstPageOnly(CHAT_MESSAGES, (rows) =>
    page(rows) satisfies ListMessagesResponse
  ),
}

/** Every list empty, every lookup found nothing it can show. */
export const EMPTY: BackendFixtures = {
  ...DATA,
  getActivePreset: data<PresetType>({ ...PRESET, sections: [] }),
  getServices: data<ServicesResponse>({ ...page([]), perPage: 100 }),
  getProsForCategory: data(page([])),
  getCustomerJobs: data(page([])),
  getNotifications: data(page([])),
  getChats: data<ListChatsResponse>({ data: [] }),
  getChatMessages: data(page([])),
  getOfferHistory: data({ data: [] }),
  getProMenu: data<FoodMenuType>({ ...FOOD_MENU, menuSections: [] }),
}

/** What fetchBaseQuery gives a 500. */
export const SERVER_ERROR: EndpointAnswer = {
  error: { status: 500, data: { message: "Internal server error" } },
}

/** Every query a server error. */
export const ERROR: BackendFixtures = Object.fromEntries(
  Object.keys(DATA).map((endpoint) => [endpoint, SERVER_ERROR])
)

/** The 18 queries in services/api.ts (pinned by screenKit.parity.tsx). */
export const QUERY_ENDPOINTS = Object.keys(DATA).sort()
