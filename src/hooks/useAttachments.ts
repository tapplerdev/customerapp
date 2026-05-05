import { useCallback, useState } from "react"
import { CameraRoll } from "@react-native-camera-roll/camera-roll"
import ImageCropPicker from "react-native-image-crop-picker"
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

const useAttachments = (params: {
  maxCount: number
  chatId: number
  onMessageSent: (msg: ChatMessageType) => void
}) => {
  const { maxCount, chatId, onMessageSent } = params

  const [pending, setPending] = useState<AttachmentFile[]>([])
  const [recentPhotos, setRecentPhotos] = useState<{ uri: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)

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
    const attachments = [...pending]
    setPending([])
    setIsUploading(true)

    try {
      const storageKeys = await Promise.all(
        attachments.map(async (attachment) => {
          const uploadRes = await uploadFile(attachment).unwrap()
          return uploadRes.storageKey
        })
      )

      const newMsg = await sendMessage({
        chatId,
        ...(text ? { text } : {}),
        files: storageKeys,
      }).unwrap()

      onMessageSent(newMsg)
    } finally {
      setIsUploading(false)
    }
  }, [pending, chatId, sendMessage, uploadFile, onMessageSent])

  return {
    pending,
    recentPhotos,
    addFromCamera,
    addFromGallery,
    selectRecentPhoto,
    remove,
    loadRecentPhotos,
    sendWithAttachments,
    clearPending,
    isUploading,
    isImageMime,
  }
}

export default useAttachments
