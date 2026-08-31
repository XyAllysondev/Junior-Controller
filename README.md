# Capricche · Manutenção Elétrica

Sistema web para registrar paradas de máquina, acompanhar o tempo de atendimento por turno
e medir os indicadores clássicos de manutenção (MTTR, MTBF e disponibilidade).

- **Backend:** Node + TypeScript + Express
- **Banco:** SQLite — arquivo local no desenvolvimento, [Turso](https://turso.tech) na nuvem
- **Frontend:** React + Vite + TypeScript + Tailwind CSS 4 + Recharts
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

Depois, em dois terminais:

```bash
npm run dev:api    # API em http://localhost:3333
npm run dev:web    # Site em http://localhost:5173
```

Abra <http://localhost:5173>.

> No Windows dá para usar o atalho `iniciar.bat`, que instala tudo e abre os dois terminais.

Na primeira requisição a API cria o banco, aplica as migrações e carrega 186 ocorrências de
exemplo, para as telas já abrirem com gráficos preenchidos.

---

## Publicar (Vercel ou Netlify)

O projeto está configurado para as duas — escolha uma. Em qualquer caso, o passo 1 (banco)
é obrigatório: as duas rodam funções em disco efêmero, onde um arquivo SQLite seria apagado.

### 1. Criar o banco no Turso

Não dá para usar arquivo SQLite nessas plataformas: as funções rodam em disco efêmero e tudo que for
gravado desaparece. O Turso resolve isso hospedando o mesmo SQLite — nenhuma consulta do
projeto precisou ser reescrita.

```bash
# instale o CLI: https://docs.turso.tech/cli/installation
turso auth signup
turso db create manutencao-capricche

turso db show manutencao-capricche --url      # -> libsql://...
turso db tokens create manutencao-capricche   # -> eyJhbGciOi...
```

Guarde os dois valores.

### 2a. Vercel

> **Atenção ao Diretório Raiz.** A Vercel detecta o Express e sugere `backend` — isso quebra
> o deploy, porque ela passa a procurar o `vercel.json` dentro dessa pasta e ignora o `api/`
> e o `frontend/`. Em **Diretório Raiz**, clique em *Editar* e deixe a **raiz do repositório**
> (`./`).

Deixe as configurações de build como estão: o `vercel.json` já define o comando
(`npm run build --workspace frontend`), a pasta de saída (`frontend/dist`) e a função da API.

### 2b. Netlify

Ao importar, a Netlify lê o `netlify.toml` e já preenche tudo: comando de build, pasta
publicada (`frontend/dist`) e a pasta de funções (`netlify/functions`). Não é preciso mexer
em nada na tela de importação.

### 3. Variáveis de ambiente (nas duas)

| Chave | Valor |
|---|---|
| `TURSO_DATABASE_URL` | a URL `libsql://...` do passo 1 |
| `TURSO_AUTH_TOKEN` | o token do passo 1 |
| `FUSO_HORARIO` | `-3` (horário de Brasília) |
| `SEED_ON_EMPTY` | `true` no primeiro deploy; depois troque para `false` |

Não leve `PORT`, `DB_FILE` nem `CORS_ORIGIN` para produção: as duas primeiras são ignoradas
quando o Turso está configurado, e a terceira aponta para `localhost`.

### 4. Depois do primeiro deploy

O banco sobe com os dados de exemplo. Quando cadastrar as máquinas de verdade:

1. Apague as ocorrências e os cadastros de exemplo pela própria tela de Cadastros.
2. Mude `SEED_ON_EMPTY` para `false` e faça um novo deploy — assim, se um dia o banco
   ficar vazio, o sistema não volta a inventar dados.

### Por que `FUSO_HORARIO` existe

Servidor na nuvem roda em UTC. Sem esse ajuste, um chamado aberto às 14h apareceria como 17h.
O valor é o deslocamento em horas; `-3` cobre o Brasil inteiro o ano todo, já que o horário
de verão foi extinto em 2019.

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
