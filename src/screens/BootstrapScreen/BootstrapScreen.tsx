import React, { useEffect, useRef } from "react"

// Components
import Navigator from "navigation/Navigator"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import { sweepStaleCarts } from "store/cart/slice"
import { useGetCustomerMeQuery, useUpdateCustomerMutation } from "services/api"

// Libs & Utils
import { I18nManager } from "react-native"

const BootstrapScreen = (): JSX.Element => {
  const { language, isAuth } = useTypedSelector((state) => state.auth)
  const { i18n } = useTranslation()
  const dispatch = useDispatch()

  useEffect(() => {
    i18n.changeLanguage(language)
    I18nManager.forceRTL(language === "ar")
  }, [language])

  // Tell the backend which language to write notifications in. Push bodies are
  // built server-side and cannot be translated on arrival, so the app running
  // in English is not enough on its own — before this existed, every customer
  // notification resolved Arabic no matter what the app was set to.
  //
  // Driven off the server's own value rather than a local "last reported" flag,
  // so it only writes on a real mismatch and still corrects itself if the two
  // ever drift apart. updateCustomer invalidates Auth, which refetches this
  // query — by then the values agree, so it settles rather than looping.
  const { data: customer } = useGetCustomerMeQuery(undefined, { skip: !isAuth })
  const [updateCustomer] = useUpdateCustomerMutation()
  // The language this session has already tried to report. A backend that
  // rejects the field — one deployed without it answers 400, since the global
  // pipe forbids non-whitelisted properties — must not be asked again and
  // again: the query object identity changes on every refetch, so without this
  // a permanent failure retries as fast as the round trip allows. Cleared when
  // the language actually changes, so a real toggle is always sent.
  const attemptedLanguage = useRef<string | null>(null)

  useEffect(() => {
    attemptedLanguage.current = null
  }, [language])

  useEffect(() => {
    if (!isAuth || !customer) return
    if (customer.preferredLanguage === language) return
    if (attemptedLanguage.current === language) return
    attemptedLanguage.current = language
    updateCustomer({ preferredLanguage: language })
      .unwrap()
      // Costs the customer nothing today — notifications stay in whatever
      // language the backend already had — and the next launch or language
      // change retries. Not worth surfacing.
      .catch(() => {})
  }, [isAuth, customer, language, updateCustomer])

  // Drop abandoned food drafts on launch (lazy TTL — MMKV has no expiry of its
  // own). Runs once; PersistGate guarantees the cart is rehydrated by now.
  useEffect(() => {
    dispatch(sweepStaleCarts(Date.now()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Navigator />
}

export default BootstrapScreen
