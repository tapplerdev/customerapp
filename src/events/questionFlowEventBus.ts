import { TypedEventBus } from "@tappler/shared/src/events/TypedEventBus"
import { QuestionAnswerType } from "types/job"

export type QuestionFlowResult = {
  placeOfService?: string
  filterOptionIds: number[]
  dataAnswers: QuestionAnswerType[]
  filtersChanged: boolean
}

type QuestionFlowEventMap = {
  "questions:done": QuestionFlowResult
}

export const questionFlowEventBus = new TypedEventBus<QuestionFlowEventMap>()
