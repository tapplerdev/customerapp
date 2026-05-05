import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import Animated, { FadeIn } from "react-native-reanimated"

const TalabatiSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <Animated.View entering={FadeIn.duration(400).delay(delay)}>
    <DmView className="px-[16] py-[14]">
      {/* Title */}
      <SkeletonLoader width="55%" height={16} borderRadius={6} />
      {/* Status */}
      <DmView className="mt-[8]">
        <SkeletonLoader width="40%" height={12} borderRadius={6} />
      </DmView>
      {/* Area */}
      <DmView className="mt-[8]">
        <SkeletonLoader width="25%" height={12} borderRadius={6} />
      </DmView>
      {/* Posted date */}
      <DmView className="mt-[8]">
        <SkeletonLoader width="50%" height={12} borderRadius={6} />
      </DmView>
      {/* Leave Review button */}
      <DmView className="mt-[12]">
        <SkeletonLoader width={110} height={28} borderRadius={4} />
      </DmView>
      {/* Separator — matching actual card */}
      <DmView className="mt-[14] h-[0.5] bg-grey19" />
    </DmView>
  </Animated.View>
)

const TalabatiSkeleton: React.FC = () => {
  return (
    <DmView className="flex-1">
      <TalabatiSkeletonCard delay={0} />
      <TalabatiSkeletonCard delay={100} />
      <TalabatiSkeletonCard delay={200} />
      <TalabatiSkeletonCard delay={300} />
    </DmView>
  )
}

export default TalabatiSkeleton
