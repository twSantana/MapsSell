// Tipos centralizados do GeoCRM

export interface Street {
  id: string
  name: string
  city: string | null
  has_coverage: boolean
  operator: string | null
  lat_start: number | null
  lng_start: number | null
  lat_end: number | null
  lng_end: number | null
  route_geometry?: any | null
  created_at: string
}

export interface House {
  id: string
  street_id: string | null
  address: string | null
  lat: number
  lng: number
  is_client: boolean
  installation_date: string | null
  current_operator: string | null
  notes: string | null
  created_at: string
}

export interface SellerLocation {
  id: string
  user_id: string
  lat: number
  lng: number
  updated_at: string
}
