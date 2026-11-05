import React, { useState } from "react"
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
  // Fires once the pop-up has finished closing: where "close this, then
  // navigate" goes, never beside onClose (CLAUDE.local.md, Overlays).
  onModalHide?: () => void
}

const ErrorModal: React.FC<Props> = ({
  onClose,
  isVisible,
  title,
  descr,
  Icon,
  onModalHide,
}) => {
  const { t } = useTranslation()

  // Callers close this by clearing their message (isVisible={!!error},
  // onClose={() => setError(null)}), and the card keeps drawing through its
  // fade-out. So what it says is taken only while it is up, or the fade
  // shows the fallback ("An error occurred") for a moment (proapp's map,
  // 2026-10-15).
  const [shown, setShown] = useState({ title, descr })
  if (isVisible && (shown.title !== title || shown.descr !== descr)) {
    setShown({ title, descr })
  }

  return (
    <MainModal
      isVisible={isVisible}
      onClose={onClose}
      onModalHide={onModalHide}
      title={shown.title || t("error")}
      descr={shown.descr || t("an_error_occurred")}
      titleBtn={t("OK")}
      onPress={onClose}
      Icon={Icon || <CloseBigIcon />}
      cardStyle={[a.py_16, a.px_20]}
    />
  )
}

export default ErrorModal
