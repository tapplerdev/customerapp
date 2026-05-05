import React from "react"
import { ScrollView } from "react-native"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import { PresetSectionType, PresetSectionItemType } from "types/cms"
import PresetCard from "./PresetCard"

interface Props {
  section: PresetSectionType
  isAr: boolean
  onItemPress?: (item: PresetSectionItemType) => void
}

const PresetSection: React.FC<Props> = ({ section, isAr, onItemPress }) => {
  const title = isAr ? section.titleAr : section.titleEn
  const description = isAr ? section.descriptionAr : section.descriptionEn
  const sortedGroups = section.groups
    .slice()
    .sort((a, b) => a.order - b.order)
  const flatItems = sortedGroups.flatMap((g) => g.items)

  if (flatItems.length === 0) return null

  const isDoubleStacked = section.shapeType === "doubleRectangles"

  return (
    <DmView className="mt-[24]">
      <DmView className="px-[16]">
        {!!title && (
          <DmText className="text-20 font-custom600 text-black leading-[24px]">
            {title}
          </DmText>
        )}
        {!!description && (
          <DmText className="mt-[2] text-13 font-custom400 text-black">
            {description}
          </DmText>
        )}
      </DmView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-[12]"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {isDoubleStacked
          ? // Render each group as a vertical column (top + bottom card)
            sortedGroups.map((group) => (
              <DmView
                key={`${section.id}-g-${group.id}`}
                className="flex-col mr-[10]"
              >
                {group.items.map((item, idx) => (
                  <DmView
                    key={`${section.id}-${group.id}-${item.id}`}
                    className={idx > 0 ? "mt-[12]" : ""}
                  >
                    <PresetCard
                      item={item}
                      shapeType={section.shapeType}
                      isAr={isAr}
                      noEndMargin
                      onPress={() => onItemPress?.(item)}
                    />
                  </DmView>
                ))}
              </DmView>
            ))
          : flatItems.map((item) => (
              <PresetCard
                key={`${section.id}-${item.id}`}
                item={item}
                shapeType={section.shapeType}
                isAr={isAr}
                onPress={() => onItemPress?.(item)}
              />
            ))}
      </ScrollView>
    </DmView>
  )
}

export default PresetSection
