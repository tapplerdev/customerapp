import { describe, expect, it, jest } from "@jest/globals"
import React from "react"
import TestRenderer, { act } from "react-test-renderer"

/*
 * A photo send that fails (an upload error, or the server blocking the
 * caption) takes its bubble back down. The open thread keeps a bubble that
 * isn't in the page yet, so a failed one left up would stay for good.
 */

jest.mock("@react-native-camera-roll/camera-roll", () => ({
  CameraRoll: { getPhotos: () => Promise.resolve({ edges: [] }) },
}))
jest.mock("react-native-image-crop-picker", () => ({}))
jest.mock("react-native-fast-image", () => ({ preload: () => undefined }))
jest.mock("@tappler/shared/src/hooks/permissionHooks", () => ({
  requestCameraPermission: () => Promise.resolve(true),
  requestGalleryPermission: () => Promise.resolve(true),
}))
jest.mock("utils/openPermissionAlert", () => ({ openPermissionAlert: () => undefined }))

const mockUpload = jest.fn<() => Promise<{ storageKey: string }>>()
const mockSend = jest.fn<() => Promise<unknown>>()
jest.mock("services/api", () => ({
  useUploadFileMutation: () => [() => ({ unwrap: () => mockUpload() })],
  useSendMessageMutation: () => [() => ({ unwrap: () => mockSend() })],
}))

const useAttachments = require("../useAttachments").default

const open = async () => {
  const sent: any[] = []
  const removed: number[] = []
  const replaced: number[] = []
  const latest: { current: any } = { current: undefined }
  const Harness = () => {
    latest.current = useAttachments({
      maxCount: 4,
      chatId: 7,
      onMessageSent: (m: any) => sent.push(m),
      onMessageReplaced: (id: number) => replaced.push(id),
      onMessageRemoved: (id: number) => removed.push(id),
    })
    return null
  }
  await act(async () => {
    TestRenderer.create(<Harness />)
  })
  await act(async () => {
    latest.current.add({ path: "file:///photo.jpg", mime: "image/jpeg", filename: "photo.jpg" })
  })
  const send = async (text: string) => {
    let error: unknown
    await act(async () => {
      await latest.current.sendWithAttachments(text).catch((e: unknown) => {
        error = e
      })
    })
    return error
  }
  return { sent, removed, replaced, send }
}

describe("a photo send", () => {
  it("takes the bubble down when the server refuses it", async () => {
    mockUpload.mockResolvedValue({ storageKey: "k" })
    mockSend.mockRejectedValue({ status: 400, data: { validationErrors: { text: ["CHAT_BLOCK_CONTACT_INFO"] } } })
    const chat = await open()

    const error = await chat.send("call me 0100")

    expect(error).toBeDefined()
    expect(chat.sent).toHaveLength(1)
    expect(chat.removed).toEqual([chat.sent[0].id])
    expect(chat.replaced).toEqual([])
  })

  it("takes the bubble down when the upload fails", async () => {
    mockUpload.mockRejectedValue({ status: "FETCH_ERROR" })
    const chat = await open()

    await chat.send("")

    expect(chat.removed).toEqual([chat.sent[0].id])
  })

  it("swaps the bubble, and leaves it up, when the send goes", async () => {
    mockUpload.mockResolvedValue({ storageKey: "k" })
    mockSend.mockResolvedValue({ id: 99, files: [] })
    const chat = await open()

    await chat.send("hi")

    expect(chat.replaced).toEqual([chat.sent[0].id])
    expect(chat.removed).toEqual([])
  })
})
