'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export const MAP_THEMES = {
  osm: {
    name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  'mapbox-custom': {
    name: 'Versão Mapbox (Custom)',
    url: 'https://api.mapbox.com/styles/v1/eversonadm/cmn6f1kgl008001qlb2jqb0p1/tiles/256/{z}/{x}/{y}@2x?access_token=',
    attribution: '© Mapbox © OpenStreetMap',
  },
  'mapbox-streets': {
    name: 'Ruas',
    url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=',
    attribution: '© Mapbox © OpenStreetMap',
  },
  'mapbox-dark': {
    name: 'Escuro',
    url: 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=',
    attribution: '© Mapbox © OpenStreetMap',
  },
  'mapbox-satellite': {
    name: 'Satélite',
    url: 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=',
    attribution: '© Mapbox © OpenStreetMap',
  },
} as const

export type ThemeKey = keyof typeof MAP_THEMES

interface MapThemeContextType {
  mapTheme: ThemeKey
  setMapTheme: (theme: ThemeKey) => void
}

const MapThemeContext = createContext<MapThemeContextType | undefined>(undefined)

export function MapThemeProvider({ children }: { children: ReactNode }) {
  const [mapTheme, setMapTheme] = useState<ThemeKey>('mapbox-custom')

  return (
    <MapThemeContext.Provider value={{ mapTheme, setMapTheme }}>
      {children}
    </MapThemeContext.Provider>
  )
}

export function useMapTheme() {
  const context = useContext(MapThemeContext)
  if (!context) {
    throw new Error('useMapTheme must be used within a MapThemeProvider')
  }
  return context
}
