-- =====================================================================
-- Capricche - FCA (Falha, Causa, Acao) nas paradas de linha
--
-- Quando a ocorrencia marca "Houve parada de linha?", o formulario pede:
--   F = Falha -> coluna descricao (ja existia)
--   C = Causa -> coluna causa      (nova, criada aqui)
--   A = Acao  -> coluna solucao    (ja existia)
--
-- Como usar: Supabase -> SQL Editor -> New query -> cole tudo -> Run.
-- Pode rodar mais de uma vez sem quebrar nada.
-- =====================================================================
alter table ocorrencias add column if not exists causa text;

-- Faz a API (PostgREST) enxergar a coluna nova na hora.
notify pgrst, 'reload schema';
