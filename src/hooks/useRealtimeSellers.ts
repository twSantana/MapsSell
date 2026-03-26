'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SellerLocation } from '@/lib/types'

export function useRealtimeSellers() {
  const supabase = createClient()
  const [sellers, setSellers] = useState<SellerLocation[]>([])

  useEffect(() => {
    // Carregamento inicial
    supabase
      .from('sellers_locations')
      .select('*')
      .then(({ data }) => {
        if (data) setSellers(data)
      })

    // Canal Realtime para atualizações automáticas
    const channel = supabase
      .channel('realtime:sellers_locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sellers_locations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSellers((prev) => [...prev, payload.new as SellerLocation])
          } else if (payload.eventType === 'UPDATE') {
            setSellers((prev) =>
              prev.map((s) =>
                s.user_id === (payload.new as SellerLocation).user_id
                  ? (payload.new as SellerLocation)
                  : s
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setSellers((prev) =>
              prev.filter((s) => s.id !== (payload.old as SellerLocation).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return sellers
}
