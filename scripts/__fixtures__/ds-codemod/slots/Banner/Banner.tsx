// BannerContainer's shape: a `containerStyle` that is a plain ViewStyle spread
// into an object, and a className with a default (`||`). Moving a call
// site's containerClassName into containerStyle would change what it draws,
// so its call sites wait.
import React from "react"
import type { ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  containerClassName?: string
  containerStyle?: ViewStyle
  children?: React.ReactNode
}

const Banner: React.FC<Props> = ({
  containerClassName = "",
  containerStyle,
  children,
}) => (
  <DmView
    className={`bg-white ${containerClassName || "px-[8] py-[8]"}`}
    style={{ borderWidth: 0.5, ...containerStyle }}
  >
    {children}
  </DmView>
)

export default Banner
