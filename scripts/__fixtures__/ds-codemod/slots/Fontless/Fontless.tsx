// Titled's text slot with fontClassName forgotten: ClassNameText then draws
// no font layer, so a caller's font-customNNN and Arabic leading-[Npx] are
// lost at every call site still passing classes (S8). The codemod refuses
// its slot, as the wrap probe reviews the element.
import React from "react"
import type { StyleProp } from "react-native"

import { ClassNameText } from "@tappler/shared/src/components/classNameSlots"
import type {
  NoShorthands,
  SizeBringsLeading,
} from "@tappler/shared/src/components"
import { px, type DsTextStyle, type TextType } from "@tappler/shared/src/ds"

const Title = ClassNameText

const TITLE: TextType = { size: 16, weight: "semibold", leading: px(19) }

interface Props {
  title: string
  classNameTitle?: string
  /** The title's spacing and colour, after classNameTitle. */
  titleStyle?: StyleProp<DsTextStyle & NoShorthands>
  /** The title's typography. */
  titleType?: Partial<TextType> & SizeBringsLeading
}

const Fontless: React.FC<Props> = ({
  title,
  classNameTitle,
  titleStyle,
  titleType,
}) => (
  <Title
    {...TITLE}
    twinType={titleType}
    className={classNameTitle}
    twinStyle={titleStyle}
  >
    {title}
  </Title>
)

export default Fontless
