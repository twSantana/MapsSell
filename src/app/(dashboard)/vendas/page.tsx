import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import styles from './Vendas.module.css'

export default async function VendasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Calcular início e fim do mês atual
  const date = new Date()
  const currentMonthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
  const currentMonthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // Buscar casas (vendas) do usuário que são clientes, cadastradas neste mês
  const { data: sales, error } = await supabase
    .from('houses')
    .select('*')
    .eq('is_client', true)
    .eq('user_id', user.id)
    .gte('created_at', currentMonthStart)
    .lte('created_at', currentMonthEnd)
    .order('created_at', { ascending: false })

  const salesCount = sales?.length || 0

  // Conta vendas passadas (opcional, só para saber o acumulado geral histórico)
  const { count: allTimeCount } = await supabase
    .from('houses')
    .select('*', { count: 'exact', head: true })
    .eq('is_client', true)
    .eq('user_id', user.id)

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const currentMonthName = monthNames[date.getMonth()]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Painel de Vendas</h1>
        <p>Acompanhe suas estatísticas de conversão</p>
      </header>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>Vendas • {currentMonthName}</div>
          <div className={styles.metricValue}>{salesCount}</div>
          <div className={styles.metricSubtitle}>Casas cadastradas como cliente (Este mês)</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>Total Acumulado</div>
          <div className={styles.metricValue} style={{ color: 'var(--color-text)' }}>{allTimeCount || 0}</div>
          <div className={styles.metricSubtitle}>Histórico desde o início</div>
        </div>
      </div>

      <section className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2>Suas Vendas Recentes ({currentMonthName})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr style={{ borderBottomColor: 'var(--color-border)' }}>
                <th>Data</th>
                <th>Endereço</th>
                <th>Operadora</th>
              </tr>
            </thead>
            <tbody>
              {sales && sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottomColor: 'var(--color-border)' }}>
                    <td>
                      {new Date(sale.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td>{sale.address || 'Sem endereço'}</td>
                    <td>
                      <span className="badge badge-sm badge-info">
                        {sale.current_operator || 'Não definido'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-8">
                    Nenhuma venda registrada neste mês ainda. Que tal mapear alguns prospectos?
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
