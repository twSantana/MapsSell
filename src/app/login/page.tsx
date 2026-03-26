'use client'

import { useState } from 'react'
import { login } from '@/app/actions'
import styles from './login.module.css'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
      </div>

      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>📍</span>
          <div>
            <h1 className={styles.logoTitle}>GeoCRM</h1>
            <p className={styles.logoSub}>Vendas Externas</p>
          </div>
        </div>

        <p className={styles.welcome}>Bem-vindo de volta</p>

        <form action={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="input-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary btn-full ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.footer}>
          GeoCRM © 2026 — Sistema de Vendas Externas
        </p>
      </div>
    </div>
  )
}
