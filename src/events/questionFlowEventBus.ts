import { TypedEventBus } from "@tappler/shared/src/events/TypedEventBus"
import { QuestionAnswerType } from "types/job"

export type QuestionFlowResult = {
  placeOfService?: string
  // The venue picked for a fixed-location request (utils/fixedLocation)
  fixedLocationId?: number
  filterOptionIds: number[]
  dataAnswers: QuestionAnswerType[]
  allAnswers: QuestionAnswerType[]
  filtersChanged: boolean
}

type QuestionFlowEventMap = {
  "questions:done": QuestionFlowResult
  // Emitted by ServiceRequestDetailsScreen when a late filter answer excludes
  // a selected pro: the mounted listing merges the answers, refetches, prunes
  // the selection, and the details stack pops back to it.
  "details:answersChanged": { answers: QuestionAnswerType[] }
  // Emitted by RequestSummaryScreen when POST /jobs refuses the request
  // because a pro no longer serves it, or its place of service is no longer
  // offered (utils/jobRequestRefusal): the mounted listing fetches its list
  // from the network (never the cache), clearing the place first when it was
  // the place, and the prune drops the refused pros with its notice. A venue
  // the category no longer lists clears the venue the same way.
  "request:refused": {
    clearPlaceOfService: boolean
    clearFixedLocation?: boolean
  }
}

export const questionFlowEventBus = new TypedEventBus<QuestionFlowEventMap>()
