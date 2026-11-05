#!/usr/bin/env node
/**
 * yarn lint:ratchet [--update]
 *
 * The ratchet for the warnings in scripts/lint-ratchet-rules.js (dsColors
 * imports, colour literals in .tsx), and the bans held at 0 there (an Alert
 * import outside its two helpers). Lints src with .eslintrc.js, counts
 * those, and
 * compares the counts with scripts/lint-ratchet-baseline.json:
 *
 * - a count above its baseline fails: fix the new one (`npx eslint <file>`
 *   on the files you changed shows where);
 * - a count below its baseline fails too, so the gain is locked in: run
 *   `yarn lint:ratchet --update` and commit the baseline with the fix;
 * - --update writes the current counts, and refuses to raise any.
 *
 * CI runs it on every PR (.github/workflows/lint-ratchet.yml).
 */
const fs = require("fs")
const path = require("path")
const { ESLint } = require("eslint")
const { banned, ratcheted } = require("./lint-ratchet-rules")

const ROOT = path.resolve(__dirname, "..")
const BASELINE = path.join(__dirname, "lint-ratchet-baseline.json")
const ABOUT =
  "Counts of the ratcheted lint warnings in src (yarn lint:ratchet). Each " +
  "may only go down. Written with --update."

const KEY_OF = new Map(ratcheted.map(({ message, key }) => [message, key]))
const KEYS = [...new Set([...ratcheted, ...banned].map(({ key }) => key))]

// A ban's error, by its message (ESLint puts its own words in front:
// "'Alert' import from 'react-native' is restricted ... <message>").
const bannedKeyOf = (message) =>
  banned.find((ban) => message.includes(ban.message))?.key

const countWarnings = async () => {
  const results = await new ESLint({ cwd: ROOT }).lintFiles(["src"])
  const counts = Object.fromEntries(KEYS.map((key) => [key, 0]))

  results.forEach(({ messages }) =>
    messages.forEach(({ ruleId, message }) => {
      const key =
        ruleId === "no-restricted-syntax"
          ? KEY_OF.get(message)
          : bannedKeyOf(message)
      if (key) counts[key] += 1
    })
  )

  return counts
}

const readBaseline = () =>
  fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, "utf8")).counts
    : null

const compare = (baseline, counts) =>
  KEYS.flatMap((key) => {
    const was = baseline[key] ?? 0
    const now = counts[key]

    if (now > was) {
      return [`${key}: ${now}, up from ${was}. Fix the new one.`]
    }
    if (now < was) {
      return [
        `${key}: ${now}, down from ${was}. Run \`yarn lint:ratchet --update\` ` +
          "and commit the baseline to lock it in.",
      ]
    }
    return []
  })

const main = async () => {
  const update = process.argv.includes("--update")
  const baseline = readBaseline()
  const counts = await countWarnings()

  if (update) {
    const rises = baseline
      ? KEYS.filter((key) => counts[key] > (baseline[key] ?? 0))
      : []

    if (rises.length > 0) {
      console.error(
        `lint-ratchet: not written, these went up: ${rises
          .map((key) => `${key} ${baseline[key] ?? 0} -> ${counts[key]}`)
          .join(", ")}`
      )
      process.exit(1)
    }

    fs.writeFileSync(
      BASELINE,
      `${JSON.stringify({ about: ABOUT, counts }, null, 2)}\n`
    )
    console.log(`lint-ratchet: baseline written ${JSON.stringify(counts)}`)
    return
  }

  if (!baseline) {
    console.error("lint-ratchet: no baseline; run `yarn lint:ratchet --update`")
    process.exit(1)
  }

  const problems = compare(baseline, counts)

  if (problems.length > 0) {
    console.error(`lint-ratchet: FAIL\n${problems.join("\n")}`)
    process.exit(1)
  }

  console.log(`lint-ratchet: OK ${JSON.stringify(counts)}`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { compare, KEYS }
