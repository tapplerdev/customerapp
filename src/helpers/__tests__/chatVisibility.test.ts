import { describe, expect, it } from "@jest/globals"

import type { ChatPreviewType } from "types/chat"

import { isArchivedChatVisible, isChatVisible } from "../chatVisibility"

const preview = (
  status: "active" | "archived",
  overrides: Partial<ChatPreviewType> & { job?: unknown; proId?: number } = {}
): ChatPreviewType => {
  const { job, proId = 7, ...rest } = overrides
  return {
    chat: { id: 1, status, proId, customerId: 2, pro: { id: proId }, job },
    notReadMessages: 0,
    ...rest,
  } as unknown as ChatPreviewType
}

const jobWith = (selectionStatus: string) => ({
  id: 9,
  pros: [{ proId: 7, selectionStatus }],
})

const message = { id: 1, ownerType: "pro", createdAt: "2026-10-01T00:00:00Z" }

describe("the engagement gate, in the list and in the archive", () => {
  it("an archived cold pitch (job chat, no offer, no customer message) stays out of Archived, as it does of the list", () => {
    const cold = { job: jobWith("opportunity"), hasCustomerMessages: false }
    expect(isArchivedChatVisible(preview("archived", cold))).toBe(false)
    expect(isChatVisible(preview("active", cold))).toBe(false)
  })

  it("an archived job chat with an offer, or a customer message, is in Archived", () => {
    expect(
      isArchivedChatVisible(preview("archived", { job: jobWith("offer") }))
    ).toBe(true)
    expect(
      isArchivedChatVisible(
        preview("archived", {
          job: jobWith("customerRejected"),
          hasCustomerMessages: true,
        })
      )
    ).toBe(true)
  })

  it("a direct chat needs a message, archived or not", () => {
    expect(isArchivedChatVisible(preview("archived"))).toBe(false)
    expect(
      isArchivedChatVisible(
        preview("archived", { lastMessage: message as never })
      )
    ).toBe(true)
  })

  it("status splits the two lists: no chat is in both", () => {
    const engaged = { lastMessage: message as never }
    expect(isChatVisible(preview("archived", engaged))).toBe(false)
    expect(isArchivedChatVisible(preview("active", engaged))).toBe(false)
  })
})
