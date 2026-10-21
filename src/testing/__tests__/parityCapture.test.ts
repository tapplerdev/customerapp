import { afterAll, describe, expect, it } from "@jest/globals"
import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

/*
 * What `yarn ds:parity:capture` stamps its cases with
 * (scripts/ds-parity-capture.js): HEAD when the captured code is HEAD's, and
 * `<HEAD>-dirty.<hash>` when anything but test material differs from it
 * (review, Low K: it stamped HEAD over any uncommitted change). Each test
 * gets a throwaway repository of its own.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const { isTestMaterial, stampOf } = require("../../../scripts/ds-parity-capture") as {
  isTestMaterial: (file: string) => boolean
  stampOf: (cwd: string) => { commit: string; dirty: string[] }
}

const repos = fs.mkdtempSync(path.join(os.tmpdir(), "parity-capture-"))
afterAll(() => {
  fs.rmSync(repos, { recursive: true, force: true })
})

let count = 0

/** A repository with a screen and its test committed; its HEAD and helpers. */
const freshRepo = () => {
  count += 1
  const repo = path.join(repos, `repo-${count}`)
  fs.mkdirSync(repo)
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=parity",
        "-c",
        "user.email=parity@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: repo, encoding: "utf8" }
    ).trim()
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    fs.writeFileSync(path.join(repo, file), text)
  }
  write("src/screens/Home/Home.tsx", "export default 1\n")
  write("src/screens/Home/__tests__/Home.parity.tsx", "// the old test\n")
  git("init", "-q")
  git("add", "-A")
  git("commit", "-q", "-m", "init")
  return { repo, write, head: git("rev-parse", "--short", "HEAD") }
}

describe("the stamp a capture writes", () => {
  it("is HEAD on a clean tree", () => {
    const { repo, head } = freshRepo()
    expect(stampOf(repo)).toEqual({ commit: head, dirty: [] })
  })

  it("stays HEAD while only test material differs (a new test, its fixture, a harvest's files)", () => {
    const { repo, write, head } = freshRepo()
    write("src/screens/Home/__tests__/Home.parity.tsx", "// the new test\n")
    write("src/screens/Home/__tests__/__parity__/Home.parity.json", "{}\n")
    write("src/components/Row/__fixtures__/Row.cases.json", "{}\n")
    write("src/components/Row/Row.test.tsx", "// a component test\n")
    expect(stampOf(repo)).toEqual({ commit: head, dirty: [] })
  })

  it("is HEAD-dirty with the changes' hash when the code differs, and names it", () => {
    const { repo, write, head } = freshRepo()
    write("src/screens/Home/Home.tsx", "export default 2\n")
    const once = stampOf(repo)
    expect(once.commit).toMatch(new RegExp(`^${head}-dirty\\.[0-9a-f]{10}$`))
    expect(once.dirty).toEqual([" M src/screens/Home/Home.tsx"])
    // the same change, the same stamp; another change, another
    expect(stampOf(repo)).toEqual(once)
    write("src/screens/Home/Home.tsx", "export default 3\n")
    expect(stampOf(repo).commit).not.toBe(once.commit)
    // and back to HEAD's code, HEAD again
    write("src/screens/Home/Home.tsx", "export default 1\n")
    expect(stampOf(repo).commit).toBe(head)
  })

  it("counts an untracked file of the code, by its contents", () => {
    const { repo, write } = freshRepo()
    write("src/screens/Home/styles.ts", "export const a = 1\n")
    const added = stampOf(repo)
    expect(added.dirty).toEqual(["?? src/screens/Home/styles.ts"])
    write("src/screens/Home/styles.ts", "export const a = 2\n")
    expect(stampOf(repo).commit).not.toBe(added.commit)
  })

  it("tells test material from code", () => {
    expect(
      [
        "src/screens/Home/__tests__/Home.parity.tsx",
        "src/testing/screenKit/__tests__/__parity__/x.json",
        "src/testing/screenKit/__fixtures__/ExampleScreen.tsx",
        "__tests__/App.parity.tsx",
        "scripts/__tests__/x.test.js",
      ].every(isTestMaterial)
    ).toBe(true)
    expect(
      [
        "src/screens/Home/Home.tsx",
        "src/testing/screenKit/setup.ts",
        "jest.parity.config.js",
        "../tappler-shared/src/ds/Button.tsx",
      ].some(isTestMaterial)
    ).toBe(false)
  })
})
