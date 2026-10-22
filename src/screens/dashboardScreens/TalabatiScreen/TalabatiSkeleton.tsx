import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import Animated, { FadeIn } from "react-native-reanimated"
import { a } from "@tappler/shared/src/ds"
import { talabatiSkeletonStyles } from "./styles"

const TalabatiSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <Animated.View entering={FadeIn.duration(400).delay(delay)}>
    <DmView style={[a.px_16, a.py_14]}>
      {/* Title */}
      <SkeletonLoader width="55%" height={16} borderRadius={6} />
      {/* Status */}
      <DmView style={a.mt_8}>
        <SkeletonLoader width="40%" height={12} borderRadius={6} />
      </DmView>
      {/* Area */}
      <DmView style={a.mt_8}>
        <SkeletonLoader width="25%" height={12} borderRadius={6} />
      </DmView>
      {/* Posted date */}
      <DmView style={a.mt_8}>
        <SkeletonLoader width="50%" height={12} borderRadius={6} />
      </DmView>
      {/* Leave Review button */}
      <DmView style={a.mt_12}>
        <SkeletonLoader width={110} height={28} borderRadius={4} />
      </DmView>
      {/* Separator — matching actual card */}
      <DmView style={[a.mt_14, talabatiSkeletonStyles.box]} />
    </DmView>
  </Animated.View>
)

const TalabatiSkeleton: React.FC = () => {
  return (
    <DmView style={a.flex_1}>
      <TalabatiSkeletonCard delay={0} />
      <TalabatiSkeletonCard delay={100} />
      <TalabatiSkeletonCard delay={200} />
      <TalabatiSkeletonCard delay={300} />
    </DmView>
  )
}

export default TalabatiSkeleton
