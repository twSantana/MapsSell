-- ============================================
-- GeoCRM de Vendas Externas — Schema Supabase
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Tabela de ruas e cobertura
create table if not exists streets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  has_coverage boolean default false,
  operator text,          -- Operadora disponível na rua
  lat_start float,        -- Coordenadas do segmento desenhado
  lng_start float,
  lat_end float,
  lng_end float,
  created_at timestamp with time zone default now()
);

-- Migration: adicionar colunas novas em tabela já existente (execute se necessário)
-- alter table streets add column if not exists city text;
-- alter table streets add column if not exists operator text;
-- alter table streets add column if not exists lat_start float;
-- alter table streets add column if not exists lng_start float;
-- alter table streets add column if not exists lat_end float;
-- alter table streets add column if not exists lng_end float;
-- alter table streets add column if not exists route_geometry jsonb;


-- Tabela de casas cadastradas no mapa
create table if not exists houses (
  id uuid primary key default gen_random_uuid(),
  street_id uuid references streets(id) on delete set null,
  address text,
  lat float not null,
  lng float not null,
  is_client boolean default false,
  installation_date date,
  current_operator text,
  notes text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

-- Tabela de localização em tempo real dos vendedores
create table if not exists sellers_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lat float not null,
  lng float not null,
  updated_at timestamp with time zone default now()
);

-- Índice para buscas por user_id na tabela de localizações
create unique index if not exists sellers_locations_user_id_idx on sellers_locations(user_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Habilitar RLS
alter table streets enable row level security;
alter table houses enable row level security;
alter table sellers_locations enable row level security;

-- Política: qualquer usuário autenticado pode ler ruas e casas
create policy "Leitura pública de ruas" on streets
  for select to authenticated using (true);

-- Política: o vendedor só pode ver suas próprias casas, E os clientes finalizados de outros vendedores (is_client = true)
create policy "Visualização restrita de casas" on houses
  for select to authenticated using (user_id = auth.uid() OR is_client = true);

create policy "Leitura pública de vendedores" on sellers_locations
  for select to authenticated using (true);

-- Política: qualquer usuário autenticado pode inserir/atualizar casas e ruas
create policy "Inserir casas" on houses
  for insert to authenticated with check (true);

create policy "Atualizar próprias casas" on houses
  for update to authenticated using (user_id = auth.uid());

create policy "Inserir ruas" on streets
  for insert to authenticated with check (true);

create policy "Atualizar ruas" on streets
  for update to authenticated using (true);

-- Política: vendedor só atualiza sua própria localização
create policy "Inserir localização" on sellers_locations
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Atualizar localização própria" on sellers_locations
  for update to authenticated using (auth.uid() = user_id);

-- Política: qualquer usuário pode deletar casas e ruas
create policy "Deletar próprias casas" on houses
  for delete to authenticated using (user_id = auth.uid());

create policy "Deletar ruas" on streets
  for delete to authenticated using (true);

-- ============================================
-- Habilitar Realtime nas tabelas
-- ============================================
-- No painel do Supabase, vá em Database > Replication
-- e habilite as tabelas para realtime.
-- OU execute:
-- alter publication supabase_realtime add table sellers_locations;
-- alter publication supabase_realtime add table houses;
-- alter publication supabase_realtime add table streets;
