import React, { useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  View,
} from "react-native"
import { WebView } from "react-native-webview"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

import CloseIcon from "assets/icons/close.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  uri: string
  fileName: string
}

const DocumentViewerModal: React.FC<Props> = ({
  isVisible,
  onClose,
  uri,
  fileName,
}) => {
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(true)

  const pdfSource = Platform.OS === "android"
    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}` }
    : { uri }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <DmView
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={HIT_SLOP_DEFAULT}
          >
            <CloseIcon width={16} height={16} color="white" />
          </DmView>
          <DmText
            className="text-14 leading-[18px] font-custom600 text-white flex-1"
            numberOfLines={1}
            style={{ textAlign: "center", marginRight: 40 }}
          >
            {fileName}
          </DmText>
        </View>

        {/* WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            source={pdfSource}
            style={styles.webview}
            onLoadEnd={() => setIsLoading(false)}
            scalesPageToFit
            startInLoadingState={false}
          />
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000080",
    alignItems: "center",
    justifyContent: "center",
  },
})

export default DocumentViewerModal
