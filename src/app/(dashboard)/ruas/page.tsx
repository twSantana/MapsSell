'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Street } from '@/lib/types'
import styles from './ruas.module.css'

export default function RuasPage() {
  const supabase = createClient()
  const [streets, setStreets] = useState<Street[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('streets')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setStreets(data)
        setLoading(false)
      })
  }, [supabase])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = e.currentTarget
    const data = new FormData(form)

    const { data: newStreet } = await supabase
      .from('streets')
      .insert({
        name: data.get('name') as string,
        city: data.get('city') as string,
        has_coverage: data.get('has_coverage') === 'true',
      })
      .select()
      .single()

    if (newStreet) {
      setStreets((prev) => [newStreet, ...prev])
      form.reset()
      setShowForm(false)
    }
    setSaving(false)
  }

  async function toggleCoverage(street: Street) {
    const { data } = await supabase
      .from('streets')
      .update({ has_coverage: !street.has_coverage })
      .eq('id', street.id)
      .select()
      .single()
    if (data) setStreets((prev) => prev.map((s) => (s.id === street.id ? data : s)))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cobertura por Rua</h1>
          <p className={styles.subtitle}>
            {streets.filter((s) => s.has_coverage).length} de {streets.length} ruas com cobertura
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nova Rua'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className={styles.form}>
          <div className={styles.formFields}>
            <div className="form-group">
              <label className="input-label">Nome da rua</label>
              <input name="name" required className="input" placeholder="Rua das Flores" />
            </div>
            <div className="form-group">
              <label className="input-label">Cidade</label>
              <input name="city" required className="input" placeholder="São Paulo" />
            </div>
            <div className="form-group">
              <label className="input-label">Cobertura</label>
              <select name="has_coverage" className="input">
                <option value="false">Sem cobertura</option>
                <option value="true">Com cobertura</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      )}

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : streets.length === 0 ? (
        <div className={styles.empty}>Nenhuma rua cadastrada ainda.</div>
      ) : (
        <div className={styles.list}>
          {streets.map((street) => (
            <div key={street.id} className={`${styles.item} ${street.has_coverage ? styles.covered : ''}`}>
              <div>
                <p className={styles.streetName}>{street.name}</p>
                <p className={styles.city}>{street.city}</p>
              </div>
              <div className={styles.itemRight}>
                <span className={`badge ${street.has_coverage ? 'badge-success' : 'badge-danger'}`}>
                  {street.has_coverage ? '🟢 Com cobertura' : '🔴 Sem cobertura'}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleCoverage(street)}
                >
                  Alternar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
