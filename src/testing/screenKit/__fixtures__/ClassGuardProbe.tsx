/*
 * Jest only, for classGuard.parity.tsx: screens that hand an element a
 * class, or render DmText or ActionBtn, each one way a class can still
 * arrive without NativeWind to draw it, and screens that don't, through
 * tappler-shared's components, which still take a class (customerapp's calls
 * of them gave theirs up in W3.3) and hand it on as `className={undefined}`
 * (DmView, DmInput, SkeletonLoader) when a caller gives none. The class
 * strings here are the point: this file is under __fixtures__, which the
 * style ratchet skips.
 */
import React from "react"
import { View } from "react-native"

import {
  ActionBtn,
  DmInput,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import SkeletonLoader from "@tappler/shared/src/components/SkeletonLoader"
import { Button, Text } from "@tappler/shared/src/ds"
import AppSkeletonLoader from "components/SkeletonLoader/SkeletonLoader"

// Props a type can't see: a class arriving the way an untyped caller, a
// spread or a props object would hand it.
const untyped = (props: Record<string, unknown>) => props as object
const AnyView = View as unknown as React.ComponentType<Record<string, unknown>>

/** Draws nothing the guard refuses: shared components given no class. */
export const Clean = () => (
  <DmView style={{ padding: 4 }}>
    <Text size={14}>Clean</Text>
    <DmInput value="" onChangeText={() => undefined} placeholder="Name" />
    <SkeletonLoader style={{ width: 20, height: 20 }} />
    <AppSkeletonLoader width={20} height={20} style={{ marginTop: 4 }} />
    <Button title="Go" onPress={() => undefined} />
    {/* an empty class and an undefined one draw nothing either way */}
    <AnyView className="" titleClassName={undefined} />
  </DmView>
)

/** A class on a shared component whose types still take one (for customerapp). */
export const ClassOnDmView = () => (
  <DmView>
    <DmView className="mt-[4]" />
  </DmView>
)

export const RendersDmText = () => (
  <DmView>
    <DmText>Hello</DmText>
  </DmView>
)

export const RendersActionBtn = () => (
  <DmView>
    <ActionBtn title="Go" onPress={() => undefined} />
  </DmView>
)

/** A class in a props object, through React.createElement. */
export const ClassThroughCreateElement = () =>
  React.createElement(AnyView, { className: "flex-1 bg-white" })

/** NativeWind's other class prop. */
export const TwThroughCreateElement = () =>
  React.createElement(AnyView, { tw: "mt-2" })

/** A class added to an element by React.cloneElement. */
export const ClassThroughClone = () =>
  React.cloneElement(<View />, untyped({ className: "px-[16]" }))

/** A class in a spread, onto one of customerapp's own components. */
export const ClassThroughSpread = () => (
  <AppSkeletonLoader
    width={20}
    height={20}
    {...untyped({ titleClassName: "text-15" })}
  />
)

class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    const { failed } = this.state
    const { children } = this.props
    return failed ? <Text size={14}>Something went wrong</Text> : children
  }
}

/** A class three components down: the refusal names them all. */
const Leaf = () => <DmView className="mt-[8]" />
const Branch = () => <Leaf />
export const NestedClass = () => <Branch />

/** A refusal an error boundary catches: the screen draws its fallback. */
export const Swallowed = () => (
  <Boundary>
    <ClassOnDmView />
  </Boundary>
)

/** A class that isn't a string, which only the tree check sees. */
export const ArrayClass = () =>
  React.createElement(AnyView, { className: ["mt-[4]"] })
