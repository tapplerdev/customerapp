import React from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { DmView } from "@tappler/shared/src/components/UI"

import HomeHeader from "screens/dashboardScreens/HomeScreen/components/HomeHeader"
import SearchBar from "components/SearchBar"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import { AppScrollView } from "components/scroll"
import { a } from "@tappler/shared/src/ds"
import styles from "./styles"

const SkeletonSection: React.FC<{
  titleWidth: string
  descWidth: string
  children: React.ReactNode
}> = ({ titleWidth, descWidth, children }) => (
  <DmView style={a.mt_24}>
    <DmView style={a.px_16}>
      <SkeletonLoader width={titleWidth} height={20} borderRadius={6} />
      <DmView style={a.mt_6}>
        <SkeletonLoader width={descWidth} height={13} borderRadius={6} />
      </DmView>
    </DmView>
    <AppScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={a.mt_12}
    >
      {children}
    </AppScrollView>
  </DmView>
)

const HomeSkeletonScreen: React.FC = () => {
  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      <HomeHeader />
      <SearchBar />
      <DmView style={styles.box} />

      <AppScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Section 1 — squareWithOverlay (100x110) */}
        <SkeletonSection titleWidth="50%" descWidth="70%">
          {[0, 1, 2, 3].map((i) => (
            <DmView key={i} style={a.mr_10}>
              <SkeletonLoader width={100} height={110} borderRadius={10} />
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 2 — rectangleWithOverlay (210x120) */}
        <SkeletonSection titleWidth="40%" descWidth="55%">
          {[0, 1, 2].map((i) => (
            <DmView key={i} style={a.mr_10}>
              <SkeletonLoader width={210} height={120} borderRadius={10} />
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 3 — doubleRectangles (168x63 stacked with title below each) */}
        <SkeletonSection titleWidth="45%" descWidth="65%">
          {[0, 1, 2].map((col) => (
            <DmView key={col} style={[a.mr_10, { width: 168 }]}>
              <SkeletonLoader width={168} height={63} borderRadius={10} />
              <DmView style={a.mt_6}>
                <SkeletonLoader width="60%" height={13} borderRadius={6} />
              </DmView>
              <DmView style={a.mt_12}>
                <SkeletonLoader width={168} height={63} borderRadius={10} />
              </DmView>
              <DmView style={a.mt_6}>
                <SkeletonLoader width="50%" height={13} borderRadius={6} />
              </DmView>
            </DmView>
          ))}
        </SkeletonSection>

        {/* Section 4 — rectangleWithText (150x90 with title below) */}
        <SkeletonSection titleWidth="55%" descWidth="60%">
          {[0, 1, 2].map((i) => (
            <DmView key={i} style={[a.mr_10, { width: 150 }]}>
              <SkeletonLoader width={150} height={90} borderRadius={10} />
              <DmView style={a.mt_6}>
                <SkeletonLoader width="55%" height={13} borderRadius={6} />
              </DmView>
            </DmView>
          ))}
        </SkeletonSection>
      </AppScrollView>
    </SafeAreaView>
  )
}

export default HomeSkeletonScreen
