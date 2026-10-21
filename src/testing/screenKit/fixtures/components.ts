/**
 * Jest only. Props for the screen-local components a screen reaches only
 * through taps, by file under src, so the coverage sweep can draw them on
 * their own (screens.coverage.parity.tsx). A component's own parity test
 * harvests its real call sites instead (testing/harvest). Empty until a
 * sweep names one it can't draw without props.
 */
export const COMPONENT_PROPS: Record<string, Record<string, unknown>> = {}
