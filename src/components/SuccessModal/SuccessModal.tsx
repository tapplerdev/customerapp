import React from "react"
import { Modal } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import BigCheckIcon from "assets/icons/check-mark-big.svg"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  isVisible: boolean
  onClose: () => void
  title?: string
  descr?: string
}

const SuccessModal: React.FC<Props> = ({ isVisible, onClose, title, descr }) => {
  const { t } = useTranslation()

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <DmView
        style={[a.flex_1, a.items_center, a.justify_center, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        onPress={onClose}
      >
        <DmView
          style={[styles.box, a.py_30]}
          onPress={() => {}}
        >
          <DmView style={a.items_center}>
            <BigCheckIcon />
          </DmView>
          {title && (
            <Text size={20} weight="semibold" leading="tight" align="center" style={styles.text}>
              {title}
            </Text>
          )}
          {descr && (
            <Text size={13} weight="medium" leading={px(27)} align="center" style={styles.text2}>
              {descr}
            </Text>
          )}
          <Button
            size={px(41)}
            label="sm"
            style={[styles.button, a.w_full]}
            title={t("OK")}
            onPress={onClose}
          />
        </DmView>
      </DmView>
    </Modal>
  )
}

export default SuccessModal
