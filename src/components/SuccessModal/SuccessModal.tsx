import React from "react"
import { Modal } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import BigCheckIcon from "assets/icons/check-mark-big.svg"

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
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={onClose}
      >
        <DmView
          className="bg-white rounded-12 mx-[19] px-[39] pt-[30] pb-[30] self-stretch"
          onPress={() => {}}
        >
          <DmView className="items-center">
            <BigCheckIcon />
          </DmView>
          {title && (
            <DmText className="mt-[11] text-20 leading-[24px] font-custom600 text-center">
              {title}
            </DmText>
          )}
          {descr && (
            <DmText className="mt-[7] text-13 leading-[27px] font-custom500 text-center">
              {descr}
            </DmText>
          )}
          <ActionBtn
            className="mt-[17] h-[41] w-full"
            title={t("OK")}
            onPress={onClose}
            textClassName="text-13 leading-[16px]"
          />
        </DmView>
      </DmView>
    </Modal>
  )
}

export default SuccessModal
