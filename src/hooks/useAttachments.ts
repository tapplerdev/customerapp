import { useCallback, useRef, useState } from "react"
import { CameraRoll } from "@react-native-camera-roll/camera-roll"
import ImageCropPicker from "react-native-image-crop-picker"
import FastImage from "react-native-fast-image"
import {
  useRequestCameraPermissions,
  useRequestGallery,
} from "@tappler/shared/src/hooks/permissionHooks"
import {
  useSendMessageMutation,
  useUploadFileMutation,
} from "services/api"
import { openPermissionAlert } from "utils/openPermissionAlert"
import { ChatMessageType } from "types/chat"

type AttachmentFile = { path: string; mime?: string; filename?: string }

let optimisticIdCounter = -1

const useAttachments = (params: {
  maxCount: number
  chatId: number
  onMessageSent: (msg: ChatMessageType) => void
  onMessageReplaced?: (optimisticId: number, realMsg: ChatMessageType) => void
}) => {
  const { maxCount, chatId, onMessageSent, onMessageReplaced } = params

  const [pending, setPending] = useState<AttachmentFile[]>([])
  const [recentPhotos, setRecentPhotos] = useState<{ uri: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const uploadingIdsRef = useRef<Set<number>>(new Set())

  const [sendMessage] = useSendMessageMutation()
  const [uploadFile] = useUploadFileMutation()

  const isImageMime = (mime?: string) => mime?.startsWith("image/")

  const add = useCallback((file: AttachmentFile) => {
    setPending((prev) => {
      if (prev.length >= maxCount) return prev
      return [...prev, file]
    })
  }, [maxCount])

  const remove = useCallback((index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearPending = useCallback(() => {
    setPending([])
  }, [])

  const loadRecentPhotos = useCallback(async () => {
    try {
      const hasPermission = await useRequestGallery()
      if (!hasPermission) {
        openPermissionAlert()
        return
      }
      const result = await CameraRoll.getPhotos({
        first: 20,
        assetType: "Photos",
      })
      setRecentPhotos(result.edges.map((edge) => ({ uri: edge.node.image.uri })))
    } catch {}
  }, [])

  const selectRecentPhoto = useCallback((uri: string) => {
    add({ path: uri, mime: "image/jpeg" })
  }, [add])

  const toggleRecentPhoto = useCallback((uri: string) => {
    setPending((prev) => {
      const existingIndex = prev.findIndex((p) => p.path === uri)
      if (existingIndex >= 0) {
        return prev.filter((_, i) => i !== existingIndex)
      }
      if (prev.length >= maxCount) return prev
      return [...prev, { path: uri, mime: "image/jpeg" }]
    })
  }, [maxCount])

  const isPhotoSelected = useCallback((uri: string) => {
    return pending.some((p) => p.path === uri)
  }, [pending])

  const getPhotoSelectionIndex = useCallback((uri: string) => {
    return pending.findIndex((p) => p.path === uri)
  }, [pending])

  const addFromCamera = useCallback(async () => {
    const hasPermission = await useRequestCameraPermissions()
    if (!hasPermission) {
      openPermissionAlert()
      return
    }
    setTimeout(() => {
      ImageCropPicker.openCamera({
        width: 400,
        height: 400,
        cropping: false,
      }).then((image) => {
        add({ path: image.path, mime: image.mime, filename: image.filename })
      }).catch(() => {})
    }, 300)
  }, [add])

  const addFromGallery = useCallback(async () => {
    const hasPermission = await useRequestGallery()
    if (!hasPermission) {
      openPermissionAlert()
      return
    }
    setTimeout(() => {
      ImageCropPicker.openPicker({
        multiple: true,
        maxFiles: maxCount - pending.length,
        cropping: false,
        forceJpg: true,
        compressImageQuality: 0.8,
      }).then((images) => {
        const newFiles = images.slice(0, maxCount - pending.length)
        setPending((prev) => [
          ...prev,
          ...newFiles.map((img) => ({ path: img.path, mime: img.mime, filename: img.filename })),
        ].slice(0, maxCount))
      }).catch(() => {})
    }, 300)
  }, [maxCount, pending.length])

  const sendWithAttachments = useCallback(async (text: string) => {
    const attachmentsCopy = [...pending]
    setPending([])
    setIsUploading(true)

    // 1. Build optimistic message with local file URIs
    const optimisticId = optimisticIdCounter--
    const optimisticFiles = attachmentsCopy.map((att, i) => ({
      id: -(i + 1),
      fileName: att.filename || "file",
      extension: att.filename?.split(".").pop() || "jpg",
      originalName: att.filename || "file",
      mimeType: att.mime || "image/jpeg",
      storageKey: "",
      url: att.path,
      url1920: att.path,
      url720: att.path,
      url150: att.path,
    }))

    const optimisticMsg: ChatMessageType = {
      id: optimisticId,
      text: text || undefined,
      ownerType: "customer",
      createdAt: new Date().toISOString(),
      files: optimisticFiles,
    }

    // 2. Insert optimistic message immediately
    onMessageSent(optimisticMsg)
    uploadingIdsRef.current.add(optimisticId)

    try {
      // 3. Upload all files
      const storageKeys = await Promise.all(
        attachmentsCopy.map(async (attachment) => {
          const uploadRes = await uploadFile(attachment).unwrap()
          return uploadRes.storageKey
        })
      )

      // 4. Send message with storage keys
      const realMsg = await sendMessage({
        chatId,
        ...(text ? { text } : {}),
        files: storageKeys,
      }).unwrap()

      // 5. Prefetch remote images
      const imageUrls = realMsg?.files
        ?.filter((f: any) => f.mimeType?.startsWith("image/") && f.url)
        .map((f: any) => f.url720 || f.url)
        .filter((url: string) => url?.length > 0) ?? []

      if (imageUrls.length > 0) {
        FastImage.preload(imageUrls.map((uri: string) => ({ uri })))
      }

      // 6. Replace optimistic with real message
      uploadingIdsRef.current.delete(optimisticId)
      if (onMessageReplaced) {
        onMessageReplaced(optimisticId, realMsg)
      }
    } catch (e) {
      uploadingIdsRef.current.delete(optimisticId)
      throw e
    } finally {
      setIsUploading(false)
    }
  }, [pending, chatId, sendMessage, uploadFile, onMessageSent, onMessageReplaced])

  const isMessageUploading = useCallback((messageId: number) => {
    return uploadingIdsRef.current.has(messageId)
  }, [])

  return {
    pending,
    recentPhotos,
    add,
    addFromCamera,
    addFromGallery,
    selectRecentPhoto,
    toggleRecentPhoto,
    isPhotoSelected,
    getPhotoSelectionIndex,
    remove,
    loadRecentPhotos,
    sendWithAttachments,
    clearPending,
    isUploading,
    isImageMime,
    isMessageUploading,
  }
}

export default useAttachments
