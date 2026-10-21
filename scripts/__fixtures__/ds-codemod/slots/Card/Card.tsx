// A component that already has its slots: `style` lands where `className`
// does (the root), `titleStyle` where `titleClassName` does (the title).
import React from "react"
import type { StyleProp, TextStyle, ViewStyle } from "react-native"
import clsx from "clsx"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

interface Props {
  title: string
  className?: string
  style?: StyleProp<ViewStyle>
  titleClassName?: string
  titleStyle?: StyleProp<TextStyle>
}

const Card: React.FC<Props> = ({
  title,
  className,
  style,
  titleClassName,
  titleStyle,
}) => (
  <DmView className={clsx("p-[12] bg-white", className)} style={style}>
    <DmText
      className={clsx("text-13 leading-[16px] font-custom600", titleClassName)}
      style={titleStyle}
    >
      {title}
    </DmText>
  </DmView>
)

export default Card
