/*
 * Hand-written cases for PromoLine's parity tests: the classes a caller could
 * still pass (no call site does now). They live in a .tsx file, imported by
 * the tests, so that NativeWind compiles them.
 */
export const HAND_CASES: {
  name: string
  props: { promoMessage: string; className: string }
}[] = [
  {
    name: "class mt-[6]",
    props: { promoMessage: "{promo}", className: "mt-[6]" },
  },
  {
    name: "class mx-[10] mb-[8]",
    props: { promoMessage: "{promo}", className: "mx-[10] mb-[8]" },
  },
]
