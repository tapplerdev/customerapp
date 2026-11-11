import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator } from "react-native"
import FastImage from "react-native-fast-image"
import ImageCropPicker from "react-native-image-crop-picker"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import {
  requestCameraPermission,
  requestGalleryPermission,
} from "@tappler/shared/src/hooks/permissionHooks"
import { Text, a, color } from "@tappler/shared/src/ds"
import CameraIcon from "assets/icons/camera-icon.svg"
import CameraPlusIcon from "assets/icons/camera-plus.svg"
import GalleryIcon from "assets/icons/photo-gallery-icon.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import ErrorModal from "components/ErrorModal"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import {
  useGetCustomerMeQuery,
  useUpdateCustomerMutation,
  useUploadFileMutation,
} from "services/api"
import { openPermissionAlert } from "utils/openPermissionAlert"

import styles from "../styles"

/** The square the photo is cropped to, in pixels, and its JPEG quality. */
export const PHOTO_CROP = { width: 512, height: 512 } as const
export const PHOTO_QUALITY = 0.8

type Source = "gallery" | "camera"

/**
 * The customer's photo in My Information: a square tile with the photo, or a
 * camera when there is none. Tapping it opens a sheet to pick one from the
 * gallery, take one, or remove it. The picker crops to a square
 * (512 x 512, quality 0.8); the file is uploaded with POST /files and then
 * attached with PATCH /customers { profilePhoto: key }, or null to remove.
 *
 * The photo's link is private and expires, so it is read from a fresh
 * GET /customers/me each time the screen opens and is never stored; a link
 * that fails to load falls back to the camera tile.
 */
const ProfilePhotoPicker: React.FC = () => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const { data: me } = useGetCustomerMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  const [uploadFile] = useUploadFileMutation()
  const [updateCustomer] = useUpdateCustomerMutation()

  const [isSheetVisible, setSheetVisible] = useState(false)
  const [isBusy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isErrorVisible, setErrorVisible] = useState(false)

  const photoUrl = me?.profilePhotoUrl
  useEffect(() => setLoadFailed(false), [photoUrl])

  const showError = useCallback(
    (error: any) => {
      setErrorMessage(error?.data?.message || t("an_error_occurred"))
      setErrorVisible(true)
    },
    [t]
  )

  const save = useCallback(
    async (profilePhoto: string | null) => {
      setBusy(true)
      try {
        await updateCustomer({ profilePhoto }).unwrap()
      } catch (error: any) {
        showError(error)
      } finally {
        setBusy(false)
      }
    },
    [showError, updateCustomer]
  )

  const pick = useCallback(
    async (source: Source) => {
      setSheetVisible(false)
      const hasPermission =
        source === "camera"
          ? await requestCameraPermission()
          : await requestGalleryPermission()
      if (!hasPermission) {
        openPermissionAlert()
        return
      }
      // Let the sheet finish closing before the native picker presents.
      setTimeout(async () => {
        try {
          const options = {
            mediaType: "photo",
            cropping: true,
            ...PHOTO_CROP,
            forceJpg: true,
            compressImageQuality: PHOTO_QUALITY,
          } as const
          const image =
            source === "camera"
              ? await ImageCropPicker.openCamera(options)
              : await ImageCropPicker.openPicker(options)

          setBusy(true)
          const { storageKey } = await uploadFile({
            path: image.path,
            mime: image.mime,
            filename: image.filename,
          }).unwrap()
          await save(storageKey)
        } catch (error: any) {
          // Backing out of the picker is not an error.
          if (error?.code !== "E_PICKER_CANCELLED") {
            showError(error)
          }
          setBusy(false)
        }
      }, 300)
    },
    [save, showError, uploadFile]
  )

  const onRemove = useCallback(() => {
    setSheetVisible(false)
    save(null)
  }, [save])

  const rtlRow = { marginStart: 12, textAlign: "left" } as const

  return (
    <DmView style={[a.items_center, a.mb_28]}>
      <DmView
        onPress={() => setSheetVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t("profile_photo")}
        style={[styles.photoTile, a.items_center, a.justify_center]}
      >
        {photoUrl && !loadFailed ? (
          <FastImage
            source={{
              uri: photoUrl,
              cache: FastImage.cacheControl.web,
            }}
            style={styles.photo}
            resizeMode={FastImage.resizeMode.cover}
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <CameraPlusIcon width={32} height={26} />
        )}
        {isBusy && (
          <DmView style={[styles.photoBusy, a.items_center, a.justify_center]}>
            <ActivityIndicator color={color.brand.primary} />
          </DmView>
        )}
      </DmView>
      <DmView onPress={() => setSheetVisible(true)}>
        <Text
          size={13}
          weight="medium"
          leading="tight"
          color="brand"
          style={a.mt_10}
        >
          {t("profile_photo")}
        </Text>
      </DmView>

      <NativeActionSheet
        isVisible={isSheetVisible}
        onClose={() => setSheetVisible(false)}
      >
        <DmView
          style={[a.px_24, a.pt_20, { paddingBottom: insets.bottom + 12 }]}
        >
          <DmView
            style={[a.flex_row, a.items_center, a.py_14]}
            onPress={() => pick("gallery")}
          >
            <DmView style={[styles.sheetIcon, a.items_center]}>
              <GalleryIcon width={22} height={18} />
            </DmView>
            <Text size={14} style={rtlRow}>
              {t("gallery")}
            </Text>
          </DmView>
          <DmView
            style={[a.flex_row, a.items_center, a.py_14]}
            onPress={() => pick("camera")}
          >
            <DmView style={[styles.sheetIcon, a.items_center]}>
              <CameraIcon width={22} height={18} />
            </DmView>
            <Text size={14} style={rtlRow}>
              {t("camera")}
            </Text>
          </DmView>
          {!!photoUrl && (
            <DmView
              style={[a.flex_row, a.items_center, a.py_14]}
              onPress={onRemove}
            >
              <DmView style={[styles.sheetIcon, a.items_center]}>
                <TrashRedIcon width={20} height={24} />
              </DmView>
              <Text size={14} style={rtlRow}>
                {t("remove_photo")}
              </Text>
            </DmView>
          )}
        </DmView>
      </NativeActionSheet>
      <ErrorModal
        isVisible={isErrorVisible}
        onClose={() => setErrorVisible(false)}
        descr={errorMessage}
      />
    </DmView>
  )
}

export default ProfilePhotoPicker
