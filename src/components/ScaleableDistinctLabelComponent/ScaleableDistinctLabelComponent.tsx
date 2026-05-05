import React, { useCallback, useState } from "react"
import { LayoutChangeEvent } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import clsx from "clsx"

interface Props {
  title?: string
  contentClassName?: string
}

const MAX_WIDTH = 91
const MAX_HEIGHT = 21
const MAX_TITLE_FONT_SIZE = 12
const MAX_FONT_SIZE = 9

const ScaleableDistinctLabelComponent: React.FC<Props> = ({
  title,
  contentClassName,
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
    <DmView className="w-full h-[20] justify-end" onLayout={onLayoutChange}>
      <DmView
        className={clsx(
          "items-center justify-center bg-yellow rounded-2",
          contentClassName
        )}
        style={{ width: layout.viewWidth, height: layout.viewHeight }}
      >
        <DmText
          className="font-custom600"
          style={{
            fontSize: layout.textSize,
            lineHeight: layout.textSize + 2,
          }}
        >
          {title || t("distinct")}
        </DmText>
      </DmView>
    </DmView>
  )
}

export default ScaleableDistinctLabelComponent
