import React, { useRef, useState } from "react"
import { Dimensions, Modal, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
import { DmView } from "@tappler/shared/src/components/UI"

import CloseIcon from "assets/icons/close.svg"
import { AppFlatList } from "components/scroll"
import { a } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

interface Props {
  isVisible: boolean
  onClose: () => void
  images: { uri: string }[]
  initialIndex?: number
}

const ImageViewerModal: React.FC<Props> = ({
  isVisible,
  onClose,
  images,
  initialIndex = 0,
}) => {
  const insets = useSafeAreaInsets()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const handleScroll = (e: any) => {
    const offset = e.nativeEvent.contentOffset.x
    const index = Math.round(offset / SCREEN_WIDTH)
    setCurrentIndex(index)
  }

  const renderItem = ({ item }: { item: { uri: string } }) => (
    <DmView style={styles.imageContainer}>
      <FastImage
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode={FastImage.resizeMode.contain}
      />
    </DmView>
  )

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DmView style={[a.flex_1, dsStyles.list]}>
        {/* Close button */}
        <DmView
          onPress={onClose}
          style={[a.absolute, dsStyles.iconWrap, a.items_center, a.justify_center, { top: insets.top + 10, left: 16 }]}
        >
          <CloseIcon width={16} height={16} color="white" />
        </DmView>

        {/* Image carousel */}
        <AppFlatList
          data={images}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          keyExtractor={(_, index) => `image-${index}`}
        />

        {/* Page indicator */}
        {images.length > 1 && (
          <DmView
            style={[a.absolute, a.flex_row, a.items_center, a.justify_center, { bottom: insets.bottom + 20, left: 0, right: 0 }]}
          >
            {images.map((_, index) => (
              <DmView
                key={index}
                style={[dsStyles.container, 
                  styles.dot,
                  index === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </DmView>
        )}
      </DmView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "white",
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
})

export default ImageViewerModal
