import React, { useEffect, useMemo, useState } from "react"
import { InteractionManager } from "react-native"
import LinearGradient from "react-native-linear-gradient"
import MapView, { Marker, Polygon } from "react-native-maps"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { useGetAreaGeometryQuery, useGetPointAreasQuery } from "services/api"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"

import styles from "./styles"

type Props = {
  // Delivery pins this exact point; pickup only uses it to look up the area.
  coords?: { lat: number; lon: number } | null
  isPickup: boolean
}

// A district is only worth drawing if it is district-sized. Governorates run to
// the Libyan border — Giza's outline spans 440km — and fitting one into a 180pt
// strip paints a red blob over half of Egypt.
const AREA_TYPES_WORTH_DRAWING = ["subArea", "bigArea"]

// Where the order is going, on a map. Styled as the hero of the screen, the
// same full-bleed strip with a white fade that the regular-service review
// screen opens with.
//
// Delivery drops a pin on the address the customer picked — it's their own
// address, so there is nothing to hide. Pickup outlines the pro's curated
// service area instead and shows NO pin: the customer hasn't been accepted
// yet, and the same privacy rule governs the pro app's opportunity map.
const OrderLocationMap: React.FC<Props> = ({ coords, isPickup }) => {
  // On iOS a MapView mounted mid-push renders a blank grid — the tile fetch is
  // dropped and never retried. Wait for the transition to settle, the same
  // deferral the pro app's opportunity map uses.
  const [isMapReady, setMapReady] = useState(false)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setMapReady(true))
    return () => task.cancel()
  }, [])

  // A half-populated point is worse than none: it centres the map on NaN and
  // renders the whole globe. Only trust two real numbers.
  const point =
    Number.isFinite(coords?.lat) && Number.isFinite(coords?.lon)
      ? { lat: Number(coords?.lat), lon: Number(coords?.lon) }
      : null

  // Pickup: coords → curated area → outline. Two hops, both skipped entirely
  // on a delivery order.
  const { data: pointAreas, isLoading: isResolvingArea } = useGetPointAreasQuery(
    { latitude: point?.lat ?? 0, longitude: point?.lon ?? 0 },
    { skip: !isPickup || !point }
  )

  // No governorate fallback — see AREA_TYPES_WORTH_DRAWING. Outside the curated
  // areas we draw nothing at all rather than something misleading.
  const areaRef = AREA_TYPES_WORTH_DRAWING.includes(pointAreas?.area?.type ?? "")
    ? pointAreas?.area
    : undefined

  const { data: areaGeometry, isLoading: isLoadingOutline } =
    useGetAreaGeometryQuery(
      { type: areaRef?.type ?? "", id: String(areaRef?.id ?? "") },
      { skip: !isPickup || !areaRef?.id || !areaRef?.type }
    )

  // Outer ring of each polygon only (holes ignored), flipped from GeoJSON
  // [lng, lat] to the { latitude, longitude } react-native-maps wants. Handles
  // both Polygon (ring[][]) and MultiPolygon (polygon[][][]).
  const areaPolygons = useMemo(() => {
    const geometry = areaGeometry?.geometry
    if (!geometry) return []
    const polygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
    return polygons
      .map((rings) =>
        (rings[0] ?? []).map((vertex) => ({
          latitude: vertex[1],
          longitude: vertex[0],
        }))
      )
      .filter((ring) => ring.length >= 3)
  }, [areaGeometry])

  // Fit to the outline's bounding box. The longitude span is widened for the
  // strip's ~2.3:1 aspect (and for the latitude's cos factor) — MapView expands
  // whichever axis is short, so asking for a square region around a wide
  // district leaves the outline as a small blob in a sea of empty map.
  const areaRegion = useMemo(() => {
    const points = areaPolygons.flat()
    if (points.length === 0) return undefined
    let minLat = points[0].latitude
    let maxLat = points[0].latitude
    let minLng = points[0].longitude
    let maxLng = points[0].longitude
    points.forEach((vertex) => {
      minLat = Math.min(minLat, vertex.latitude)
      maxLat = Math.max(maxLat, vertex.latitude)
      minLng = Math.min(minLng, vertex.longitude)
      maxLng = Math.max(maxLng, vertex.longitude)
    })
    const midLat = (minLat + maxLat) / 2
    const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.01)
    const aspect = 343 / 180
    const widened =
      (latitudeDelta * aspect) / Math.max(Math.cos((midLat * Math.PI) / 180), 0.1)
    return {
      latitude: midLat,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta,
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, widened),
    }
  }, [areaPolygons])

  const region = useMemo(() => {
    // Pickup shows the district or nothing. A pinless street-level map centred
    // on the pro's door tells the customer nothing and quietly frames the exact
    // address we are deliberately withholding.
    if (isPickup) return areaRegion
    return point
      ? {
          latitude: point.lat,
          longitude: point.lon,
          latitudeDelta: 0.005,
          longitudeDelta: 0.002,
        }
      : undefined
    // point is derived from coords, which is the real dependency
  }, [isPickup, areaRegion, coords?.lat, coords?.lon])

  // Pickup needs two round trips before it knows what to draw. Hold the strip's
  // height while they run so the page doesn't shove itself down mid-read; the
  // rare pro outside a curated area collapses it once, on resolution.
  const isResolving = isPickup && !!point && (isResolvingArea || isLoadingOutline)

  // Nothing to anchor to means no map — an unanchored MapView renders the
  // whole world, which tells the customer nothing.
  if (!region) return isResolving ? <DmView className="h-[180]" /> : null

  return (
    <DmView className="h-[180]" pointerEvents="none">
      {isMapReady && (
        <MapView
          style={styles.map}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          mapType="standard"
          region={region}
        >
          {isPickup ? (
            areaPolygons.map((coordinates, index) => (
              <Polygon
                key={index}
                coordinates={coordinates}
                fillColor="rgba(204, 0, 0, 0.15)"
                strokeColor={colors.red}
                strokeWidth={1.5}
              />
            ))
          ) : (
            <Marker
              coordinate={{ latitude: region.latitude, longitude: region.longitude }}
            >
              <MapMarkerIcon width={32} height={40} />
            </Marker>
          )}
        </MapView>
      )}
      {/* Fades into the page instead of ending on a hard edge — same treatment
          as the regular-service review screen. */}
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
        style={styles.fade}
      />
    </DmView>
  )
}

export default OrderLocationMap
