'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@/lib/supabase/client'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRealtimeSellers } from '@/hooks/useRealtimeSellers'
import type { House, Street } from '@/lib/types'
import HousePanel from './HousePanel'
import StreetPanel from './StreetPanel'
import styles from './MapView.module.css'

export default function MapboxView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const supabase = createClient()

  // Markers
  const houseMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const sellerMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())

  // Drawing mode
  const drawingModeRef = useRef(false)
  const drawStartRef = useRef<[number, number] | null>(null)
  const firstPinRef = useRef<mapboxgl.Marker | null>(null)

  // State
  const [userId, setUserId] = useState<string | undefined>()
  const [houses, setHouses] = useState<House[]>([])
  const [streets, setStreets] = useState<Street[]>([])
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [drawingMode, setDrawingMode] = useState(false)
  const [drawnSegment, setDrawnSegment] = useState<{ start: { lat: number, lng: number }; end: { lat: number, lng: number } } | null>(null)
  const [editingHouse, setEditingHouse] = useState<House | null>(null)
  const [editingStreet, setEditingStreet] = useState<Street | null>(null)
  const [pendingAppendStreet, setPendingAppendStreet] = useState<Street | null>(null)
  const pendingAppendRef = useRef<Street | null>(null)
  
  // Update ref
  useEffect(() => {
    pendingAppendRef.current = pendingAppendStreet
  }, [pendingAppendStreet])
  
  // Filters and Loading
  const [showHouses, setShowHouses] = useState(true)
  const [showStreets, setShowStreets] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Hooks
  useGeolocation(userId)
  const sellers = useRealtimeSellers()

  // Get User
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase])

  // Load Initial Data & Subscribe to Realtime
  useEffect(() => {
    // Busca inicial
    supabase.from('houses').select('*').then(({ data }) => {
      if (data) setHouses(data)
    })
    supabase.from('streets').select('*').eq('has_coverage', true).then(({ data }) => {
      if (data) setStreets(data as Street[])
    })

    // Tempo Real (Realtime) para Casas
    const housesChannel = supabase.channel('realtime-houses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, (payload) => {
        setHouses(prev => {
          if (payload.eventType === 'INSERT') {
            const exists = prev.find(h => h.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new as House]
          }
          if (payload.eventType === 'UPDATE') return prev.map(h => h.id === payload.new.id ? payload.new as House : h)
          if (payload.eventType === 'DELETE') return prev.filter(h => h.id !== payload.old.id)
          return prev
        })
      })
      .subscribe()

    // Tempo Real (Realtime) para Ruas
    const streetsChannel = supabase.channel('realtime-streets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streets' }, (payload) => {
        setStreets(prev => {
          if (payload.eventType === 'INSERT') {
            const exists = prev.find(s => s.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new as Street]
          }
          if (payload.eventType === 'UPDATE') return prev.map(s => s.id === payload.new.id ? payload.new as Street : s)
          if (payload.eventType === 'DELETE') return prev.filter(s => s.id !== payload.old.id)
          return prev
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(housesChannel)
      supabase.removeChannel(streetsChannel)
    }
  }, [supabase])

  // Init Mapbox
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11', // Tema Dark do Mapbox
      center: [-46.6333, -23.5505], // [lng, lat] em São Paulo padrão
      zoom: 15,
      pitch: 45, // Visão levemente em 3D
      bearing: -17.6,
      antialias: true
    })

    // Adicionar controles de navegação (zoom e rotação) no bottom right
    const navControl = new mapboxgl.NavigationControl({ visualizePitch: true })
    map.addControl(navControl, 'bottom-right')

    // Ponto Azul: Geolocate Control (Gerencia o rastreio e recentralização sozinho)
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false
    })
    map.addControl(geolocate, 'bottom-right')

    map.on('load', () => {
      mapRef.current = map

      // Disparar o rastreio inicial pra centralizar
      geolocate.trigger()

      // Configurar Sources e Layers (Ruas com Cobertura)
      map.addSource('streets-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      // Adicionamos glow effect
      map.addLayer({
        id: 'streets-glow',
        type: 'line',
        source: 'streets-source',
        paint: {
          'line-color': '#22c55e',
          'line-width': 10,
          'line-blur': 8,
          'line-opacity': 0.4
        }
      })

      map.addLayer({
        id: 'streets-layer',
        type: 'line',
        source: 'streets-source',
        paint: {
          'line-color': '#22c55e',
          'line-width': 4
        }
      })

      // Interação de Click nas Ruas
      map.on('click', 'streets-layer', (e) => {
        if (!e.features || e.features.length === 0) return
        if (drawingModeRef.current) return // Ignorar se estiver desenhando

        const props = e.features[0].properties
        if (props && props.id) {
          // Precisamos acessar as streets atuais. Uma forma é depender do state,
          // ou simplesmente emitir um setEditingStreet(props as any)
          // Mas como properties tem os dados, podemos criar um objeto base:
          setEditingStreet({
            id: props.id,
            name: props.name,
            operator: props.operator,
            has_coverage: true,
            city: null, lat_start: null, lng_start: null, lat_end: null, lng_end: null, created_at: ''
          })
        }
      })

      // Mudar cursor sobre as ruas
      map.on('mouseenter', 'streets-layer', () => map.getCanvas().style.cursor = 'pointer')
      map.on('mouseleave', 'streets-layer', () => map.getCanvas().style.cursor = drawingModeRef.current ? 'crosshair' : '')

      // Source/Layer da Preview de Desenho
      map.addSource('preview-line', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }
      })
      map.addLayer({
        id: 'preview-line-layer',
        type: 'line',
        source: 'preview-line',
        paint: {
          'line-color': '#22c55e',
          'line-width': 5,
          'line-dasharray': [2, 1]
        }
      })

      // Informar que o mapa carregou completamente
      setMapLoaded(true)
    })

    // Drag to Draw Events
    // Clique principal do Mapa
    map.on('click', (e) => {
      // ESTAMOS EM MODO DE DESENHO (DRAWING MODE)
      if (drawingModeRef.current) {
        if (!drawStartRef.current) {
          // Primeiro clique (Ponto A)
          drawStartRef.current = [e.lngLat.lng, e.lngLat.lat]
          
          // Colocar um Marker de "A"
          const el = document.createElement('div')
          el.innerHTML = '<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>'
          
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(e.lngLat)
            .addTo(map)
          
          firstPinRef.current = marker
        } else {
          // Segundo clique (Ponto B)
          const startLngLat = drawStartRef.current
          const endLngLat = [e.lngLat.lng, e.lngLat.lat]

          // Distância muito curta
          const distance = Math.sqrt(Math.pow(endLngLat[0]-startLngLat[0], 2) + Math.pow(endLngLat[1]-startLngLat[1], 2))
          if (distance < 0.0001) return

          // Limpar Ponto A
          if (firstPinRef.current) {
            firstPinRef.current.remove()
            firstPinRef.current = null
          }
          drawStartRef.current = null
          
          setDrawnSegment({
            start: { lat: startLngLat[1], lng: startLngLat[0] },
            end: { lat: endLngLat[1], lng: endLngLat[0] }
          })
          setDrawingMode(false)

          const pendingStreet = pendingAppendRef.current
          if (pendingStreet) {
            setEditingStreet(pendingStreet) 
            setPendingAppendStreet(null)
          }
        }
        return // Importante: ignorar lógicas abaixo caso em modo de desenho
      }

      // MODO NORMAL - Ignorar clique na rua
      const features = map.queryRenderedFeatures(e.point, { layers: ['streets-layer'] })
      if (features.length > 0) return

      setClickedLatLng({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sincronizar streets do banco pro GeoJSON source
  const updateStreetsGeoJSON = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const features: any[] = streets
      .filter(s => s.lat_start && s.lng_start && s.lat_end && s.lng_end)
      .map(s => {
        const geometry = s.route_geometry || {
          type: 'LineString',
          coordinates: [[s.lng_start!, s.lat_start!], [s.lng_end!, s.lat_end!]]
        }
        return {
          type: 'Feature',
          geometry,
          properties: { id: s.id, name: s.name, operator: s.operator }
        }
      })

    const source = map.getSource('streets-source') as mapboxgl.GeoJSONSource
    if (source) {
      source.setData({ type: 'FeatureCollection', features })
    }
  }, [streets])

  useEffect(() => {
    if (mapLoaded) {
      updateStreetsGeoJSON()
    }
  }, [updateStreetsGeoJSON, mapLoaded])

  // Gerenciar visibilidade das ruas
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (map.getLayer('streets-layer')) {
      map.setLayoutProperty('streets-layer', 'visibility', showStreets ? 'visible' : 'none')
    }
    if (map.getLayer('streets-glow')) {
      map.setLayoutProperty('streets-glow', 'visibility', showStreets ? 'visible' : 'none')
    }
  }, [showStreets, mapLoaded])

  // Gerenciar Marcadores de Casas (HTML nativo pra manter o estilo rico)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentHouseIds = new Set(houses.map(h => h.id))

    // Remover deletados
    Array.from(houseMarkersRef.current.keys()).forEach(id => {
      if (!currentHouseIds.has(id)) {
        houseMarkersRef.current.get(id)!.remove()
        houseMarkersRef.current.delete(id)
      }
    })

    // Adicionar/Atualizar casas
    houses.forEach(house => {
      let marker = houseMarkersRef.current.get(house.id)
      
      if (!marker) {
        const el = document.createElement('div')
        el.className = 'map-marker-container'
        el.innerHTML = `<div class="map-marker ${house.is_client ? 'map-marker-green' : 'map-marker-red'}">🏠</div>`

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setEditingHouse(house)
        })

        marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([house.lng, house.lat])
          .addTo(map)

        houseMarkersRef.current.set(house.id, marker)
      }

      // Controle de visibilidade
      const el = marker.getElement()
      el.style.display = showHouses ? 'block' : 'none'
    })
  }, [houses, showHouses])

  // Gerenciar Marcadores de Vendedores (Em tempo real)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const sellerIds = new Set(sellers.map(s => s.user_id))

    Array.from(sellerMarkersRef.current.keys()).forEach(id => {
      if (!sellerIds.has(id)) {
        sellerMarkersRef.current.get(id)!.remove()
        sellerMarkersRef.current.delete(id)
      }
    })

    sellers.forEach(seller => {
      // Ignorar meu próprio marcador pois o Mapbox GeolocateControl cuida do meu próprio (Ponto Azul Nativo)
      if (seller.user_id === userId) return

      const existingMarker = sellerMarkersRef.current.get(seller.user_id)
      if (existingMarker) {
        existingMarker.setLngLat([seller.lng, seller.lat])
      } else {
        const el = document.createElement('div')
        el.className = 'map-marker-container'
        el.innerHTML = `<div class="map-marker map-marker-blue">👤</div>`

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`<div style="color: #111; padding: 4px;">👤 Vendedor</div>`)

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([seller.lng, seller.lat])
          .setPopup(popup)
          .addTo(map)

        sellerMarkersRef.current.set(seller.user_id, marker)
      }
    })
  }, [sellers, userId])

  // Modos interativos
  useEffect(() => {
    drawingModeRef.current = drawingMode
    const map = mapRef.current
    if (!map) return

    map.getCanvas().style.cursor = drawingMode ? 'crosshair' : ''
    
    // Auto-destroy temporary pins when disabling drawing mode
    if (!drawingMode) {
      drawStartRef.current = null
      if (firstPinRef.current) {
        firstPinRef.current.remove()
        firstPinRef.current = null
      }
    }
  }, [drawingMode])

  function handleHouseSaved(house: House) {
    setHouses(prev => {
      const exists = prev.find(h => h.id === house.id)
      if (exists) return prev.map(h => h.id === house.id ? house : h)
      return [...prev, house]
    })
    setClickedLatLng(null)
    setEditingHouse(null)
  }

  function handleHouseDeleted(houseId: string) {
    setHouses(prev => prev.filter(h => h.id !== houseId))
    setEditingHouse(null)
  }

  function handleStreetSaved(street: Street) {
    setStreets(prev => {
      const exists = prev.find(s => s.id === street.id)
      if (exists) return prev.map(s => s.id === street.id ? street : s)
      return [...prev, street]
    })
    setDrawnSegment(null)
    setEditingStreet(null)
    setDrawingMode(false)
  }

  function handleStreetDeleted(streetId: string) {
    setStreets(prev => prev.filter(s => s.id !== streetId))
    setEditingStreet(null)
    setDrawingMode(false)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.onlineBadge}>
        <span className={styles.onlineDot} />
        {sellers.length} vendedor{sellers.length !== 1 ? 'es' : ''} online
      </div>

      <div className={styles.statsBadge}>
        🏠 {houses.length} casas · ✅ {houses.filter(h => h.is_client).length} clientes
      </div>

      <div className={styles.filtersBadge}>
        <label className={styles.filterLabel}>
          <input type="checkbox" className={styles.filterCheckbox} checked={showStreets} onChange={e => setShowStreets(e.target.checked)} />
          🛣️ Ruas
        </label>
        <label className={styles.filterLabel}>
          <input type="checkbox" className={styles.filterCheckbox} checked={showHouses} onChange={e => setShowHouses(e.target.checked)} />
          🏠 Casas
        </label>
      </div>

      <div className={styles.actionButtons}>
        {/* Usamos controles nativos para zoom e Geolocate, então tiramos o recentralizar customizado.
            Mantemos apenas o botão de Draw Street. */}
        <button
          className={`${styles.actionBtn} ${drawingMode ? styles.actionBtnActive : ''}`}
          onClick={() => setDrawingMode((v) => !v)}
          title={drawingMode ? 'Cancelar adição de rua' : 'Adicionar rua com operadora'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 17l4-10 5 6 3-4 6 8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {drawingMode && (
        <div className={styles.drawingHint}>
          📍 Toque no mapa para marcar o começo e o fim do trecho
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} className={styles.map} style={{ background: '#111' }} />

      {/* Panels */}
      {(clickedLatLng || editingHouse) && (
        <HousePanel
          lat={clickedLatLng?.lat}
          lng={clickedLatLng?.lng}
          initialData={editingHouse}
          onClose={() => { setClickedLatLng(null); setEditingHouse(null) }}
          onSaved={handleHouseSaved}
          onDeleted={handleHouseDeleted}
        />
      )}

      {(!drawingMode && (drawnSegment || editingStreet)) && (
        <StreetPanel
          segment={drawnSegment || undefined}
          initialData={editingStreet}
          onAddSegment={() => {
            setPendingAppendStreet(editingStreet)
            setEditingStreet(null)
            setDrawingMode(true)
          }}
          onClose={() => { setDrawnSegment(null); setEditingStreet(null); setPendingAppendStreet(null) }}
          onSaved={handleStreetSaved}
          onDeleted={handleStreetDeleted}
        />
      )}
    </div>
  )
}
