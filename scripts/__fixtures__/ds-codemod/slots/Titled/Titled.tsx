// A proapp text slot in tappler-shared's convention (what W2a-0 gives
// TitleRegistrationFlow): the class prop, then its style twin and its
// typography twin, drawn by ClassNameText with the title's own type first.
import React from "react"
import type { StyleProp } from "react-native"

import { ClassNameText } from "@tappler/shared/src/components/classNameSlots"
import type {
  NoShorthands,
  SizeBringsLeading,
} from "@tappler/shared/src/components"
import { px, type DsTextStyle, type TextType } from "@tappler/shared/src/ds"

// The caller's classes after the title's own type (classNameSlots.ts).
const Title = ClassNameText

/** The title's type unless the caller says otherwise. */
const TITLE: TextType = { size: 16, weight: "semibold", leading: px(19) }

interface Props {
  title: string
  classNameTitle?: string
  /** The title's spacing and colour, after classNameTitle. */
  titleStyle?: StyleProp<DsTextStyle & NoShorthands>
  /** The title's typography. */
  titleType?: Partial<TextType> & SizeBringsLeading
}

const Titled: React.FC<Props> = ({
  title,
  classNameTitle,
  titleStyle,
  titleType,
}) => (
  <Title
    {...TITLE}
    twinType={titleType}
    className={classNameTitle}
    fontClassName={classNameTitle}
    twinStyle={titleStyle}
  >
    {title}
  </Title>
)

export default Titled
