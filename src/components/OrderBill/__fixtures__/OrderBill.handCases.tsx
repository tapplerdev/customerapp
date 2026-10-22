/*
 * Hand-written cases for OrderBill's parity tests: the jobs it draws, and the
 * classes a caller could still pass (the one call site passes none). They live
 * in a .tsx file, imported by the tests (the kit's loaders `require` it too),
 * so that NativeWind compiles the classes.
 */
import type { JobType } from "types/job"
import { JOB_FOOD } from "testing/screenKit/fixtures/entities"

/** The bills the call site (MessagesDetailsScreen:858) can hand it. */
export const JOBS: Record<string, JobType> = {
  // 2 x 185 + a delivery fee of 25
  "delivery fee": JOB_FOOD,
  // Options and their prices, a free delivery, a discount
  "options, free delivery, discount": {
    ...JOB_FOOD,
    foodOrderItems: [
      {
        id: 1,
        menuItemId: 411,
        name: "Molokhia with chicken",
        price: 185,
        quantity: 2,
        selectedOptions: [
          {
            optionName: "Side",
            choices: [
              { name: "Rice", price: 10 },
              { name: "Bread", price: 0 },
            ],
          },
        ],
      },
      {
        id: 2,
        menuItemId: 412,
        name: "Fattah",
        price: 120.5,
        quantity: 1,
      },
    ],
    deliveryFee: 0,
    orderDiscount: 30,
  },
  // Nothing to bill: the component draws nothing
  "no items": { ...JOB_FOOD, foodOrderItems: [] },
}

export const HAND_CASES: {
  name: string
  props: { job: string; isPickup: boolean; className: string }
}[] = [
  {
    name: "class mt-[12]",
    props: { job: "delivery fee", isPickup: false, className: "mt-[12]" },
  },
  {
    name: "class px-[16] bg-grey5",
    props: {
      job: "options, free delivery, discount",
      isPickup: true,
      className: "px-[16] bg-grey5",
    },
  },
]
