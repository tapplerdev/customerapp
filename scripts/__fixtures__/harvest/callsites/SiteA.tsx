/*
 * Jest only: call sites for harvest.test.tsx. Each line's shape is pinned
 * there by its line number.
 */
import React from "react"
declare function clsx(...args: unknown[]): string
import { Text } from "react-native"
import Widget from "./Widget"

const t = (key: string) => key
const CloseIcon = (_props: { width: number }) => null

export const SiteA = ({
  isValid,
  isDark,
  name,
  item,
}: {
  isValid: boolean
  isDark: boolean
  name: string
  item: { id: number }
}) => (
  <>
    <Widget title="Hello" className="mt-[4]" />
    <Widget
      title={t("save")}
      disabled={!isValid}
      className={clsx("px-[16]", !isValid && "opacity-50")}
      onPress={() => undefined}
    />
    <Widget
      title={name}
      icon={<CloseIcon width={16} />}
      variant={isDark ? "dark" : "light"}
    />
    <Widget title="Children">
      {t("child_text")}
      <Text>inner</Text>
    </Widget>
    <Widget title="Rows" item={item} />
  </>
)
