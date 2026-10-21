// Names already taken in a file: React Native's Text, a local `a` and a local
// `styles` push the codemod to DsText, `atoms` and a free StyleSheet name.
import React from "react"
import { Text } from "react-native"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

const styles = { note: "not a StyleSheet" }

type Props = { items: string[] }

const NameCases: React.FC<Props> = ({ items }) => (
  <DmView className="px-[20] mt-[10] bg-grey52">
    <Text>{styles.note}</Text>
    {items.map((a) => (
      <DmText key={a} className="text-13 leading-[16px] font-custom500 mb-[6]">
        {a}
      </DmText>
    ))}
  </DmView>
)

export default NameCases

export const cases = [{ name: "two items", props: { items: ["one", "two"] } }]

export const expected = {
  converted: 2,
  left: {},
  dropped: [],
  removedImports: ["DmText"],
}
