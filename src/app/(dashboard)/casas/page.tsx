'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { House } from '@/lib/types'
import styles from './casas.module.css'

export default function CasasPage() {
  const supabase = createClient()
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'client' | 'non-client'>('all')

  useEffect(() => {
    supabase
      .from('houses')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setHouses(data)
        setLoading(false)
      })
  }, [supabase])

  async function toggleClient(house: House) {
    const { data } = await supabase
      .from('houses')
      .update({ is_client: !house.is_client })
      .eq('id', house.id)
      .select()
      .single()
    if (data) {
      setHouses((prev) => prev.map((h) => (h.id === house.id ? data : h)))
    }
  }

  async function deleteHouse(id: string) {
    await supabase.from('houses').delete().eq('id', id)
    setHouses((prev) => prev.filter((h) => h.id !== id))
  }

  const filtered = houses.filter((h) => {
    if (filter === 'client') return h.is_client
    if (filter === 'non-client') return !h.is_client
    return true
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Casas Cadastradas</h1>
          <p className={styles.subtitle}>{houses.length} casas · {houses.filter((h) => h.is_client).length} clientes</p>
        </div>
        <div className={styles.filters}>
          {(['all', 'client', 'non-client'] as const).map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todas' : f === 'client' ? '🟢 Clientes' : '🔴 Não clientes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Nenhuma casa encontrada.</p>
          <p className="text-sm text-muted">Clique no mapa para cadastrar uma.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((house) => (
            <div key={house.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={`badge ${house.is_client ? 'badge-success' : 'badge-danger'}`}>
                  {house.is_client ? '✅ Cliente' : '❌ Não cliente'}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteHouse(house.id)}
                  title="Remover"
                >
                  🗑️
                </button>
              </div>
              <p className={styles.address}>{house.address || 'Endereço não informado'}</p>
              <p className={styles.meta}>
                📍 {house.lat.toFixed(4)}, {house.lng.toFixed(4)}
              </p>
              {house.current_operator && (
                <p className={styles.meta}>📡 {house.current_operator}</p>
              )}
              {house.installation_date && (
                <p className={styles.meta}>
                  📅 {new Date(house.installation_date).toLocaleDateString('pt-BR')}
                </p>
              )}
              {house.notes && (
                <p className={styles.notes}>{house.notes}</p>
              )}
              <button
                className={`btn btn-sm btn-full ${styles.toggleBtn}`}
                onClick={() => toggleClient(house)}
                style={{ marginTop: '10px', background: house.is_client ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: house.is_client ? '#ef4444' : '#22c55e', border: `1px solid ${house.is_client ? '#ef4444' : '#22c55e'}` }}
              >
                {house.is_client ? 'Marcar como não cliente' : 'Marcar como cliente'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
