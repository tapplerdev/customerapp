import React, { useEffect, useMemo, useState } from "react"
import { InteractionManager } from "react-native"
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
  className?: string
}

// Where the order is going, on a map.
//
// Delivery drops a pin on the address the customer picked — it's their own
// address, so there is nothing to hide. Pickup outlines the pro's curated
// service area instead and shows NO pin: the customer hasn't been accepted
// yet, and the same privacy rule governs the pro app's opportunity map.
const OrderLocationMap: React.FC<Props> = ({ coords, isPickup, className }) => {
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
  const { data: pointAreas } = useGetPointAreasQuery(
    { latitude: point?.lat ?? 0, longitude: point?.lon ?? 0 },
    { skip: !isPickup || !point }
  )

  // Prefer the smallest area we know the point falls in; the governorate is a
  // coarse but honest fallback.
  const areaRef = pointAreas?.area ?? pointAreas?.governorate

  const { data: areaGeometry } = useGetAreaGeometryQuery(
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
        (rings[0] ?? []).map((point) => ({
          latitude: point[1],
          longitude: point[0],
        }))
      )
      .filter((ring) => ring.length >= 3)
  }, [areaGeometry])

  // Fit to the outline's bounding box, padded 1.4x, with a floor so a small
  // sub-area doesn't zoom all the way to street level.
  const areaRegion = useMemo(() => {
    const points = areaPolygons.flat()
    if (points.length === 0) return undefined
    let minLat = points[0].latitude
    let maxLat = points[0].latitude
    let minLng = points[0].longitude
    let maxLng = points[0].longitude
    points.forEach((point) => {
      minLat = Math.min(minLat, point.latitude)
      maxLat = Math.max(maxLat, point.latitude)
      minLng = Math.min(minLng, point.longitude)
      maxLng = Math.max(maxLng, point.longitude)
    })
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
    }
  }, [areaPolygons])

  const region = useMemo(() => {
    if (isPickup) {
      if (areaRegion) return areaRegion
      // Outline not loaded (or the point resolves to no curated area): a
      // zoomed-out neighborhood view, still pinless. Never a street-level view
      // of an address we're deliberately not showing.
      return point
        ? {
            latitude: point.lat,
            longitude: point.lon,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : undefined
    }
    return point
      ? {
          latitude: point.lat,
          longitude: point.lon,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }
      : undefined
    // point is derived from coords, which is the real dependency
  }, [isPickup, areaRegion, coords?.lat, coords?.lon])

  // No coordinates means no map — an unanchored MapView renders the whole
  // world, which tells the customer nothing.
  if (!region) return null

  return (
    <DmView
      className={`h-[150] rounded-10 overflow-hidden bg-grey58 ${className ?? ""}`}
      style={styles.frame}
      pointerEvents="none"
    >
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
              <MapMarkerIcon width={22} height={28} />
            </Marker>
          )}
        </MapView>
      )}
    </DmView>
  )
}

export default OrderLocationMap
