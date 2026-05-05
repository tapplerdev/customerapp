import React, { useEffect } from "react"

// Components
import Navigator from "navigation/Navigator"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useTypedSelector } from "store"

// Libs & Utils
import { I18nManager } from "react-native"

const BootstrapScreen = (): JSX.Element => {
  const { language } = useTypedSelector((store) => store.auth)
  const { i18n } = useTranslation()

  useEffect(() => {
    i18n.changeLanguage(language)
    I18nManager.forceRTL(language === "ar")
  }, [language])

  return <Navigator />
}

export default BootstrapScreen
