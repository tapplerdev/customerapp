import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

import { PresetSectionType, PresetSectionItemType } from "types/cms"
import PresetCard from "./PresetCard"
import { AppScrollView } from "components/scroll"
import { Text, a as atoms } from "@tappler/shared/src/ds"

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
    <DmView style={atoms.mt_24}>
      <DmView style={atoms.px_16}>
        {!!title && (
          <Text size={20} weight="semibold" leading="tight">
            {title}
          </Text>
        )}
        {!!description && (
          <Text size={13} leading="legacy" style={atoms.mt_2}>
            {description}
          </Text>
        )}
      </DmView>
      <AppScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={atoms.mt_12}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {isDoubleStacked
          ? // Render each group as a vertical column (top + bottom card)
            sortedGroups.map((group) => (
              <DmView
                key={`${section.id}-g-${group.id}`}
                style={[atoms.flex_col, atoms.mr_10]}
              >
                {group.items.map((item, idx) => (
                  <DmView
                    key={`${section.id}-${group.id}-${item.id}`}
                    style={idx > 0 && atoms.mt_12}
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
      </AppScrollView>
    </DmView>
  )
}

export default PresetSection
