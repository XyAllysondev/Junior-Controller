# Capricche · Manutenção Elétrica

Sistema web para registrar paradas de máquina, acompanhar o tempo de atendimento por turno
e medir os indicadores clássicos de manutenção (MTTR, MTBF e disponibilidade).

- **Frontend:** React + Vite + TypeScript + Tailwind CSS 4 + Recharts
- **Dados:** no navegador (padrão, sem servidor) ou em banco SQLite/[Turso](https://turso.tech) pela API
- **Backend (opcional):** Node + TypeScript + Express
- **Idioma:** tudo em português, incluindo os nomes das rotas e das colunas

---

## Como rodar na sua máquina

Pré-requisito: **Node.js 20 ou superior** (testado no Node 24).

```bash
git clone https://github.com/XyAllysondev/Junior-Controller.git
cd Junior-Controller

npm install
npm approve-scripts esbuild        # só no npm 11+, libera o binário do esbuild

cp backend/.env.example backend/.env   # PowerShell: Copy-Item backend\.env.example backend\.env
```

O projeto usa **workspaces do npm**: um `npm install` na raiz já instala backend e frontend.

Depois:

```bash
npm run dev:web    # Site em http://localhost:5173
```

Abra <http://localhost:5173>. No modo padrão os dados ficam no navegador — não precisa
subir a API.

Se for usar o **modo servidor**, rode também `npm run dev:api` (porta 3333) e inicie o site
com `VITE_MODO=servidor npm run dev:web`. Nesse caso a API cria o banco, aplica as migrações
e carrega 186 ocorrências de exemplo na primeira requisição.

> No Windows dá para usar o atalho `iniciar.bat`.

---

## Publicar

O sistema guarda os dados de três jeitos possíveis. Ele escolhe sozinho, na seguinte ordem:

| Modo | Quando liga | Os dados ficam | Todos veem o mesmo? |
|---|---|---|---|
| **Supabase** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_KEY` definidas | Banco na nuvem | Sim |
| **Navegador** | padrão, sem configurar nada | localStorage de cada aparelho | Não |
| **Servidor** | `VITE_MODO=servidor` | Banco via a API Express do projeto | Sim |

Em qualquer um deles o site é estático: **não é preciso função no servidor**, porque as contas
dos indicadores acontecem no navegador.

### Modo Supabase (recomendado)

**1. Criar as tabelas.** No Supabase, abra **SQL Editor → New query**, cole o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Dá para rodar mais de uma
vez sem quebrar nada.

**2. Pegar as credenciais.** Em **Project Settings → API**:

- *Project URL* → `VITE_SUPABASE_URL`
- chave **publishable** (ou *anon public*, em projetos antigos) → `VITE_SUPABASE_KEY`

A chave fica visível no navegador — é assim que o Supabase funciona. Quem protege os dados
são as políticas de acesso (RLS) criadas pelo schema. **Nunca use a chave `service_role`.**

**3. Configurar a hospedagem.** Na Netlify (*Site settings → Environment variables*) ou na
Vercel (*Settings → Environment Variables*), cadastre as duas variáveis e mande um novo deploy.
Variável nova só vale a partir do próximo build.

**4. Conferir.** Abra o site: o rodapé deve dizer *"dados sincronizados na nuvem"*.

> **Quem pode mexer.** O schema libera leitura e escrita para qualquer pessoa que tenha o
> endereço do site, sem login. Serve para uma ferramenta interna cujo link não é divulgado,
> mas se o link vazar, qualquer um edita — inclusive apaga. Para exigir login, troque
> `to anon, authenticated` por `to authenticated` nas políticas do schema e ative o
> Supabase Auth.

### Modo navegador

Não precisa de nada: aponte a Netlify ou a Vercel para o repositório e pronto. O
`netlify.toml` / `vercel.json` já traz o comando de build e a pasta de saída.

O limite é que os dados ficam **por aparelho e por navegador** — quem registra uma parada no
computador do escritório não vê esse registro no celular. Por isso a tela de **Cadastros**
mostra o cartão **Backup dos dados**: baixe uma cópia de vez em quando; é também como se leva
o histórico para outra máquina.

### Modo servidor (Express + Turso)

Só se você quiser rodar o backend do projeto. Defina `VITE_MODO=servidor` no site e, na API,
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` e `FUSO_HORARIO=-3`.

> **Vercel:** ela detecta o Express e sugere `backend` como Diretório Raiz — isso quebra o
> deploy. Deixe a **raiz do repositório** (`./`).

O diagnóstico da API fica em `/api/health`, que responde **sem tocar no banco**: mostra se o
Turso está configurado. Faltando as variáveis, as rotas respondem **503** explicando o quê.

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
Junior-Controller/
├── api/
│   └── [[...slug]].ts         função da Vercel: repassa tudo para o Express
├── netlify/
│   └── functions/api.ts       função da Netlify: mesmo app, formato Lambda
├── backend/
│   ├── src/
│   │   ├── app.ts             monta o Express (usado local e nas duas nuvens)
│   │   ├── server.ts          abre a porta (só no modo local)
│   │   ├── db.ts              conexão, migrações, fuso e helpers de consulta
│   │   ├── rota.ts            embrulha handlers async para o Express 4
│   │   ├── seed.ts            dados de exemplo (módulo puro)
│   │   ├── seed-cli.ts        script do npm run seed
│   │   └── routes/
│   │       ├── lookups.ts     CRUD genérico dos 5 cadastros
│   │       ├── ocorrencias.ts lista com filtros + ciclo de vida do chamado
│   │       ├── ta.ts          agregações de tempo de atendimento
│   │       └── indicadores.ts MTTR, MTBF, disponibilidade, Pareto, séries
│   ├── sql/
│   │   ├── schema.sql
│   │   └── patch_ta_turnos.sql
│   └── .env.example
├── frontend/
│   ├── public/                logo, ícone e favicon
│   └── src/
│       ├── pages/             Painel, Ocorrencias, TaTurnos, Cadastros
│       ├── components/        Layout, ui, Filtros, Indicador, gráficos, formulário
│       └── lib/               api, formato, hooks, dados, visual
├── package.json               workspaces + scripts
├── vercel.json                configuração do deploy na Vercel
├── netlify.toml               configuração do deploy na Netlify
└── iniciar.bat                atalho para subir tudo no Windows
```

---

## API

Base: `/api` (mesmo domínio do site em produção; `http://localhost:3333/api` no modo local)

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

As cores da marca ficam em `frontend/src/index.css`, no bloco `@theme`
(`--color-marca-*` e `--color-ouro-*`); a paleta dos gráficos está em
`frontend/src/lib/visual.ts`.

---

## Comandos

```bash
npm install         # instala backend e frontend de uma vez (workspaces)
npm run dev:api     # API com recarga automática
npm run dev:web     # site com recarga automática
npm run build       # compila o frontend para frontend/dist
npm run seed        # recarrega os dados de exemplo
npm run reset       # apaga o banco local e recarrega os exemplos
npm run verificar   # build do frontend + checagem de tipos do backend
```

Para começar do zero no ambiente local, apague `backend/data/` e suba a API de novo.

---

## Adaptando para a sua fábrica

1. **Cadastros → Setores / Máquinas**: apague os exemplos e cadastre os seus.
   Máquinas com histórico ficam inativas em vez de sumir.
2. **Cadastros → Turnos**: ajuste os horários; turnos que viram o dia (22:00 → 06:00) são tratados.
3. **Cadastros → Motivos**: essa lista alimenta o Pareto do painel — quanto mais padronizada, melhor o relatório.
4. **TA por Turno → Meta**: defina o tempo máximo aceitável para a manutenção chegar na máquina.
5. **Disponibilidade**: se a fábrica não roda 24 h, chame `/api/indicadores/resumo?horas_dia=16`
   ou ajuste o padrão em `backend/src/routes/indicadores.ts`.
