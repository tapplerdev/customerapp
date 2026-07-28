import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

import JobLocationMap, {
  isAreaWorthDrawing,
} from "@tappler/shared/src/components/JobLocationMap"
import { useGetAreaGeometryQuery, useGetPointAreasQuery } from "services/api"

type Props = {
  // Delivery pins this exact point; pickup only uses it to look up the area.
  coords?: { lat: number; lon: number } | null
  isPickup: boolean
}

// Where the order is going, on the review screen. The drawing is
// JobLocationMap's job (shared with the pro app); what this owns is resolving
// WHICH area to outline — a pro's coordinates rather than a job's stamped
// serviceArea, so it takes an extra hop the pro app doesn't need.
//
// Delivery drops a pin on the address the customer picked — it's their own
// address, so there is nothing to hide. Pickup outlines the pro's curated
// service area and shows no pin: they haven't accepted yet.
const OrderLocationMap: React.FC<Props> = ({ coords, isPickup }) => {
  const hasPoint =
    Number.isFinite(coords?.lat) && Number.isFinite(coords?.lon)

  const { data: pointAreas, isLoading: isResolvingArea } = useGetPointAreasQuery(
    { latitude: coords?.lat ?? 0, longitude: coords?.lon ?? 0 },
    { skip: !isPickup || !hasPoint }
  )

  // Outside the curated districts we draw nothing rather than something
  // misleading — see isAreaWorthDrawing.
  const areaRef = isAreaWorthDrawing(pointAreas?.area?.type)
    ? pointAreas?.area
    : undefined

  const { data: areaGeometry, isLoading: isLoadingOutline } =
    useGetAreaGeometryQuery(
      { type: areaRef?.type ?? "", id: String(areaRef?.id ?? "") },
      { skip: !isPickup || !areaRef?.id || !areaRef?.type }
    )

  // Pickup needs two round trips before it knows what to draw. Hold the strip's
  // height while they run so the page doesn't shove itself down mid-read; the
  // rare pro outside a curated area collapses it once, on resolution.
  if (isPickup && hasPoint && (isResolvingArea || isLoadingOutline)) {
    return <DmView className="h-[180] bg-grey58" />
  }

  return (
    <JobLocationMap
      latitude={coords?.lat}
      longitude={coords?.lon}
      areaGeometry={areaGeometry?.geometry ?? null}
      variant={isPickup ? "area" : "pin"}
      showFade
    />
  )
}

export default OrderLocationMap
