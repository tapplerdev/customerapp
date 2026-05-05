export type MapAddress = {
  label: string
  countryCode: string
  countryName: string
  county: string
  city: string
  district: string
  state: string
  street: string
  postalCode: string
  houseNumber: string
}

export type MapPosition = {
  lat: number
  lng: number
}

export type MapView = {
  west: number
  south: number
  east: number
  north: number
}

export type MapLocationResult = {
  title: string
  id: string
  language: string
  resultType: string
  houseNumberType: string
  address: MapAddress
  position: MapPosition
  access: MapPosition[]
  distance: number
  mapView: MapView
}
