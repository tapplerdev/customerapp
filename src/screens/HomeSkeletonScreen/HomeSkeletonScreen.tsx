import React from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { DmView } from "@tappler/shared/src/components/UI"

import HomeHeader from "screens/dashboardScreens/HomeScreen/components/HomeHeader"
import SearchBar from "components/SearchBar"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"

const SkeletonSection: React.FC<{
  titleWidth: string
  descWidth: string
  children: React.ReactNode
}> = ({ titleWidth, descWidth, children }) => (
  <DmView className="mt-[24]">
    <DmView className="px-[16]">
      <SkeletonLoader width={titleWidth} height={20} borderRadius={6} />
      <DmView className="mt-[6]">
        <SkeletonLoader width={descWidth} height={13} borderRadius={6} />
      </DmView>
    </DmView>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      className="mt-[12]"
    >
      {children}
    </ScrollView>
  </DmView>
)

const HomeSkeletonScreen: React.FC = () => {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <HomeHeader />
      <SearchBar />
      <DmView className="h-[12]" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Section 1 — squareWithOverlay (100x110) */}
        <SkeletonSection titleWidth="50%" descWidth="70%">
          {[0, 1, 2, 3].map((i) => (
            <DmView key={i} className="mr-[10]">
              <SkeletonLoader width={100} height={110} borderRadius={10} />
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 2 — rectangleWithOverlay (210x120) */}
        <SkeletonSection titleWidth="40%" descWidth="55%">
          {[0, 1, 2].map((i) => (
            <DmView key={i} className="mr-[10]">
              <SkeletonLoader width={210} height={120} borderRadius={10} />
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 3 — doubleRectangles (168x63 stacked with title below each) */}
        <SkeletonSection titleWidth="45%" descWidth="65%">
          {[0, 1, 2].map((col) => (
            <DmView key={col} className="mr-[10]" style={{ width: 168 }}>
              <SkeletonLoader width={168} height={63} borderRadius={10} />
              <DmView className="mt-[6]">
                <SkeletonLoader width="60%" height={13} borderRadius={6} />
              </DmView>
              <DmView className="mt-[12]">
                <SkeletonLoader width={168} height={63} borderRadius={10} />
              </DmView>
              <DmView className="mt-[6]">
                <SkeletonLoader width="50%" height={13} borderRadius={6} />
              </DmView>
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 4 — rectangleWithText (150x90 with title below) */}
        <SkeletonSection titleWidth="55%" descWidth="60%">
          {[0, 1, 2].map((i) => (
            <DmView key={i} className="mr-[10]" style={{ width: 150 }}>
              <SkeletonLoader width={150} height={90} borderRadius={10} />
              <DmView className="mt-[6]">
                <SkeletonLoader width="55%" height={13} borderRadius={6} />
              </DmView>
            </DmView>
          ))}
        </SkeletonSection>
      </ScrollView>
    </SafeAreaView>
  )
}

export default HomeSkeletonScreen
