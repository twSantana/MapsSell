'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { House } from '@/lib/types'
import SidePanel from './SidePanel'
import styles from './AddHouseModal.module.css'

interface Props {
  lat?: number
  lng?: number
  initialData?: House | null
  onClose: () => void
  onSaved: (house: House) => void
  onDeleted?: (houseId: string) => void
}

const OPERADORAS = ['LIGGA', 'NIO', 'TIM']

export default function HousePanel({ lat, lng, initialData, onClose, onSaved, onDeleted }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [address, setAddress] = useState(initialData?.address || '')
  const [isFetchingAddress, setIsFetchingAddress] = useState(false)

  const isEditing = !!initialData

  // Fetch address automatically if creating a new house
  useEffect(() => {
    if (isEditing || !lat || !lng) return

    async function fetchAddress() {
      setIsFetchingAddress(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
        if (!res.ok) throw new Error('Falha ao buscar')
        const data = await res.json()
        
        if (data && data.address) {
          const road = data.address.road || ''
          const houseNumber = data.address.house_number || ''
          const suburb = data.address.suburb || data.address.neighbourhood || ''
          
          const pieces = [road, houseNumber, suburb].filter(Boolean)
          if (pieces.length > 0 && !address) {
            setAddress(pieces.join(', '))
          }
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err)
      } finally {
        setIsFetchingAddress(false)
      }
    }
    
    fetchAddress()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, isEditing])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)

    const payload: any = {
      address: address || null,
      is_client: data.get('is_client') === 'true',
      current_operator: data.get('current_operator') as string || null,
      installation_date: data.get('installation_date') as string || null,
      notes: data.get('notes') as string || null,
    }

    if (!isEditing) {
      payload.lat = lat
      payload.lng = lng
    }

    let result
    if (isEditing) {
      result = await supabase.from('houses').update(payload).eq('id', initialData.id).select().single()
    } else {
      result = await supabase.from('houses').insert(payload).select().single()
    }

    if (result.error) {
      console.error('Supabase Error:', result.error)
      setError('Erro ao salvar casa. Tente novamente.')
      setLoading(false)
      return
    }

    onSaved(result.data as House)
  }

  async function handleDelete() {
    if (!initialData || !onDeleted) return
    if (!confirm('Deseja realmente excluir esta casa?')) return

    setLoading(true)
    const { error: err } = await supabase.from('houses').delete().eq('id', initialData.id)
    if (err) {
      console.error('Supabase Error:', err)
      setError('Erro ao excluir casa.')
      setLoading(false)
      return
    }
    onDeleted(initialData.id)
  }

  const title = isEditing ? '🏠 Editar Casa' : '🏠 Cadastrar Casa'
  const subLat = isEditing ? initialData?.lat : lat
  const subLng = isEditing ? initialData?.lng : lng
  const subtitle = subLat && subLng ? `📍 ${subLat.toFixed(5)}, ${subLng.toFixed(5)}` : undefined

  return (
    <SidePanel title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="form-group">
            <label className="input-label" htmlFor="address">
              Endereço {isFetchingAddress && <sup style={{ color: '#888' }}>(buscando...)</sup>}
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="input"
              placeholder="Rua, número, bairro..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isFetchingAddress}
            />
          </div>

          <div className="form-group">
            <label className="input-label">Status</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input type="radio" name="is_client" value="false" defaultChecked={!initialData?.is_client} />
                <span className={`${styles.radioBtn} ${styles.radioDanger}`}>
                  🔴 Não cliente
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="is_client" value="true" defaultChecked={initialData?.is_client} />
                <span className={`${styles.radioBtn} ${styles.radioSuccess}`}>
                  🟢 Cliente ativo
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="current_operator">Operadora atual</label>
            <select id="current_operator" name="current_operator" className="input" defaultValue={initialData?.current_operator || ''}>
              <option value="">Selecione...</option>
              {OPERADORAS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="installation_date">Data de instalação</label>
            <input
              id="installation_date"
              name="installation_date"
              type="date"
              className="input"
              defaultValue={initialData?.installation_date || ''}
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="notes">Observações</label>
            <textarea
              id="notes"
              name="notes"
              className={`input ${styles.textarea}`}
              placeholder="Informações adicionais..."
              rows={3}
              defaultValue={initialData?.notes || ''}
            />
          </div>

          {error && <p className={styles.error} style={{ marginTop: 'auto' }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : '✅ Salvar Casa'}
          </button>
          
          {isEditing && (
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading} style={{ background: 'transparent', color: '#ff4444', border: '1px solid #ff4444' }}>
              🗑️ Excluir Casa
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
