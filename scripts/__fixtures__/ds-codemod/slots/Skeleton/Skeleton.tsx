// SkeletonLoader's shape: sized by its props, reading no style. Imported by
// file path, NativeWind wraps a call site and hands its className over as a
// style this never reads, so the classes draw nothing.
import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  width: number
  height: number
}

const Skeleton: React.FC<Props> = ({ width, height }) => (
  <DmView style={{ width, height }} />
)

export default Skeleton
