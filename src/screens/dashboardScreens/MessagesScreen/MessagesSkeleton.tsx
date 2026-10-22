import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import Animated, { FadeIn } from "react-native-reanimated"
import { a } from "@tappler/shared/src/ds"
import { messagesSkeletonStyles } from "./styles"

const MessagesSkeletonCard: React.FC<{ delay: number }> = ({ delay }) => (
  <Animated.View entering={FadeIn.duration(400).delay(delay)}>
    <DmView style={[messagesSkeletonStyles.boxWrap, a.pt_10]}>
      <DmView style={[a.flex_row, a.items_start]}>
        {/* Avatar */}
        <DmView style={a.mr_10}>
          <SkeletonLoader width={40} height={40} borderRadius={20} />
        </DmView>
        <DmView style={a.flex_1}>
          {/* Name + timestamp row */}
          <DmView style={[a.flex_row, a.items_center, a.justify_between]}>
            <SkeletonLoader width="50%" height={15} borderRadius={6} />
            <SkeletonLoader width={55} height={11} borderRadius={6} />
          </DmView>
          {/* Service name */}
          <DmView style={a.mt_6}>
            <SkeletonLoader width="35%" height={13} borderRadius={6} />
          </DmView>
          {/* Last message */}
          <DmView style={a.mt_6}>
            <SkeletonLoader width="65%" height={11} borderRadius={6} />
          </DmView>
        </DmView>
      </DmView>
    </DmView>
    <DmView style={[messagesSkeletonStyles.box, a.border_b_1]} />
  </Animated.View>
)

const MessagesSkeleton: React.FC = () => {
  return (
    <DmView style={a.flex_1}>
      <MessagesSkeletonCard delay={0} />
      <MessagesSkeletonCard delay={80} />
      <MessagesSkeletonCard delay={160} />
      <MessagesSkeletonCard delay={240} />
      <MessagesSkeletonCard delay={320} />
    </DmView>
  )
}

export default MessagesSkeleton
