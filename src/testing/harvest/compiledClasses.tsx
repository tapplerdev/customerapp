/**
 * Jest only. The check that makes a class-name fixture valid: every class
 * the cases pass was compiled in this run, so the captured trees hold what
 * those classes draw in the app.
 *
 * NativeWind compiles a class only where it finds it in a .tsx file's text,
 * and draws an uncompiled one as nothing, without a word. A fixture whose
 * class strings live in JSON (harvested cases) therefore matched only while
 * some other loaded file happened to compile the same classes
 * (HeaderOnboarding's, until 2026-10-20). So, before any tree is compared:
 *
 * 1. control: a class this file writes draws (the pipeline is on);
 * 2. the classes file lists every class string the cases pass;
 * 3. each class token, on its own, draws exactly the style NativeWind's own
 *    resolver gives it (scripts/nw-resolve: nothing for a dropped class).
 *
 * Run it in the default jest config (`describeCompiledClasses` declares the
 * tests). Under the screen kit's config, call it in a file of its own: the
 * kit swaps module registries per platform.
 */
import { describe, expect, it } from "@jest/globals"
import React from "react"
import { StyleSheet } from "react-native"

import { hostTree } from "testing/hostTreeParity"

import { ControlText, TokenView } from "./__fixtures__/classProbes"
import type { CasesFile, HarvestFiles } from "./files"
import { unlistedClasses } from "./files"

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const nwResolve = require("../../../scripts/nw-resolve") as {
  resolve: (className: string) => { style: Record<string, unknown> }
}

/** Every class token in the strings, once, sorted. */
export const classTokens = (classStrings: readonly string[]) =>
  [...new Set(classStrings.flatMap((value) => value.split(/\s+/)))]
    .filter(Boolean)
    .sort()

/** What one token draws on a DmView right now (empty when it isn't compiled). */
export const drawnStyle = (token: string) => {
  const tree = hostTree(<TokenView token={token} />, { language: "en" })
  return (StyleSheet.flatten(tree?.props.style as never) ?? {}) as Record<
    string,
    unknown
  >
}

/** What NativeWind's own resolver says the token draws. */
export const resolvedStyle = (token: string) => nwResolve.resolve(token).style

/**
 * The tokens that draw something other than what they should: an
 * uncompiled class draws nothing where nw-resolve says it draws a style.
 */
export const uncompiledTokens = (classStrings: readonly string[]) =>
  classTokens(classStrings).filter(
    (token) =>
      JSON.stringify(drawnStyle(token)) !== JSON.stringify(resolvedStyle(token))
  )

/**
 * Declares the three checks (control, the list, every token) for a harvested
 * fixture's class strings. Cases that pass no class string at all (a
 * component no call site hands a class) get the control and the list only:
 * there is no token to check, and jest refuses an empty `it.each` table.
 */
export const describeCompiledClasses = (
  cases: CasesFile,
  files: HarvestFiles,
  classStrings: readonly string[]
) => {
  const tokens = classTokens(classStrings)
  describe("the harvested class strings are compiled", () => {
    it("control: NativeWind compiles a class this file writes", () => {
      const tree = hostTree(<ControlText />, { language: "en" })
      expect(tree?.props.style).toMatchObject({ fontSize: 20 })
    })

    it("the classes file lists every class string the cases pass", () => {
      expect(unlistedClasses(files, cases)).toEqual([])
    })

    if (tokens.length > 0) {
      it.each(tokens)("%s draws what NativeWind gives it", (token) => {
        expect(drawnStyle(token)).toEqual(resolvedStyle(token))
      })
    }
  })
}
