import React, { useCallback, useState } from "react"
import { LayoutChangeEvent } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import LegacyText from "@tappler/shared/src/components/LegacyText"
import { useTranslation } from "react-i18next"
import { a } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  title?: string
}

const MAX_WIDTH = 91
const MAX_HEIGHT = 21
const MAX_TITLE_FONT_SIZE = 12
const MAX_FONT_SIZE = 9

const ScaleableDistinctLabelComponent: React.FC<Props> = ({
  title,
}) => {
  const [layout, setLayout] = useState({
    viewWidth: 0,
    viewHeight: 0,
    textSize: 0,
  })
  const { t } = useTranslation()

  const onLayoutChange = useCallback((event: LayoutChangeEvent) => {
    const layoutWidth = event.nativeEvent.layout.width
    const viewWidth = layoutWidth < MAX_WIDTH ? layoutWidth : MAX_WIDTH
    const viewHeight = (viewWidth * MAX_HEIGHT) / MAX_WIDTH
    const baseTextSize = title ? MAX_TITLE_FONT_SIZE : MAX_FONT_SIZE
    const titleTextSize = (baseTextSize * viewWidth) / MAX_WIDTH
    setLayout({
      viewWidth,
      viewHeight,
      textSize: titleTextSize,
    })
  }, [])

  return (
    <DmView style={[a.w_full, styles.container, a.justify_end]} onLayout={onLayoutChange}>
      <DmView
        style={[a.items_center, a.justify_center, styles.textWrap, { width: layout.viewWidth, height: layout.viewHeight }]}
      >
        {/* A size that follows the layout is no ds size: LegacyText */}
        <LegacyText
          weight="semibold"
          style={{
            fontSize: layout.textSize,
            lineHeight: layout.textSize + 2,
          }}
        >
          {title || t("distinct")}
        </LegacyText>
      </DmView>
    </DmView>
  )
}

export default ScaleableDistinctLabelComponent
