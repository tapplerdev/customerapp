import { effectiveUnitPrice } from "store/cart/slice"
import {
  CartItemType,
  CartSelectedOptionType,
  FoodMenuItemType,
  FoodMenuType,
  FoodOptionChoiceType,
  FoodOptionType,
} from "types/food"

// Brings a basket back in line with the pro's CURRENT menu after the order
// check refused it. Pure: it reads lines and a menu and returns lines, so the
// screen decides what to dispatch and what to say.
//
// Three rules it keeps, and the tests pin each:
// - It never guesses. A dish is found by its id, or else by an exact name that
//   appears once in the whole menu. Two dishes with one name, two options with
//   one name, two choices with one name: the line comes out, because picking
//   one would be picking the customer's meal for them.
// - It checks what the server checks (food-order-items-match-menu.decorator.ts
//   in the backend), name by name: the dish exists and is in stock, every
//   chosen option and choice exists, the group's min and max are met, and every
//   required group is answered. A line that fails any of it can't be repaired
//   without asking the customer, so it is removed and reported.
// - It never submits anything. The caller shows the new total first.

// Money columns are floats; the server compares with a cent of slack.
const PRICE_SLACK = 0.01
const samePrice = (a: number, b: number): boolean =>
  Math.abs(a - b) < PRICE_SLACK

// One cart line per dish + choice combination. FoodItemScreen builds the uid
// with this, and the repair rebuilds it when a dish gets a new id, so the two
// can't drift: a re-added dish has to merge into the line that was repaired.
export const cartLineUid = (
  menuItemId: number,
  selectedOptions: CartSelectedOptionType[]
): string =>
  `${menuItemId}:${selectedOptions
    .map(
      (o) =>
        `${o.optionName}=${o.choices
          .map((c) => c.name)
          .sort()
          .join("+")}`
    )
    .sort()
    .join("|")}`

// What the backend validates, and only that: display-only extras
// (originalPrice, isPreOrderOnly, photo) are stripped. Checkout builds the
// payload with this and Review rebuilds it from the live basket on submit, so
// the lines sent are always the lines shown, including after a repair.
export const buildFoodOrderItems = (items: CartItemType[]) =>
  items.map((line) => ({
    menuItemId: line.menuItemId,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
    ...(line.selectedOptions?.length && {
      selectedOptions: line.selectedOptions.map((option) => ({
        optionName: option.optionName,
        choices: option.choices.map((choice) => ({
          name: choice.name,
          price: choice.price,
        })),
      })),
    }),
  }))

export type RemovedReason =
  | "dishGone" // no dish with that id, and no dish with that exact name
  | "dishAmbiguous" // the id is gone and the name belongs to more than one dish
  | "outOfStock"
  | "optionGone" // an option or a choice the customer picked no longer exists
  | "optionAmbiguous" // two options (or two choices) share the picked name
  | "rulesBroken" // the picks no longer meet a group's min/max, or a required group is unanswered

export type RemovedLine = { line: CartItemType; reason: RemovedReason }

export type RepairResult = {
  // The basket to store: kept lines, re-read from the menu.
  lines: CartItemType[]
  // Lines kept whose dish price or a chosen choice's price moved.
  repriced: CartItemType[]
  // Lines taken out, as they were in the basket, each with why.
  removed: RemovedLine[]
  // True when the basket differs from what came in in a way the server cares
  // about: a price, an id, a name, a removed line, or two lines merged. False
  // means the menu agrees with the basket and the refusal has another cause.
  changed: boolean
}

type Resolved = { ok: true; line: CartItemType; repriced: boolean } | {
  ok: false
  reason: RemovedReason
}

const groupByName = <T extends { name: string }>(rows: T[]): Map<string, T[]> => {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const same = map.get(row.name)
    if (same) same.push(row)
    else map.set(row.name, [row])
  }
  return map
}

// The server's bounds for one group, from the same fields. minQty only binds a
// required group, and it needs at least one pick (FoodItemScreen does the same).
const groupAllows = (option: FoodOptionType, picked: number): boolean => {
  const min = option.isRequired ? Math.max(Number(option.minQty) || 0, 1) : 0
  const max = Number(option.maxQty) || 0
  if (picked < min) return false
  return !(max && picked > max)
}

const resolveLine = (
  line: CartItemType,
  dishes: FoodMenuItemType[],
  dishesByName: Map<string, FoodMenuItemType[]>
): Resolved => {
  let dish = dishes.find((d) => d.id === line.menuItemId)
  if (!dish) {
    const named = dishesByName.get(line.name) ?? []
    if (named.length > 1) return { ok: false, reason: "dishAmbiguous" }
    dish = named[0]
  }
  if (!dish) return { ok: false, reason: "dishGone" }
  if (dish.inStock === false) return { ok: false, reason: "outOfStock" }

  const menuOptions = dish.options ?? []
  const optionsByName = groupByName(menuOptions)

  const selectedOptions: CartSelectedOptionType[] = []
  let repriced = false

  for (const picked of line.selectedOptions ?? []) {
    const matches = optionsByName.get(picked.optionName) ?? []
    if (!matches.length) return { ok: false, reason: "optionGone" }
    if (matches.length > 1) return { ok: false, reason: "optionAmbiguous" }
    const option = matches[0]

    const choicesByName = groupByName<FoodOptionChoiceType>(option.choices ?? [])
    const choices: CartSelectedOptionType["choices"] = []
    for (const choice of picked.choices) {
      const found = choicesByName.get(choice.name) ?? []
      if (!found.length) return { ok: false, reason: "optionGone" }
      if (found.length > 1) return { ok: false, reason: "optionAmbiguous" }
      const price = effectiveUnitPrice(found[0])
      if (!samePrice(price, choice.price)) repriced = true
      choices.push({
        name: choice.name,
        price,
        originalPrice: Number(found[0].price) || 0,
      })
    }

    if (!groupAllows(option, choices.length)) {
      return { ok: false, reason: "rulesBroken" }
    }
    selectedOptions.push({ optionName: picked.optionName, choices })
  }

  // A required group nobody answered. The customer has to answer it.
  const answered = new Set(selectedOptions.map((o) => o.optionName))
  if (menuOptions.some((o) => o.isRequired && !answered.has(o.name))) {
    return { ok: false, reason: "rulesBroken" }
  }

  const price = effectiveUnitPrice(dish)
  if (!samePrice(price, line.price)) repriced = true

  return {
    ok: true,
    repriced,
    line: {
      ...line,
      // A dish that kept its id keeps its uid, so an untouched basket comes
      // back identical. A new id means a new uid, built the way the menu
      // screen builds it.
      uid:
        dish.id === line.menuItemId
          ? line.uid
          : cartLineUid(dish.id, selectedOptions),
      menuItemId: dish.id,
      name: dish.name,
      price,
      originalPrice: Number(dish.price) || 0,
      selectedOptions: selectedOptions.length ? selectedOptions : undefined,
    },
  }
}

// Whether the server would see a different line: originalPrice, which only
// draws the strikethrough, doesn't count.
const differsForServer = (before: CartItemType, after: CartItemType): boolean =>
  JSON.stringify(buildFoodOrderItems([before])) !==
  JSON.stringify(buildFoodOrderItems([after]))

export const repairCart = (
  lines: CartItemType[],
  menu: FoodMenuType
): RepairResult => {
  const dishes = (menu.menuSections ?? []).flatMap((s) => s.menuItems ?? [])
  const dishesByName = groupByName(dishes)

  const kept = new Map<string, CartItemType>()
  const repriced: CartItemType[] = []
  const removed: RemovedLine[] = []
  let changed = false

  for (const line of lines) {
    const resolved = resolveLine(line, dishes, dishesByName)
    if (!resolved.ok) {
      removed.push({ line, reason: resolved.reason })
      changed = true
      continue
    }

    if (differsForServer(line, resolved.line)) changed = true
    if (resolved.repriced) repriced.push(resolved.line)

    // Two lines that now point at the same dish with the same choices (one
    // added before an approval, one after) are one line.
    const twin = kept.get(resolved.line.uid)
    if (twin) {
      kept.set(resolved.line.uid, {
        ...twin,
        quantity: twin.quantity + resolved.line.quantity,
      })
      changed = true
    } else {
      kept.set(resolved.line.uid, resolved.line)
    }
  }

  return { lines: [...kept.values()], repriced, removed, changed }
}
