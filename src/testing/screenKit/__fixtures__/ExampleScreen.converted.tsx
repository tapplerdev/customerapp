/*
 * Jest only: ExampleScreen as wave 2 converts it (workflow.parity.tsx): no
 * class names, ds Text and Button, styles from tokens. It draws the same
 * host tree, with Button's two listed deltas.
 */
import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Button, Text, px } from "@tappler/shared/src/ds"
import colors from "@tappler/shared/src/styles/colors"
import { useTypedSelector } from "store"
import { useGetChatsQuery } from "services/api"

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    backgroundColor: colors.white,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 20,
  },
  count: { marginTop: 4 },
  button: { marginTop: 24 },
})

const ExampleScreenConverted = () => {
  const { t } = useTranslation()
  const user = useTypedSelector((state) => state.auth.user)
  const { data, isLoading } = useGetChatsQuery()
  return (
    <View style={styles.screen}>
      <Text size={15} weight="semibold" leading={px(19)}>
        {user?.firstName}
      </Text>
      <Text
        size={13}
        weight="regular"
        leading={px(16)}
        color="disabledButton"
        style={styles.count}
      >
        {isLoading ? "…" : `${t("messages")}: ${data?.data.length ?? 0}`}
      </Text>
      <Button
        title={t("messages")}
        onPress={() => undefined}
        style={styles.button}
      />
    </View>
  )
}

export default ExampleScreenConverted
