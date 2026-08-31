# Capricche · Manutenção Elétrica

Sistema web para registrar paradas de máquina, acompanhar o tempo de atendimento por turno
e medir os indicadores clássicos de manutenção (MTTR, MTBF e disponibilidade).

- **Backend:** Node + TypeScript + Express + SQLite (`better-sqlite3`)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS 4 + Recharts
- **Idioma:** tudo em português, incluindo os nomes das rotas e das colunas

---

## Como rodar

Pré-requisito: **Node.js 20 ou superior** (testado no Node 24).

### 1. Backend

```bash
cd app-manutencao/backend
npm install
npm approve-scripts better-sqlite3 esbuild   # só no npm 11+, libera os binários nativos
cp .env.example .env                          # no PowerShell: Copy-Item .env.example .env
npm run dev
```

A API sobe em <http://localhost:3333>. Na primeira execução ela:

1. cria o arquivo `data/manutencao.db`;
2. aplica `sql/schema.sql` e `sql/patch_ta_turnos.sql`;
3. carrega dados de exemplo (12 máquinas e 180 ocorrências) para as telas já abrirem com gráficos.

Teste rápido: <http://localhost:3333/api/health>

### 2. Frontend

Em **outro terminal**:

```bash
cd app-manutencao/frontend
npm install
npm approve-scripts esbuild
npm run dev
```

Abra <http://localhost:5173>.

> No Windows você pode usar o atalho `iniciar.bat` na raiz do projeto: ele abre os dois
> terminais de uma vez.

### 3. Publicar (opcional)

```bash
cd frontend && npm run build      # gera frontend/dist
cd ../backend && npm run build && npm start
```

Quando `frontend/dist` existe, o Express passa a servir a interface junto com a API —
tudo em <http://localhost:3333>, em um único processo.

---

## Telas

| Tela | O que faz |
|---|---|
| **Painel** | Disponibilidade, MTTR, MTBF, TA médio, evolução das paradas, Pareto dos motivos, ranking de máquinas e chamados em aberto. |
| **Ocorrências** | Lista com busca e filtros, cadastro de parada, botões **Atender** e **Concluir**, edição e exclusão. |
| **TA por Turno** | Tempo de atendimento comparado entre turnos, meta configurável, evolução diária, desempenho por técnico e piores atendimentos. |
| **Cadastros** | Máquinas, setores, motivos, técnicos e turnos. |

Detalhes de uso: tema claro/escuro com a preferência salva, navegação por teclado com foco
visível, layout que funciona no celular (as tabelas viram cartões), e mensagens de erro em
linguagem direta.

---

## Como os indicadores são calculados

Cada ocorrência tem três marcos de tempo:

```
aberto_em ──── TA ────► atendido_em ──── reparo ────► fim_em
└──────────────── parada total ─────────────────────────┘
```

- **TA (Tempo de Atendimento)** = `atendido_em − aberto_em` — quanto a manutenção demorou para chegar na máquina.
- **MTTR** = média de `fim_em − atendido_em` — tempo médio de reparo.
- **Disponibilidade** = `(horas programadas − horas paradas) / horas programadas`.
  As horas programadas são `dias do período × horas_dia × máquinas ativas`. O parâmetro
  `horas_dia` vale 24 por padrão; passe `?horas_dia=16` na API para fábricas de 2 turnos.
- **MTBF** = `horas operando / número de corretivas`.

Só entram no cálculo de horas paradas as ocorrências com **"A produção ficou parada"** marcado.

---

## Estrutura

```
app-manutencao/
├── backend/
│   ├── src/
│   │   ├── server.ts          Express, CORS, migrações, arquivos estáticos
│   │   ├── db.ts              conexão SQLite, executor de migrações, helpers de data/turno
│   │   ├── seed.ts            dados de exemplo (npm run seed)
│   │   └── routes/
│   │       ├── lookups.ts     CRUD genérico dos 5 cadastros
│   │       ├── ocorrencias.ts lista com filtros + ciclo de vida do chamado
│   │       ├── ta.ts          agregações de tempo de atendimento
│   │       └── indicadores.ts MTTR, MTBF, disponibilidade, Pareto, séries
│   ├── sql/
│   │   ├── schema.sql
│   │   └── patch_ta_turnos.sql
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/             Painel, Ocorrencias, TaTurnos, Cadastros
    │   ├── components/        Layout, ui, Filtros, Indicador, gráficos, formulário
    │   └── lib/               api, formato, hooks, dados, visual
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## API

Base: `http://localhost:3333/api`

### Cadastros — `/lookups`

`:tabela` é um de `setores`, `maquinas`, `motivos`, `tecnicos`, `turnos`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/lookups` | Todos os cadastros de uma vez (`?ativos=1` filtra os ativos) |
| GET | `/lookups/:tabela` | Lista uma tabela |
| POST | `/lookups/:tabela` | Cria |
| PUT | `/lookups/:tabela/:id` | Atualiza |
| DELETE | `/lookups/:tabela/:id` | Exclui — ou apenas **inativa**, se o registro já tiver histórico |

### Ocorrências — `/ocorrencias`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/ocorrencias` | Filtros: `status`, `maquina_id`, `setor_id`, `motivo_id`, `tecnico_id`, `turno_id`, `tipo`, `prioridade`, `de`, `ate`, `busca`, `abertas`, `pagina`, `porPagina` |
| GET | `/ocorrencias/:id` | Uma ocorrência com os tempos calculados |
| POST | `/ocorrencias` | Cria (o turno é deduzido do horário de abertura) |
| PUT | `/ocorrencias/:id` | Atualiza |
| POST | `/ocorrencias/:id/atender` | Marca o início do atendimento |
| POST | `/ocorrencias/:id/concluir` | Fecha o chamado e libera a máquina |
| POST | `/ocorrencias/:id/reabrir` | Reabre um chamado concluído |
| DELETE | `/ocorrencias/:id` | Exclui |

### TA por turno — `/ta`

`/ta/resumo`, `/ta/serie`, `/ta/tecnicos`, `/ta/piores` — todos aceitam
`de`, `ate`, `setor_id`, `maquina_id`, `turno_id`, `tipo` e `meta` (minutos, padrão 15).

### Indicadores — `/indicadores`

`/indicadores/resumo`, `/por-maquina`, `/pareto`, `/serie`, `/distribuicao` — aceitam
`de`, `ate`, `setor_id`, `maquina_id`, `turno_id`, `horas_dia` e `limite`.

---

## Comandos úteis

```bash
# backend
npm run dev      # servidor com recarga automática
npm run seed     # recarrega os dados de exemplo
npm run build    # compila para dist/
npm start        # roda o compilado

# frontend
npm run dev      # Vite com proxy de /api para a porta 3333
npm run build    # gera dist/
npm run preview  # serve o dist localmente
```

Para começar do zero, apague `backend/data/manutencao.db` e suba o servidor de novo.

---

## Identidade visual

O visual é derivado do logo da Capricche:

| Elemento do logo | Cor | Onde aparece |
|---|---|---|
| Vermelho do coração | `#d91f17` (`marca-600`) | Menu lateral, botão principal, barras dos gráficos |
| Dourado da fita | `#c0821a` (`ouro-600`) | Avisos, etiqueta "Aberta", linhas de tendência |
| Branco do contorno | `#ffffff` | Item ativo do menu, cartões |

O vermelho da marca fica reservado à identidade. Nas etiquetas de estado a gravidade sobe
numa escala própria — cinza → dourado → laranja → vermelho — para que **Crítica** continue
saltando aos olhos mesmo num sistema todo vermelho.

### Trocar o logo

São três arquivos em `frontend/public/`:

| Arquivo | Tamanho | Onde aparece |
|---|---|---|
| `logo-capricche.jpg` | 660×712 | Marca completa (coração + placa) no topo do menu lateral |
| `logo-icone.jpg` | 256×256 | Só o coração, na barra do topo no celular |
| `favicon.png` | 128×128 | Ícone da aba do navegador |

Substitua mantendo os nomes. Os três têm **fundo branco**, e a placa que fica atrás do logo
também é branca — por isso não aparece emenda entre a imagem e o quadro.

O logo fica sobre uma placa branca de propósito: o coração é vermelho e o menu lateral
também, então sem esse fundo claro a marca se perderia no degradê. Se um dia usar um logo
claro, dá para tirar o `bg-white` em `frontend/src/components/Layout.tsx`, na função
`MarcaCompleta`.

As cores da marca ficam todas em `frontend/src/index.css`, no bloco `@theme`
(`--color-marca-*` e `--color-ouro-*`); a paleta dos gráficos está em
`frontend/src/lib/visual.ts`.

---

## Adaptando para a sua fábrica

1. **Cadastros → Setores / Máquinas**: apague os exemplos e cadastre os seus.
   Máquinas com histórico ficam inativas em vez de sumir.
2. **Cadastros → Turnos**: ajuste os horários; turnos que viram o dia (22:00 → 06:00) são tratados.
3. **Cadastros → Motivos**: essa lista alimenta o Pareto do painel — quanto mais padronizada, melhor o relatório.
4. **TA por Turno → Meta**: defina o tempo máximo aceitável para a manutenção chegar na máquina.
5. **Disponibilidade**: se a fábrica não roda 24 h, chame `/api/indicadores/resumo?horas_dia=16`
   ou ajuste o padrão em `backend/src/routes/indicadores.ts`.

## Migrando para outro banco

O SQLite guarda tudo em um único arquivo, o que é ótimo para começar, mas serializa as
escritas — se vários terminais forem registrar paradas ao mesmo tempo, vale trocar por
PostgreSQL. As consultas usam `julianday()` e `strftime()`, então a migração concentra-se
em `src/db.ts` e nas funções de data das rotas.
