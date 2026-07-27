import React, { useEffect } from "react"

// Components
import Navigator from "navigation/Navigator"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import { sweepStaleCarts } from "store/cart/slice"

// Libs & Utils
import { I18nManager } from "react-native"

const BootstrapScreen = (): JSX.Element => {
  const { language } = useTypedSelector((state) => state.auth)
  const { i18n } = useTranslation()
  const dispatch = useDispatch()

  useEffect(() => {
    i18n.changeLanguage(language)
    I18nManager.forceRTL(language === "ar")
  }, [language])

  // Drop abandoned food drafts on launch (lazy TTL — MMKV has no expiry of its
  // own). Runs once; PersistGate guarantees the cart is rehydrated by now.
  useEffect(() => {
    dispatch(sweepStaleCarts(Date.now()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Navigator />
}

export default BootstrapScreen
