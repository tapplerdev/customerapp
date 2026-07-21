import { TypedEventBus } from "@tappler/shared/src/events/TypedEventBus"
import { QuestionAnswerType } from "types/job"

export type QuestionFlowResult = {
  placeOfService?: string
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
}

export const questionFlowEventBus = new TypedEventBus<QuestionFlowEventMap>()
