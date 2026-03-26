'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRealtimeSellers } from '@/hooks/useRealtimeSellers'
import type { House, Street } from '@/lib/types'
import AddHouseModal from './AddHouseModal'
import AddStreetModal from './AddStreetModal'
import styles from './MapView.module.css'
import { useMapTheme, MAP_THEMES } from '@/contexts/ThemeContext'

// Import dinâmico do Leaflet (somente client-side)
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix ícones padrão do Leaflet no Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Ícones personalizados
const iconClient = L.divIcon({
  html: `<div class="map-marker map-marker-green">🏠</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

const iconNonClient = L.divIcon({
  html: `<div class="map-marker map-marker-red">🏠</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

const iconSeller = L.divIcon({
  html: `<div class="map-marker map-marker-blue">👤</div>`,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
})

// Ponto azul pulsante — posição do usuário atual (estilo Google Maps)
const iconMe = L.divIcon({
  html: `<div class="my-location-dot"></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -14],
})

export default function MapView() {
  const supabase = createClient()
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const sellerMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const houseMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const streetLinesRef = useRef<Map<string, L.Polyline>>(new Map())
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  // Ponto azul do usuário atual — gerenciado localmente pela geolocalização
  const myLocationMarkerRef = useRef<L.Marker | null>(null)

  // Estado do modo de adição de rua (clique e arraste)
  const drawingModeRef = useRef(false)
  const drawStartRef = useRef<L.LatLng | null>(null)
  const previewLineRef = useRef<L.Polyline | null>(null)

  const [userId, setUserId] = useState<string | undefined>()
  const [houses, setHouses] = useState<House[]>([])
  const [streets, setStreets] = useState<Street[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [drawingMode, setDrawingMode] = useState(false)
  const [streetModalOpen, setStreetModalOpen] = useState(false)
  const [drawnSegment, setDrawnSegment] = useState<{ start: L.LatLng; end: L.LatLng } | null>(null)
  const [myPosition, setMyPosition] = useState<{ lat: number; lng: number } | null>(null)
  const { mapTheme } = useMapTheme()

  // Hooks
  useGeolocation(userId)
  const sellers = useRealtimeSellers()

  // Obter usuário atual
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase])

  // Carregar casas iniciais
  useEffect(() => {
    supabase.from('houses').select('*').then(({ data }) => {
      if (data) setHouses(data)
    })
  }, [supabase])

  // Carregar ruas com cobertura existentes
  useEffect(() => {
    supabase.from('streets').select('*').eq('has_coverage', true).then(({ data }) => {
      if (data) setStreets(data as Street[])
    })
  }, [supabase])

  // Rastrear posição local do usuário para exibir o ponto azul imediatamente
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => console.warn('Geolocalização local:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Recentralizar no usuário atual
  const recenter = useCallback(() => {
    const map = mapRef.current
    if (!map || !myPosition) return
    map.setView([myPosition.lat, myPosition.lng], 17, { animate: true })
  }, [myPosition])

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [-23.5505, -46.6333],
      zoom: 15,
      zoomControl: false, // vamos adicionar manualmente em posição melhor
    })

    // Controle de zoom posicionado abaixo dos botões
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapRef.current = map

    // Centralizar no usuário assim que o mapa inicializar
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 16)
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Aplicar e atualizar a camada de tiles quando o tema mudar
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const theme = MAP_THEMES[mapTheme]
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    
    // Fallback: se for mapbox mas não tiver token, usa OSM
    const isMapbox = mapTheme.startsWith('mapbox')
    const finalUrl = (isMapbox && token) ? `${theme.url}${token}` : MAP_THEMES.osm.url
    const finalAttribution = (isMapbox && token) ? theme.attribution : MAP_THEMES.osm.attribution

    if (tileLayerRef.current) {
      tileLayerRef.current.remove()
    }

    tileLayerRef.current = L.tileLayer(finalUrl, {
      attribution: finalAttribution,
      maxZoom: 19,
    }).addTo(map)
  }, [mapTheme])

  // Gerenciar eventos de clique e arraste no mapa baseado no modo
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Handler do clique normal (adicionar casa)
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (drawingModeRef.current) return // ignora clique no modo de desenho
      setClickedLatLng({ lat: e.latlng.lat, lng: e.latlng.lng })
      setModalOpen(true)
    }

    // Handlers do modo de desenho de rua
    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (!drawingModeRef.current) return
      drawStartRef.current = e.latlng

      // Linha de preview
      const line = L.polyline([e.latlng, e.latlng], {
        color: '#22c55e',
        weight: 5,
        dashArray: '8, 6',
        opacity: 0.8,
      }).addTo(map)
      previewLineRef.current = line

      // Bloquear arraste do mapa durante o desenho
      map.dragging.disable()
    }

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!drawingModeRef.current || !drawStartRef.current || !previewLineRef.current) return
      previewLineRef.current.setLatLngs([drawStartRef.current, e.latlng])
    }

    const handleMouseUp = (e: L.LeafletMouseEvent) => {
      if (!drawingModeRef.current || !drawStartRef.current) return

      const start = drawStartRef.current
      const end = e.latlng

      // Reativar arraste do mapa
      map.dragging.enable()

      // Remover preview
      if (previewLineRef.current) {
        previewLineRef.current.remove()
        previewLineRef.current = null
      }

      // Verificar se o segmento tem tamanho mínimo (evitar cliques acidentais)
      const distance = start.distanceTo(end)
      if (distance < 20) {
        drawStartRef.current = null
        return
      }

      drawStartRef.current = null

      // Abrir modal para configurar a rua
      setDrawnSegment({ start, end })
      setStreetModalOpen(true)
    }

    map.on('click', handleClick)
    map.on('mousedown', handleMouseDown)
    map.on('mousemove', handleMouseMove)
    map.on('mouseup', handleMouseUp)

    return () => {
      map.off('click', handleClick)
      map.off('mousedown', handleMouseDown)
      map.off('mousemove', handleMouseMove)
      map.off('mouseup', handleMouseUp)
    }
  }, [])

  // Sincronizar ref com estado do modo de desenho
  useEffect(() => {
    drawingModeRef.current = drawingMode
    const map = mapRef.current
    if (!map) return

    if (drawingMode) {
      map.getContainer().style.cursor = 'crosshair'
    } else {
      map.getContainer().style.cursor = ''
      // Limpar preview se houver
      if (previewLineRef.current) {
        previewLineRef.current.remove()
        previewLineRef.current = null
      }
      drawStartRef.current = null
      map.dragging.enable()
    }
  }, [drawingMode])

  // Atualizar ponto azul na posição local (sem depender do Supabase)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !myPosition) return

    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setLatLng([myPosition.lat, myPosition.lng])
    } else {
      myLocationMarkerRef.current = L.marker([myPosition.lat, myPosition.lng], { icon: iconMe, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('📍 Você está aqui')
    }
  }, [myPosition])

  // Renderizar marcadores de casas
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    houseMarkersRef.current.forEach((m) => m.remove())
    houseMarkersRef.current.clear()

    houses.forEach((house) => {
      const icon = house.is_client ? iconClient : iconNonClient
      const marker = L.marker([house.lat, house.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div class="leaflet-popup-inner">
            <strong>${house.address || 'Casa cadastrada'}</strong><br/>
            <span class="${house.is_client ? 'popup-success' : 'popup-danger'}">
              ${house.is_client ? '✅ Cliente ativo' : '❌ Não cliente'}
            </span>
            ${house.current_operator ? `<br/>📡 ${house.current_operator}` : ''}
            ${house.installation_date ? `<br/>📅 ${new Date(house.installation_date).toLocaleDateString('pt-BR')}` : ''}
          </div>`
        )
      houseMarkersRef.current.set(house.id, marker)
    })
  }, [houses])

  // Renderizar ruas com cobertura vindas do banco como linhas verdes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    streetLinesRef.current.forEach((l) => l.remove())
    streetLinesRef.current.clear()

    streets.forEach((street) => {
      if (!street.lat_start || !street.lng_start || !street.lat_end || !street.lng_end) return

      const line = L.polyline(
        [[street.lat_start, street.lng_start], [street.lat_end, street.lng_end]],
        { color: '#22c55e', weight: 6, opacity: 0.9 }
      )
        .addTo(map)
        .bindPopup(`🟢 <strong>${street.name}</strong>${street.operator ? `<br/>📡 ${street.operator}` : ''}`)

      streetLinesRef.current.set(street.id, line)
    })
  }, [streets])


  // Renderizar marcadores dos vendedores em tempo real (excluindo o próprio usuário, que tem ponto azul local)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    sellers.forEach((seller) => {
      // O próprio usuário tem ponto azul local — não duplicar com marcador do Supabase
      if (seller.user_id === userId) return

      if (sellerMarkersRef.current.has(seller.user_id)) {
        sellerMarkersRef.current.get(seller.user_id)!.setLatLng([seller.lat, seller.lng])
      } else {
        const marker = L.marker([seller.lat, seller.lng], { icon: iconSeller })
          .addTo(map)
          .bindPopup('👤 Vendedor')
        sellerMarkersRef.current.set(seller.user_id, marker)
      }
    })
  }, [sellers, userId])

  // Callback quando houver nova casa cadastrada
  function handleHouseAdded(house: House) {
    setHouses((prev) => [...prev, house])
    setModalOpen(false)
    setClickedLatLng(null)
  }

  // Callback quando rua for adicionada com cobertura — desenhar linha verde permanente
  function handleStreetAdded(streetId: string, segment: { start: L.LatLng; end: L.LatLng }) {
    const map = mapRef.current
    if (!map) return

    const line = L.polyline([segment.start, segment.end], {
      color: '#22c55e',
      weight: 6,
      opacity: 0.9,
    })
      .addTo(map)
      .bindPopup('🟢 Rua com operadora disponível')

    streetLinesRef.current.set(streetId, line)
    setStreetModalOpen(false)
    setDrawnSegment(null)
    setDrawingMode(false)
  }

  return (
    <div className={styles.wrapper}>
      {/* Indicador de vendedores online */}
      <div className={styles.onlineBadge}>
        <span className={styles.onlineDot} />
        {sellers.length} vendedor{sellers.length !== 1 ? 'es' : ''} online
      </div>

      {/* Contagem de casas */}
      <div className={styles.statsBadge}>
        🏠 {houses.length} casas · ✅ {houses.filter((h) => h.is_client).length} clientes
      </div>

      {/* Botões de ação */}
      <div className={styles.actionButtons}>
        {/* Botão recentralizar */}
        <button
          className={styles.actionBtn}
          onClick={recenter}
          title="Centralizar na minha localização"
          aria-label="Centralizar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <path d="M12 7a5 5 0 1 0 5 5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Botão modo de desenho de rua */}
        <button
          className={`${styles.actionBtn} ${drawingMode ? styles.actionBtnActive : ''}`}
          onClick={() => setDrawingMode((v) => !v)}
          title={drawingMode ? 'Cancelar adição de rua' : 'Adicionar rua com operadora'}
          aria-label="Adicionar rua"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 17l4-10 5 6 3-4 6 8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Dica do modo desenho */}
      {drawingMode && (
        <div className={styles.drawingHint}>
          🖊️ Clique e arraste no mapa para marcar uma rua com operadora disponível
        </div>
      )}

      {/* Container do mapa */}
      <div ref={mapContainerRef} className={styles.map} />

      {/* Modal de cadastro de casa */}
      {modalOpen && clickedLatLng && (
        <AddHouseModal
          lat={clickedLatLng.lat}
          lng={clickedLatLng.lng}
          onClose={() => { setModalOpen(false); setClickedLatLng(null) }}
          onHouseAdded={handleHouseAdded}
        />
      )}

      {/* Modal de cadastro de rua */}
      {streetModalOpen && drawnSegment && (
        <AddStreetModal
          segment={drawnSegment}
          onClose={() => {
            setStreetModalOpen(false)
            setDrawnSegment(null)
          }}
          onStreetAdded={handleStreetAdded}
        />
      )}
    </div>
  )
}
