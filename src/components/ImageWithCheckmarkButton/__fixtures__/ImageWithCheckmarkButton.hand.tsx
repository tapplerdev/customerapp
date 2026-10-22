import type { HarvestedCase } from "testing/harvest"

/*
 * By hand: QuestionComponent passes no class (the twelve dead ones went in
 * W1's prep), so no harvested case draws the answer's `className`, the one
 * W2's callers may still hand it. These do, on the answer selected and not.
 * A .tsx so NativeWind compiles the classes written here.
 */
export const HAND_CLASSES = [
  "mt-[8]",
  "ml-[10] mr-[4]",
  "self-start w-[160] bg-grey5",
] as const

export const HAND: Record<string, HarvestedCase> = Object.fromEntries(
  HAND_CLASSES.flatMap((className) =>
    [false, true].map((isSelected) => [
      `hand class ${className}, ${isSelected ? "selected" : "not selected"}`,
      {
        props: {
          label: "t:answer",
          imageUrl: { $opaque: "opt.icon" },
          isSelected,
          onPress: { $fn: true },
          className,
        },
        sites: ["by hand"],
      } as HarvestedCase,
    ])
  )
)
