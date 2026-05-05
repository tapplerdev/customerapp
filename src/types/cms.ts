export type FileType = {
  id: number
  url: string
  url1920?: string
  url720?: string
  url150?: string
}

export type QuestionOptionType = {
  id: number
  label: string
  labelAr?: string
  value: string
  valueAr?: string
  icon?: string
  iconStorageKey?: string
  serviceCategoryFilterOptionId?: number
}

export type QuestionStyleType =
  | "checkmark"
  | "checkbox"
  | "radio"
  | "chips"
  | "imageWithText"
  | "imageWithCheckmark"
  | "textWithCheckmark"

export type QuestionLayoutStyleType = "horizontal" | "onePerRow" | "wrap"

export type ServiceQuestionType = {
  id: number
  assignee: "pro" | "customer"
  type: "shortAnswer" | "paragraph" | "oneChoice" | "multipleChoice" | "dateTime" | "files"
  style?: QuestionStyleType
  text: string
  textAr?: string
  options?: QuestionOptionType[]
  isFilter: boolean
  layoutQuestionStyle?: QuestionLayoutStyleType
  dateType?: "date" | "dateRange"
  timeType?: "time" | "timeRange"
  timeText?: string
  order: number
}

export type ServiceCategoryDateType = {
  id: number
  type: string
}

export type ServiceCategoryType = {
  id: number
  nameEn: string
  nameAr: string
  picture?: FileType
  serviceId?: number
  placeOfService?: string[]
  customerQuestions?: ServiceQuestionType[]
  proQuestions?: ServiceQuestionType[]
  dateTypes?: ServiceCategoryDateType[]
}

export type ServiceType = {
  id: number
  nameEn: string
  nameAr: string
  categories?: ServiceCategoryType[]
}

export type ServicesResponse = {
  data: ServiceType[]
  perPage: number
  page: number
  total: number
}

export type PresetSectionShapeType =
  | "squareWithOverlay"
  | "doubleRectangles"
  | "rectangleWithOverlay"
  | "rectangleWithText"

export type PresetSectionDataSource = "mainCategories" | "subCategories"

export type PresetSectionItemType = {
  id: number
  nameEn?: string | null
  nameAr?: string | null
  pictureEn: FileType
  pictureAr: FileType
  services?: ServiceType[]
  serviceCategories?: ServiceCategoryType[]
  groupId: number
}

export type PresetSectionItemsGroupType = {
  id: number
  order: number
  sectionId: number
  items: PresetSectionItemType[]
}

export type PresetSectionType = {
  id: number
  order: number
  shapeType: PresetSectionShapeType
  titleEn: string
  titleAr: string
  descriptionEn: string
  descriptionAr: string
  dataSource: PresetSectionDataSource
  viewAll: boolean
  groups: PresetSectionItemsGroupType[]
}

export type PresetType = {
  id: number
  name: string
  isActive: boolean
  updatedAt: string
  sections: PresetSectionType[]
}
