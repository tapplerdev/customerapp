import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import Animated, { FadeIn } from "react-native-reanimated"

const MessagesSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <Animated.View entering={FadeIn.duration(400).delay(delay)}>
    <DmView className="px-[15] pt-[10] pb-[13]">
      <DmView className="flex-row items-start">
        {/* Avatar */}
        <DmView className="mr-[10]">
          <SkeletonLoader width={40} height={40} borderRadius={20} />
        </DmView>
        <DmView className="flex-1">
          {/* Name + timestamp row */}
          <DmView className="flex-row items-center justify-between">
            <SkeletonLoader width="50%" height={15} borderRadius={6} />
            <SkeletonLoader width={55} height={11} borderRadius={6} />
          </DmView>
          {/* Service name */}
          <DmView className="mt-[6]">
            <SkeletonLoader width="35%" height={13} borderRadius={6} />
          </DmView>
          {/* Last message */}
          <DmView className="mt-[6]">
            <SkeletonLoader width="65%" height={11} borderRadius={6} />
          </DmView>
        </DmView>
      </DmView>
    </DmView>
    <DmView className="mr-[15] border-b-1 border-grey4" />
  </Animated.View>
)

const MessagesSkeleton: React.FC = () => {
  return (
    <DmView className="flex-1">
      <MessagesSkeletonCard delay={0} />
      <MessagesSkeletonCard delay={80} />
      <MessagesSkeletonCard delay={160} />
      <MessagesSkeletonCard delay={240} />
      <MessagesSkeletonCard delay={320} />
    </DmView>
  )
}

export default MessagesSkeleton
