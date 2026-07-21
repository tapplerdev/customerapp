import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"

// 1:1 with proapp's NotificationsSkeletonScreen: five static rows with varied
// title/body widths (some notifications wrap to more lines), bar heights
// matching the real rows' line heights. Row chrome matches our list rows.
const ROWS: { title: string; bodyLines: string[] }[] = [
  { title: "70%", bodyLines: ["95%"] },
  { title: "60%", bodyLines: ["90%", "85%"] },
  { title: "75%", bodyLines: ["92%"] },
  { title: "65%", bodyLines: ["88%", "80%", "75%"] },
  { title: "80%", bodyLines: ["94%"] },
]

const NotificationsSkeleton: React.FC = () => (
  <DmView className="flex-1">
    {ROWS.map((row, i) => (
      <DmView key={i}>
        <DmView className="px-[16] py-[18]">
          <SkeletonLoader width={100} height={15} borderRadius={4} />
          <DmView className="mt-[5]">
            <SkeletonLoader width={row.title} height={16} borderRadius={4} />
          </DmView>
          {row.bodyLines.map((width, j) => (
            <DmView key={j} className={j === 0 ? "mt-[5]" : "mt-[2]"}>
              <SkeletonLoader width={width} height={15} borderRadius={4} />
            </DmView>
          ))}
        </DmView>
        <DmView className="h-[0.5] bg-grey19" />
      </DmView>
    ))}
  </DmView>
)

export default NotificationsSkeleton
