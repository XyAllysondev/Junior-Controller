-- =====================================================================
-- Capricche - Manutencao Eletrica
-- Esquema para o Supabase (PostgreSQL)
--
-- Como usar: Supabase -> SQL Editor -> New query -> cole tudo -> Run.
-- Pode rodar mais de uma vez sem quebrar nada.
--
-- Observacao sobre datas: usamos "timestamp" (sem fuso) de proposito.
-- O sistema grava a hora do relogio da fabrica, do mesmo jeito que a
-- pessoa digitou. Com "timestamptz" o banco converteria para UTC e os
-- horarios apareceriam 3h adiantados.
--
-- Observacao sobre 0/1: as colunas "ativo" e "parou_producao" sao
-- smallint valendo 0 ou 1, e nao boolean, para o formato ficar igual ao
-- que as telas ja esperam.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------
create table if not exists setores (
  id        bigint generated always as identity primary key,
  nome      text    not null unique,
  ativo     smallint not null default 1,
  criado_em timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

create table if not exists maquinas (
  id          bigint generated always as identity primary key,
  codigo      text    not null unique,
  nome        text    not null,
  setor_id    bigint  references setores(id) on delete set null,
  criticidade text    not null default 'Media'
              check (criticidade in ('Baixa','Media','Alta')),
  ativo       smallint not null default 1,
  criado_em   timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

create table if not exists motivos (
  id        bigint generated always as identity primary key,
  nome      text    not null unique,
  categoria text    not null default 'Mecanica'
            check (categoria in ('Mecanica','Eletrica','Hidraulica','Pneumatica',
                                 'Automacao','Operacional','Qualidade','Setup','Outros')),
  ativo     smallint not null default 1,
  criado_em timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

create table if not exists tecnicos (
  id            bigint generated always as identity primary key,
  nome          text    not null,
  matricula     text    unique,
  especialidade text,
  ativo         smallint not null default 1,
  criado_em     timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

create table if not exists turnos (
  id          bigint generated always as identity primary key,
  nome        text    not null unique,
  hora_inicio text    not null,          -- 'HH:MM'
  hora_fim    text    not null,          -- 'HH:MM' (pode virar o dia: 22:00 -> 06:00)
  ativo       smallint not null default 1,
  criado_em   timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

-- ---------------------------------------------------------------------
-- Ocorrencias (paradas / chamados)
--
--   aberto_em   -> maquina parou / chamado registrado
--   atendido_em -> manutencao chegou na maquina
--   fim_em      -> maquina liberada para producao
--
--   TA   = atendido_em - aberto_em
--   MTTR = fim_em      - atendido_em
-- ---------------------------------------------------------------------
create table if not exists ocorrencias (
  id             bigint generated always as identity primary key,
  maquina_id     bigint not null references maquinas(id) on delete restrict,
  motivo_id      bigint references motivos(id)  on delete set null,
  tecnico_id     bigint references tecnicos(id) on delete set null,
  turno_id       bigint references turnos(id)   on delete set null,

  tipo           text not null default 'Corretiva'
                 check (tipo in ('Corretiva','Preventiva','Preditiva','Melhoria')),
  prioridade     text not null default 'Media'
                 check (prioridade in ('Baixa','Media','Alta','Critica')),
  status         text not null default 'Aberta'
                 check (status in ('Aberta','Em atendimento','Concluida','Cancelada')),

  descricao      text not null,
  solucao        text,
  parou_producao smallint not null default 1,

  aberto_em      timestamp not null default (now() at time zone 'America/Sao_Paulo'),
  atendido_em    timestamp,
  fim_em         timestamp,

  criado_em      timestamp not null default (now() at time zone 'America/Sao_Paulo'),
  atualizado_em  timestamp not null default (now() at time zone 'America/Sao_Paulo')
);

create index if not exists idx_ocorrencias_maquina  on ocorrencias(maquina_id);
create index if not exists idx_ocorrencias_status   on ocorrencias(status);
create index if not exists idx_ocorrencias_abertura on ocorrencias(aberto_em);
create index if not exists idx_ocorrencias_turno    on ocorrencias(turno_id);
create index if not exists idx_maquinas_setor       on maquinas(setor_id);

-- ---------------------------------------------------------------------
-- Cadastros que sao iguais em qualquer fabrica
-- ---------------------------------------------------------------------
insert into turnos (nome, hora_inicio, hora_fim) values
  ('1º Turno', '06:00', '14:00'),
  ('2º Turno', '14:00', '22:00'),
  ('3º Turno', '22:00', '06:00')
on conflict (nome) do nothing;

insert into motivos (nome, categoria) values
  ('Rolamento danificado',             'Mecanica'),
  ('Correia rompida',                  'Mecanica'),
  ('Desalinhamento de eixo',           'Mecanica'),
  ('Lubrificação programada',          'Mecanica'),
  ('Sensor com falha',                 'Automacao'),
  ('Inversor de frequência em alarme', 'Eletrica'),
  ('Curto no painel',                  'Eletrica'),
  ('Vazamento hidráulico',             'Hidraulica'),
  ('Pressão de ar insuficiente',       'Pneumatica'),
  ('Cilindro pneumático travado',      'Pneumatica'),
  ('Falha de operação',                'Operacional'),
  ('Troca de ferramental',             'Setup'),
  ('Ajuste de qualidade',              'Qualidade')
on conflict (nome) do nothing;

-- =====================================================================
-- Seguranca (RLS)
--
-- O Supabase exige politicas explicitas: com RLS ligada e nenhuma
-- politica, ninguem le nada.
--
-- A divisao e:
--   qualquer pessoa (anon)  -> ver tudo, registrar parada, atender,
--                              concluir e editar ocorrencia
--   administrador logado    -> mexer nos cadastros e apagar registros
--
-- Isto e a trava de verdade: quem barra e o Postgres, nao a tela.
-- Esconder botoes no site e so conveniencia.
--
-- Para o login funcionar, crie UM usuario em
-- Authentication -> Users -> Add user (marque "Auto Confirm User").
-- =====================================================================
alter table setores     enable row level security;
alter table maquinas    enable row level security;
alter table motivos     enable row level security;
alter table tecnicos    enable row level security;
alter table turnos      enable row level security;
alter table ocorrencias enable row level security;

do $$
declare
  t text;
  tabelas text[] := array['setores','maquinas','motivos','tecnicos','turnos','ocorrencias'];
begin
  -- Limpa politicas de versoes anteriores, para este arquivo poder rodar
  -- de novo sem duplicar nada.
  foreach t in array tabelas loop
    execute format('drop policy if exists %I on %I', 'acesso_total_' || t, t);
    execute format('drop policy if exists %I on %I', 'ler_' || t, t);
    execute format('drop policy if exists %I on %I', 'admin_inserir_' || t, t);
    execute format('drop policy if exists %I on %I', 'admin_atualizar_' || t, t);
    execute format('drop policy if exists %I on %I', 'admin_apagar_' || t, t);
    execute format('drop policy if exists %I on %I', 'todos_inserir_' || t, t);
    execute format('drop policy if exists %I on %I', 'todos_atualizar_' || t, t);
  end loop;

  -- Leitura: liberada para todos, em todas as tabelas.
  foreach t in array tabelas loop
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      'ler_' || t, t
    );
  end loop;

  -- Cadastros: so administrador escreve.
  foreach t in array array['setores','maquinas','motivos','tecnicos','turnos'] loop
    execute format(
      'create policy %I on %I for insert to authenticated with check (true)',
      'admin_inserir_' || t, t
    );
    execute format(
      'create policy %I on %I for update to authenticated using (true) with check (true)',
      'admin_atualizar_' || t, t
    );
    execute format(
      'create policy %I on %I for delete to authenticated using (true)',
      'admin_apagar_' || t, t
    );
  end loop;
end $$;

-- Ocorrencias: o chao de fabrica registra e atualiza sem login.
-- Apagar continua sendo do administrador, porque some com o historico.
create policy todos_inserir_ocorrencias   on ocorrencias for insert to anon, authenticated with check (true);
create policy todos_atualizar_ocorrencias on ocorrencias for update to anon, authenticated using (true) with check (true);
create policy admin_apagar_ocorrencias    on ocorrencias for delete to authenticated using (true);
