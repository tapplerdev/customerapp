import React from "react"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"

import CloseBigIcon from "assets/icons/cancel-big.svg"
import { a } from "@tappler/shared/src/ds"

interface Props {
  isVisible: boolean
  onClose: () => void
  title?: string
  descr?: string
  Icon?: React.ReactNode
}

const ErrorModal: React.FC<Props> = ({ onClose, isVisible, title, descr, Icon }) => {
  const { t } = useTranslation()

  return (
    <MainModal
      isVisible={isVisible}
      onClose={onClose}
      title={title || t("error")}
      descr={descr || t("an_error_occurred")}
      titleBtn={t("OK")}
      onPress={onClose}
      Icon={Icon || <CloseBigIcon />}
      cardStyle={[a.py_16, a.px_20]}
    />
  )
}

export default ErrorModal
