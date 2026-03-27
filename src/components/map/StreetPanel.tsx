'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Street } from '@/lib/types'
import SidePanel from './SidePanel'
import styles from './AddHouseModal.module.css' // Reusing styles

interface Props {
  initialData?: Street | null
  segment?: { start: {lat: number, lng: number}; end: {lat: number, lng: number} }
  onClose: () => void
  onSaved: (street: Street) => void
  onDeleted?: (streetId: string) => void
  onAddSegment?: () => void
}

const OPERADORAS = ['LIGGA', 'NIO', 'TIM']

export default function StreetPanel({ segment, initialData, onClose, onSaved, onDeleted, onAddSegment }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [streetName, setStreetName] = useState(initialData?.name || '')
  const [cityName, setCityName] = useState(initialData?.city || '')
  const [operators, setOperators] = useState<string[]>(initialData?.operator ? initialData.operator.split(', ') : [])
  const [isFetchingAddress, setIsFetchingAddress] = useState(false)

  const isEditing = !!initialData

  // Fetch address only if creating new street AND we have a segment
  useEffect(() => {
    if (isEditing || !segment) return

    async function fetchAddress() {
      setIsFetchingAddress(true)
      try {
        const midLat = (segment!.start.lat + segment!.end.lat) / 2
        const midLng = (segment!.start.lng + segment!.end.lng) / 2
        
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${midLat}&lon=${midLng}&zoom=18&addressdetails=1`)
        if (!res.ok) throw new Error('Falha ao buscar')
        const data = await res.json()
        
        if (data && data.address) {
          const road = data.address.road || ''
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || ''
          
          if (road && !streetName) setStreetName(road)
          if (city && !cityName) setCityName(city)
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err)
      } finally {
        setIsFetchingAddress(false)
      }
    }
    
    fetchAddress()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, isEditing])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!streetName) {
      setError('Informe o nome da rua.')
      setLoading(false)
      return
    }

    const payload: any = {
      name: streetName,
      city: cityName || null,
      operator: operators.length > 0 ? operators.join(', ') : null,
      has_coverage: true,
    }

    // Handeling Coordinate Geometry (Draw Line or Snap)
    if (segment) {
      let snappedGeoJSON: any = null
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (token) {
          const dirRes = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${segment.start.lng},${segment.start.lat};${segment.end.lng},${segment.end.lat}?geometries=geojson&access_token=${token}`
          )
          const dirData = await dirRes.json()
          if (dirData && dirData.routes && dirData.routes[0]) {
            snappedGeoJSON = dirData.routes[0].geometry // GeoJSON LineString
          }
        }
      } catch (err) {
        console.error('Mapbox Directions error:', err)
      }

      if (!snappedGeoJSON) {
        snappedGeoJSON = {
          type: 'LineString',
          coordinates: [[segment.start.lng, segment.start.lat], [segment.end.lng, segment.end.lat]]
        }
      }

      if (isEditing && initialData) {
        // Append to existing geometry (Upgrade to MultiLineString if needed)
        let existingCoords: any[] = []
        if (initialData.route_geometry) {
           if (initialData.route_geometry.type === 'LineString') {
             existingCoords = [initialData.route_geometry.coordinates]
           } else if (initialData.route_geometry.type === 'MultiLineString') {
             existingCoords = [...initialData.route_geometry.coordinates]
           }
        } else if (initialData.lng_start && initialData.lat_start) {
           existingCoords = [[[initialData.lng_start!, initialData.lat_start!], [initialData.lng_end!, initialData.lat_end!]]]
        }
        
        existingCoords.push(snappedGeoJSON.coordinates)
        payload.route_geometry = {
          type: 'MultiLineString',
          coordinates: existingCoords
        }
      } else {
        // Brand new street
        payload.lat_start = segment.start.lat
        payload.lng_start = segment.start.lng
        payload.lat_end = segment.end.lat
        payload.lng_end = segment.end.lng
        payload.route_geometry = snappedGeoJSON
      }
    }

    let result
    if (isEditing) {
      result = await supabase.from('streets').update(payload).eq('id', initialData.id).select().single()
    } else {
      result = await supabase.from('streets').insert(payload).select().single()
    }

    if (result.error) {
      console.error(result.error)
      setError('Erro ao salvar rua. Tente novamente.')
      setLoading(false)
      return
    }

    onSaved(result.data as Street)
  }

  async function handleDelete() {
    if (!initialData || !onDeleted) return
    if (!confirm('Deseja realmente excluir esta rua?')) return

    setLoading(true)
    const { error: err } = await supabase.from('streets').delete().eq('id', initialData.id)
    if (err) {
      console.error('Supabase Error:', err)
      setError('Erro ao excluir rua.')
      setLoading(false)
      return
    }
    onDeleted(initialData.id)
  }

  const title = isEditing ? '🟢 Editar Rua' : '🟢 Adicionar Rua'

  return (
    <SidePanel title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="form-group">
            <label className="input-label" htmlFor="street-name">
              Nome da rua * {isFetchingAddress && <sup style={{ color: '#888' }}>(buscando...)</sup>}
            </label>
            <input
              id="street-name"
              name="name"
              type="text"
              className="input"
              placeholder="Ex: Rua das Flores"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
              required
              autoFocus
              disabled={isFetchingAddress}
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="street-city">
              Cidade
            </label>
            <input
              id="street-city"
              name="city"
              type="text"
              className="input"
              placeholder="Ex: São Paulo"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              disabled={isFetchingAddress}
            />
          </div>

          <div className="form-group">
            <label className="input-label">Operadoras disponíveis</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {OPERADORAS.map((op) => (
                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={operators.includes(op)}
                    onChange={(e) => {
                      if (e.target.checked) setOperators([...operators, op])
                      else setOperators(operators.filter(o => o !== op))
                    }}
                    style={{ accentColor: '#22c55e', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  {op}
                </label>
              ))}
            </div>
          </div>

          {error && <p className={styles.error} style={{ marginTop: 'auto' }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
          {isEditing && (
            <button type="button" className="btn btn-ghost" onClick={() => onAddSegment?.()} disabled={loading} style={{ border: '1px solid #333', marginBottom: '8px' }}>
              ➕ Adicionar partes a esta rua
            </button>
          )}
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : '🟢 Salvar Rua'}
          </button>
          
          {isEditing && (
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading} style={{ background: 'transparent', color: '#ff4444', border: '1px solid #ff4444' }}>
              🗑️ Excluir Rua
            </button>
          )}

          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </form>
    </SidePanel>
  )
}
