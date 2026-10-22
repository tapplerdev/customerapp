/*
 * Hand-written cases for SkeletonLoader's parity tests: the classes a caller
 * could still pass (no call site does now). They live in a .tsx file,
 * imported by the tests, so that NativeWind compiles them.
 */
export const HAND_CASES: {
  name: string
  props: {
    width: number
    height: number
    borderRadius: number
    className: string
  }
}[] = [
  {
    name: "class mt-[6]",
    props: { width: 130, height: 16, borderRadius: 4, className: "mt-[6]" },
  },
  {
    name: "class flex-1",
    props: { width: 130, height: 16, borderRadius: 4, className: "flex-1" },
  },
  {
    name: "class mx-[10] mb-[8]",
    props: {
      width: 130,
      height: 16,
      borderRadius: 4,
      className: "mx-[10] mb-[8]",
    },
  },
]
