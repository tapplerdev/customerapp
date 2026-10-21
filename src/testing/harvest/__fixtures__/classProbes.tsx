/*
 * Jest only: the elements compiledClasses.tsx draws a class with. Here, in
 * __fixtures__, they don't count against the style ratchet.
 */
import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

/** The control: a class this file's own text holds, so NativeWind compiled it. */
export const ControlText = () => <DmText className="text-20">x</DmText>

/** One class token on a DmView, looked up at run time (drawn only if compiled). */
export const TokenView = ({ token }: { token: string }) => (
  <DmView className={token} />
)
