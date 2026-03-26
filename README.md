# GeoCRM de Vendas Externas

Sistema web para gestão de vendas em campo com mapa interativo, controle de cobertura por rua e acompanhamento de vendedores em tempo real.

---

## Stack

- **Frontend**: Next.js 14 (App Router + TypeScript)
- **Backend/DB**: Supabase (Auth + PostgreSQL + Realtime)
- **Mapa**: Leaflet + OpenStreetMap

---

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

O arquivo `.env.local` já está configurado. Se precisar alterar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fplesehveccyhfrrryhrx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

### 3. Criar tabelas no Supabase

Acesse o painel do Supabase → **SQL Editor** e execute o arquivo:

```
supabase/schema.sql
```

> Importante: após criar as tabelas, habilite o **Realtime** para a tabela `sellers_locations` em:  
> Database → Replication → selecionar `sellers_locations`

### 4. Criar usuário no Supabase Auth

No painel do Supabase → Authentication → Users → **Invite User** ou **Add User**.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Estrutura de Pastas

```
src/
├── app/
│   ├── (dashboard)/         # Rotas protegidas do dashboard
│   │   ├── page.tsx         # 🗺️ Mapa principal
│   │   ├── casas/           # 🏠 Gestão de casas
│   │   ├── ruas/            # 🛣️ Cobertura por rua
│   │   └── vendedores/      # 👥 Vendedores em campo
│   ├── login/               # Página de login
│   ├── auth/callback/       # Callback OAuth Supabase
│   └── actions.ts           # Server Actions (login/logout)
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx      # Sidebar de navegação
│   └── map/
│       ├── MapView.tsx       # Mapa Leaflet principal
│       └── AddHouseModal.tsx # Modal de cadastro de casas
├── hooks/
│   ├── useGeolocation.ts    # Captura e envia posição do vendedor
│   └── useRealtimeSellers.ts # Escuta posições em tempo real
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Client browser
│   │   └── server.ts        # Client servidor
│   └── types.ts             # Types TypeScript centralizados
└── middleware.ts             # Proteção de rotas
```

---

## Funcionalidades

| Funcionalidade | Status |
|---|---|
| Login com Supabase Auth | ✅ |
| Mapa interativo com OpenStreetMap | ✅ |
| Cadastrar casa clicando no mapa | ✅ |
| Marcadores 🟢 cliente / 🔴 não cliente | ✅ |
| Lista de casas com filtros | ✅ |
| Toggle de status do cliente | ✅ |
| Gestão de ruas e cobertura | ✅ |
| Geolocalização do vendedor | ✅ |
| Localização em tempo real (Realtime) | ✅ |
| Página de vendedores ativos | ✅ |

---

## Banco de Dados

### houses
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| street_id | uuid | FK → streets |
| lat / lng | float | Coordenadas |
| is_client | boolean | Status de cliente |
| address | text | Endereço |
| current_operator | text | Operadora (Claro, Vivo...) |
| installation_date | date | Data de instalação |

### streets
| Campo | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| name / city | text | Nome e cidade |
| has_coverage | boolean | Cobertura disponível |

### sellers_locations
| Campo | Tipo | Descrição |
|---|---|---|
| user_id | uuid | Vendedor (único) |
| lat / lng | float | Posição atual |
| updated_at | timestamp | Última atualização |

---

## Roadmap

- [x] Fase 1: Mapa + casas + marcadores
- [x] Fase 2: Status de cliente + cobertura por rua + login
- [x] Fase 3: Localização em tempo real + visualização de vendedores
- [ ] Fase 4: Heatmap de vendas + rotas inteligentes + métricas
