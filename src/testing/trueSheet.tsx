/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   built inside a jest.mock factory (jest.setup.js), which runs when the
   library is first asked for, in whichever module registry asks. */
/**
 * Jest only. `@lodev09/react-native-true-sheet`'s TrueSheet as the jest kit
 * draws it, in place of the library's own mock (both jest configs register
 * it, jest.setup.js).
 *
 * The library's mock draws the header, children and footer into a plain
 * View whether the sheet is open or not, and hands that View only `style`:
 * an open sheet, a closed one and one whose detents, colour or corner radius
 * changed all drew the same tree (proapp's B2, B3, B5, B6 and B7 reviews).
 * This stand-in draws what the real component hands its native views
 * (TrueSheet.tsx in the library, 4.0.0-beta.16):
 *
 *   <TrueSheet  every prop but children/header/footer and their styles,
 *               plus `presented` and `detentIndex`, the state the kit records>
 *     while the content is mounted:
 *     <TrueSheetHeader style={headerStyle}>{header}</TrueSheetHeader>
 *     <TrueSheetContent style={style}>{children}</TrueSheetContent>
 *     <TrueSheetFooter style={footerStyle}>{footer}</TrueSheetFooter>
 *
 * The content is lazy, as the library's is: mounted from present() until the
 * sheet is dismissed (from the start with `lazy={false}` or an
 * `initialDetentIndex` of 0 or more, and kept after a dismissal with
 * `lazy={false}`). So a closed sheet's tree is its host alone, and a row that
 * opens it differs from one that doesn't.
 *
 * The imperative API answers as a device does, at once: present(index)
 * mounts and presents (onWillPresent, onDidPresent), dismiss() reports
 * onWillDismiss and onDidDismiss before its promise settles (shared's
 * NativeSheet tells its own closes from the user's by that order), resize()
 * moves the detent (onDetentChange). Each is a jest.fn on the instance (the
 * ref a caller holds), and the statics act on the sheet registered under
 * `name`, as the library's do. A user's swipe or backdrop tap is
 * `userDismiss(instance)` (testing/screenKit's `closeSheetAsUser`): the same
 * two events with nobody's dismiss() behind them.
 */
import { jest } from "@jest/globals"
import type React from "react"

type Props = Record<string, unknown> & {
  children?: React.ReactNode
  name?: string
  detents?: unknown[]
  lazy?: boolean
  initialDetentIndex?: number
  header?: React.ReactNode | React.ComponentType
  footer?: React.ReactNode | React.ComponentType
  headerStyle?: unknown
  footerStyle?: unknown
  style?: unknown
}

type State = {
  /** The content is mounted (the library's shouldRenderNativeView). */
  mounted: boolean
  presented: boolean
  /** The detent the sheet sits at, -1 while it isn't presented. */
  index: number
}

type Handler = ((event: unknown) => void) | undefined

/** What a TrueSheet instance looks like from a test. */
export type TrueSheetStandIn = React.Component<Props, State> & {
  present: (index?: number, animated?: boolean) => Promise<void>
  dismiss: (animated?: boolean) => Promise<void>
  dismissStack: (animated?: boolean) => Promise<void>
  resize: (index: number) => Promise<void>
}

/** The sheet closed by the user (a swipe, the backdrop): its two events, no dismiss() call. */
export const userDismiss = (sheet: TrueSheetStandIn) =>
  (sheet as unknown as { screenKitUserDismiss: () => void }).screenKitUserDismiss()

export const trueSheet = () => {
  const R = require("react") as typeof React

  const element = (value: unknown) => {
    if (!value) return null
    if (R.isValidElement(value)) return value
    return R.createElement(value as React.ComponentType)
  }

  class TrueSheet extends R.Component<Props, State> {
    static displayName = "TrueSheet"

    static instances: Record<string, TrueSheet> = {}

    static byName(name: string) {
      const sheet = TrueSheet.instances[name]
      if (!sheet) {
        throw new Error(`TrueSheet stand-in: no sheet named "${name}" is mounted`)
      }
      return sheet
    }

    static present = jest.fn((name: string, index?: number, animated?: boolean) =>
      TrueSheet.byName(name).present(index, animated)
    )

    static dismiss = jest.fn((name: string, animated?: boolean) =>
      TrueSheet.byName(name).dismiss(animated)
    )

    static dismissStack = jest.fn((name: string, animated?: boolean) =>
      TrueSheet.byName(name).dismissStack(animated)
    )

    static resize = jest.fn((name: string, index: number) =>
      TrueSheet.byName(name).resize(index)
    )

    static dismissAll = jest.fn(async (animated?: boolean) => {
      await Promise.all(
        Object.values(TrueSheet.instances).map((sheet) =>
          sheet.dismiss(animated)
        )
      )
    })

    constructor(props: Props) {
      super(props)
      const auto =
        props.initialDetentIndex !== undefined && props.initialDetentIndex >= 0
      this.state = {
        mounted: auto || props.lazy === false,
        presented: auto,
        index: auto ? (props.initialDetentIndex as number) : -1,
      }
    }

    componentDidMount() {
      const { name } = this.props
      if (name) TrueSheet.instances[name] = this
    }

    componentWillUnmount() {
      const { name } = this.props
      if (name && TrueSheet.instances[name] === this) {
        delete TrueSheet.instances[name]
      }
    }

    private event(index: number) {
      const detents = this.props.detents ?? [0.5, 1]
      return {
        nativeEvent: { index, position: 0, detent: detents[index] ?? null },
      }
    }

    private fire(prop: string, event: unknown) {
      ;(this.props[prop] as Handler)?.(event)
    }

    private close() {
      this.fire("onWillDismiss", this.event(this.state.index))
      this.setState({
        mounted: this.props.lazy === false,
        presented: false,
        index: -1,
      })
      this.fire("onDidDismiss", this.event(-1))
    }

    present = jest.fn(async (index: number = 0, _animated?: boolean) => {
      const count = Math.min(this.props.detents?.length ?? 2, 3)
      if (index < 0 || index >= count) {
        throw new Error(
          `TrueSheet: present index (${index}) is out of bounds. detents array has ${count} item(s)`
        )
      }
      this.fire("onWillPresent", this.event(index))
      this.setState({ mounted: true, presented: true, index })
      this.fire("onDidPresent", this.event(index))
    })

    dismiss = jest.fn(async (_animated?: boolean) => {
      // Native answers a sheet that isn't up with nothing at all.
      if (!this.state.presented) return
      this.close()
    })

    // Nothing is ever stacked on a stand-in sheet.
    dismissStack = jest.fn(async (_animated?: boolean) => undefined)

    resize = jest.fn(async (index: number) => {
      this.setState({ index })
      this.fire("onDetentChange", this.event(index))
    })

    /** What userDismiss() calls: the native dismissal, nobody's dismiss() behind it. */
    screenKitUserDismiss = () => {
      if (!this.state.presented) {
        throw new Error("TrueSheet stand-in: the sheet isn't presented, so the user can't close it")
      }
      this.close()
    }

    render() {
      const {
        children,
        header,
        footer,
        headerStyle,
        footerStyle,
        style,
        lazy: _lazy,
        ...rest
      } = this.props
      const { mounted, presented, index } = this.state
      return R.createElement(
        "TrueSheet",
        { ...rest, presented, detentIndex: index },
        mounted
          ? [
              header
                ? R.createElement(
                    "TrueSheetHeader",
                    { key: "header", style: headerStyle },
                    element(header)
                  )
                : null,
              R.createElement(
                "TrueSheetContent",
                { key: "content", style },
                children
              ),
              footer
                ? R.createElement(
                    "TrueSheetFooter",
                    { key: "footer", style: footerStyle },
                    element(footer)
                  )
                : null,
            ]
          : null
      )
    }
  }

  const passthrough = (name: string) => {
    const View = (props: Props) =>
      R.createElement(name, props, props.children as React.ReactNode)
    View.displayName = name
    return View
  }

  const TrueSheetProvider = ({ children }: { children?: React.ReactNode }) =>
    R.createElement(R.Fragment, null, children)

  return {
    __esModule: true,
    TrueSheet,
    TrueSheetPeek: passthrough("TrueSheetPeek"),
    TrueSheetOverlay: passthrough("TrueSheetOverlay"),
    TrueSheetProvider,
    useTrueSheet: () => ({
      present: TrueSheet.present,
      dismiss: TrueSheet.dismiss,
      dismissStack: TrueSheet.dismissStack,
      resize: TrueSheet.resize,
      dismissAll: TrueSheet.dismissAll,
    }),
  }
}
