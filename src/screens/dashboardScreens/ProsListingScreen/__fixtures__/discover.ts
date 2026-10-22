/**
 * Jest only. What the discover screens' sheets are drawn from: a category with
 * three places of service and every kind of question the question flow, the
 * job-details editor and the filters sheet draw (an upfront filter, a
 * refinement filter with a parent, a range filter, a multiple choice, a
 * paragraph), and a food category with the pro-declared filter food shows.
 * Made up, typed by the app's own types.
 */
import type {
  QuestionOptionType,
  ServiceCategoryType,
  ServiceQuestionType,
  ServiceType,
} from "types/cms"

import { CATEGORY, CATEGORY_FOOD, SERVICE, SERVICE_FOOD } from "testing/screenKit/fixtures/entities"

const option = (
  id: number,
  value: string,
  valueAr: string,
  extra: Partial<QuestionOptionType> = {}
): QuestionOptionType => ({ id, label: value, labelAr: valueAr, value, valueAr, ...extra })

/** An upfront filter: asked first, a locked parent for the refinement below. */
export const Q_KIND: ServiceQuestionType = {
  id: 801,
  assignee: "customer",
  type: "oneChoice",
  style: "radio",
  text: "What kind of job is it?",
  textAr: "ما نوع العمل؟",
  isFilter: true,
  tier: "primary",
  order: 1,
  options: [
    option(8011, "Repair", "إصلاح", { serviceCategoryFilterOptionId: 9011, filterOptionKey: "repair" }),
    option(8012, "Installation", "تركيب", { serviceCategoryFilterOptionId: 9012, filterOptionKey: "install" }),
  ],
}

/** A refinement filter: chips in the filters sheet, children shown once their parent is picked. */
export const Q_BRAND: ServiceQuestionType = {
  id: 802,
  assignee: "customer",
  type: "multipleChoice",
  style: "chips",
  text: "Which brand do you use?",
  textAr: "ما العلامة التجارية التي تستخدمها؟",
  isFilter: true,
  tier: "refinement",
  order: 2,
  options: [
    option(8021, "Any brand", "أي علامة", { serviceCategoryFilterOptionId: 9021, filterOptionKey: "any" }),
    option(8022, "Ideal Standard", "ايديال ستاندرد", { serviceCategoryFilterOptionId: 9022, filterOptionKey: "ideal", parentFilterOptionKey: "repair" }),
    option(8023, "Grohe", "غروهي", { serviceCategoryFilterOptionId: 9023, filterOptionKey: "grohe", parentFilterOptionKey: "install" }),
  ],
}

/** A range filter: From and To boxes and a slider. */
export const Q_BUDGET: ServiceQuestionType = {
  id: 803,
  assignee: "customer",
  type: "shortAnswer",
  text: "Your budget",
  textAr: "ميزانيتك",
  isFilter: true,
  tier: "refinement",
  filter: { id: 91, label: "Budget", labelAr: "الميزانية", valueType: "range", minValue: 100, maxValue: 900 },
  order: 3,
}

/** A range filter with no usable bounds: the boxes, no slider. */
export const Q_AREA: ServiceQuestionType = {
  id: 804,
  assignee: "customer",
  type: "shortAnswer",
  text: "Area in square metres",
  textAr: "المساحة بالمتر المربع",
  isFilter: true,
  tier: "refinement",
  filter: { id: 92, valueType: "range" },
  order: 4,
}

export const Q_EXTRAS: ServiceQuestionType = {
  id: 805,
  assignee: "customer",
  type: "multipleChoice",
  style: "checkbox",
  text: "Anything else to fix?",
  textAr: "هل هناك شيء آخر للإصلاح؟",
  isFilter: false,
  order: 5,
  options: [
    option(8051, "The tap", "الصنبور"),
    option(8052, "The drain", "الصرف"),
    option(8053, "The heater", "السخان"),
  ],
}

export const Q_DETAILS: ServiceQuestionType = {
  id: 806,
  assignee: "customer",
  type: "paragraph",
  text: "Anything the pro should know?",
  textAr: "هل هناك ما يجب أن يعرفه المحترف؟",
  isFilter: false,
  order: 6,
}

export const QUESTIONS_RICH = [Q_KIND, Q_BRAND, Q_BUDGET, Q_AREA, Q_EXTRAS, Q_DETAILS]

/** Plumbing again, with three places of service and every question kind. */
export const CATEGORY_RICH: ServiceCategoryType = {
  ...CATEGORY,
  placeOfService: ["proToCustomer", "customerToPro", "remoteOrOnline"],
  customerQuestions: QUESTIONS_RICH,
}

export const SERVICE_RICH: ServiceType = { ...SERVICE, categories: [CATEGORY_RICH] }

/** One place of service, one plain question: no place step in the flow. */
export const CATEGORY_PLAIN: ServiceCategoryType = {
  ...CATEGORY,
  placeOfService: ["proToCustomer"],
  customerQuestions: [Q_DETAILS],
}
export const SERVICE_PLAIN: ServiceType = { ...SERVICE, categories: [CATEGORY_PLAIN] }

/** The pro-declared filter a food category shows its customers (Cuisines). */
export const Q_CUISINES: ServiceQuestionType = {
  id: 811,
  assignee: "pro",
  type: "multipleChoice",
  text: "I make food from…",
  textAr: "أطبخ من…",
  isFilter: true,
  filter: { id: 93, label: "Cuisines", labelAr: "المطابخ", valueType: "discrete" },
  order: 1,
  options: [
    option(8111, "Egyptian", "مصري", { serviceCategoryFilterOptionId: 9111, filterOptionKey: "egyptian" }),
    option(8112, "Italian", "إيطالي", { serviceCategoryFilterOptionId: 9112, filterOptionKey: "italian" }),
    option(8113, "No filter id", "بلا معرف"),
  ],
}

export const CATEGORY_FOOD_FILTERS: ServiceCategoryType = {
  ...CATEGORY_FOOD,
  proQuestions: [Q_CUISINES],
}
export const SERVICE_FOOD_FILTERS: ServiceType = { ...SERVICE_FOOD, categories: [CATEGORY_FOOD_FILTERS] }
