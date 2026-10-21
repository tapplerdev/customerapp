/*
 * Jest only, for screenKit.parity.tsx: a card closed and, once it is gone,
 * the next one opened (MainModal's onModalHide), as My Account's password
 * cards do; and a plain Modal that counts its onDismiss.
 */
import React, { useState } from "react"
import { Modal, Text, View } from "react-native"

import MainModal from "@tappler/shared/src/components/MainModal"

const ModalProbe = () => {
  const [first, setFirst] = useState(true)
  const [second, setSecond] = useState(false)
  const [plain, setPlain] = useState(true)
  const [dismissed, setDismissed] = useState(0)
  return (
    <View>
      <Text testID="close-first" onPress={() => setFirst(false)}>
        close first
      </Text>
      <Text testID="close-plain" onPress={() => setPlain(false)}>
        close plain
      </Text>
      <Text testID="dismissed">{`dismissed ${dismissed}`}</Text>
      <MainModal
        isVisible={first}
        onClose={() => setFirst(false)}
        onModalHide={() => setSecond(true)}
        title="First card"
      />
      <MainModal
        isVisible={second}
        onClose={() => setSecond(false)}
        title="Second card"
      />
      <Modal
        visible={plain}
        transparent
        onDismiss={() => setDismissed((count) => count + 1)}
      >
        <Text>plain modal</Text>
      </Modal>
    </View>
  )
}

export default ModalProbe
