/*
 * nw-wrap-probe fixture: tags whose component is only known by following
 * every assignment, and imports through bare specifiers. Never imported by
 * the app; the probe test transforms it as if it lived in src/.
 */
import React from "react"
import { Text, View } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
// Bare specifiers that resolve to no installed package.
import { ActionBtn as BareActionBtn } from "tappler-ui-kit"
import BareCard from "tappler-ui-kit/Card"

const pick = (big) => (big ? View : Text)

// BUG: DmView, then maybe DmText.
export const ReassignedLater = ({ big }) => {
  let Label = DmView
  if (big) Label = DmText
  return <Label className="text-14">x</Label>
}

// BUG: no init, View in one branch and DmText in the other.
export const AssignedInBranches = ({ big }) => {
  let Label
  if (big) Label = View
  else Label = DmText
  return <Label className="text-14">x</Label>
}

// review: an assignment the probe can't read is never "ok".
export const AssignedFromACall = ({ big }) => {
  let Label = DmView
  Label = pick(big)
  return <Label className="mt-[4]">x</Label>
}

// ok: every value it can hold is a react-native component.
export const BothNative = ({ big }) => {
  let Label = View
  if (big) Label = Text
  return <Label className="mt-[4]">x</Label>
}

// BUG: a known consumer, even though the import is a bare specifier.
export const ConsumerViaBareImport = () => (
  <BareActionBtn className="h-[47] rounded-5" />
)

// review: a bare specifier that doesn't resolve into node_modules.
export const UnknownViaBareImport = () => <BareCard className="p-[12]" />
