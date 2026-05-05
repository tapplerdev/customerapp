import React, { useRef, useState } from "react"
import { Dimensions, FlatList, Modal, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import FastImage from "react-native-fast-image"
import { DmView } from "@tappler/shared/src/components/UI"

import CloseIcon from "assets/icons/close.svg"

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
      <DmView className="flex-1 bg-black">
        {/* Close button */}
        <DmView
          onPress={onClose}
          className="absolute z-10 w-[40] h-[40] rounded-full bg-white/20 items-center justify-center"
          style={{ top: insets.top + 10, left: 16 }}
        >
          <CloseIcon width={16} height={16} color="white" />
        </DmView>

        {/* Image carousel */}
        <FlatList
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
            className="absolute flex-row items-center justify-center"
            style={{ bottom: insets.bottom + 20, left: 0, right: 0 }}
          >
            {images.map((_, index) => (
              <DmView
                key={index}
                className="mx-[3]"
                style={[
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
