'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Intervalo de atualização da posição (ms)
const UPDATE_INTERVAL_MS = 8000

export function useGeolocation(userId: string | undefined) {
  const supabase = createClient()
  const lastUpdateRef = useRef<number>(0)
  const watchIdRef = useRef<number | null>(null)

  const updateLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!userId) return

      const now = Date.now()
      if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return
      lastUpdateRef.current = now

      await supabase.from('sellers_locations').upsert(
        { user_id: userId, lat, lng, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    },
    [userId, supabase]
  )

  useEffect(() => {
    if (!userId || !navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude)
      },
      (error) => console.warn('Geolocalização:', error.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [userId, updateLocation])
}
