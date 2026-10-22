/*
 * Hand-written cases for TextWithCheckmarkButton's parity tests: the classes a
 * caller could still pass (no call site does now). They live in a .tsx file,
 * imported by the tests, so that NativeWind compiles them (classes in a plain
 * JSON or in a test's own text draw nothing).
 */
export const HAND_CASES: {
  name: string
  props: { label: string; isSelected: boolean; className: string }
}[] = [
  {
    name: "class mt-[6]",
    props: { label: "Satin", isSelected: false, className: "mt-[6]" },
  },
  {
    name: "class mr-[8] picked",
    props: { label: "Satin", isSelected: true, className: "mr-[8]" },
  },
  // Its own bg-white / self-start against a caller's: the caller's comes
  // last and wins.
  {
    name: "class bg-red over bg-white",
    props: { label: "Satin", isSelected: false, className: "bg-red" },
  },
  {
    name: "class self-stretch over self-start",
    props: { label: "Satin", isSelected: false, className: "self-stretch" },
  },
]
