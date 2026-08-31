import { useState } from 'react';
import { Clock3, Gauge, Target, Timer, TriangleAlert, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Filtros, filtrosPadrao, type FiltrosPeriodo } from '../components/Filtros';
import { TituloPagina } from '../components/Layout';
import { Indicador, IndicadorEsqueleto } from '../components/Indicador';
import { DicaGrafico, ResumoAcessivel, SemDados } from '../components/graficos';
import { Alerta, Botao, Cartao, cx, Entrada, Etiqueta } from '../components/ui';
import { api, type LinhaTaTecnico, type PiorTa, type ResumoTa, type SerieTa } from '../lib/api';
import { useApi, useTema } from '../lib/hooks';
import * as fmt from '../lib/formato';
import { CORES_GRAFICO, COR_MARCA, eixos, TOM_PRIORIDADE } from '../lib/visual';

type DadosTa = {
  resumo: ResumoTa;
  serie: SerieTa;
  tecnicos: { meta: number; itens: LinhaTaTecnico[] };
  piores: { itens: PiorTa[] };
};

/** Verde >= 80%, amarelo >= 60%, vermelho abaixo disso. */
function tomAderencia(valor: number) {
  return valor >= 80 ? 'sucesso' : valor >= 60 ? 'alerta' : 'perigo';
}

export function TaTurnos() {
  const [filtros, setFiltros] = useState<FiltrosPeriodo>(() => filtrosPadrao(30));
  const [meta, setMeta] = useState(15);
  const { escuro } = useTema();
  const cor = eixos(escuro);

  const consulta = { ...filtros, meta };
  const { dados, carregando, erro, recarregar } = useApi<DadosTa>(async () => {
    const [resumo, serie, tecnicos, piores] = await Promise.all([
      api.get<ResumoTa>('/ta/resumo', consulta),
      api.get<SerieTa>('/ta/serie', consulta),
      api.get<{ meta: number; itens: LinhaTaTecnico[] }>('/ta/tecnicos', consulta),
      api.get<{ itens: PiorTa[] }>('/ta/piores', { ...consulta, limite: 8 }),
    ]);
    return { resumo, serie, tecnicos, piores };
  }, JSON.stringify(consulta));

  const piorTurno = dados?.resumo.itens.reduce<null | (typeof dados.resumo.itens)[number]>(
    (pior, atual) => (!pior || (atual.ta_medio ?? 0) > (pior.ta_medio ?? 0) ? atual : pior),
    null,
  );

  const serieGrafico = (dados?.serie.itens ?? []).map((p) => ({
    ...p,
    rotulo: fmt.diaCurto(p.dia),
  }));

  return (
    <>
      <TituloPagina
        titulo="TA por turno"
        descricao="Tempo de Atendimento: quanto a manutenção leva, desde a abertura do chamado, para chegar na máquina. Compare os turnos e acompanhe a meta."
      />

      <Filtros
        valores={filtros}
        aoMudar={setFiltros}
        extra={
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Meta de TA (minutos)
            </span>
            <Entrada
              type="number"
              min={1}
              max={480}
              value={meta}
              onChange={(e) => setMeta(Math.max(Number(e.target.value) || 1, 1))}
              aria-label="Meta de tempo de atendimento em minutos"
            />
          </label>
        }
      />

      {erro && (
        <div className="mb-6">
          <Alerta titulo="Erro ao carregar os dados de TA">
            <p>{erro}</p>
            <Botao variante="secundario" tamanho="pequeno" className="mt-3" onClick={recarregar}>
              Tentar de novo
            </Botao>
          </Alerta>
        </div>
      )}

      {/* ------------------------- Indicadores ------------------------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregando || !dados ? (
          Array.from({ length: 4 }, (_, i) => <IndicadorEsqueleto key={i} />)
        ) : (
          <>
            <Indicador
              rotulo="TA médio geral"
              valor={fmt.minutos(dados.resumo.total.ta_medio)}
              tom={dados.resumo.total.ta_medio <= meta ? 'sucesso' : 'alerta'}
              icone={<Timer className="size-5" aria-hidden />}
              ajuda={`Meta atual: até ${meta} minutos para chegar na máquina.`}
            />
            <Indicador
              rotulo="Aderência à meta"
              valor={fmt.numero(dados.resumo.total.aderencia, 1)}
              unidade="%"
              tom={tomAderencia(dados.resumo.total.aderencia)}
              icone={<Target className="size-5" aria-hidden />}
              progresso={dados.resumo.total.aderencia}
              ajuda={`${fmt.numero(dados.resumo.total.dentro_meta)} de ${fmt.numero(
                dados.resumo.total.chamados,
              )} chamados atendidos dentro da meta.`}
            />
            <Indicador
              rotulo="Chamados atendidos"
              valor={fmt.numero(dados.resumo.total.chamados)}
              tom="marca"
              icone={<Gauge className="size-5" aria-hidden />}
              ajuda="Somente chamados que já tiveram o início do atendimento registrado."
            />
            <Indicador
              rotulo="Turno mais lento"
              valor={piorTurno?.turno ?? '—'}
              tom="perigo"
              icone={<TriangleAlert className="size-5" aria-hidden />}
              ajuda={
                piorTurno
                  ? `TA médio de ${fmt.minutos(piorTurno.ta_medio)} em ${fmt.numero(
                      piorTurno.chamados,
                    )} chamados.`
                  : 'Sem dados suficientes no período.'
              }
            />
          </>
        )}
      </div>

      {/* ------------------------- Cartões por turno ------------------------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {(dados?.resumo.itens ?? []).map((t) => {
          const tom = tomAderencia(t.aderencia);
          return (
            <div
              key={t.turno_id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">{t.turno}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.hora_inicio} às {t.hora_fim}
                  </p>
                </div>
                <Etiqueta tom={tom}>{fmt.porcento(t.aderencia)} na meta</Etiqueta>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 py-2.5 dark:bg-slate-800/60">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">TA médio</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {fmt.minutos(t.ta_medio)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2.5 dark:bg-slate-800/60">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Pior TA</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {fmt.minutos(t.ta_maximo)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2.5 dark:bg-slate-800/60">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Chamados</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {fmt.numero(t.chamados)}
                  </p>
                </div>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-valuenow={Math.round(t.aderencia)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Aderência à meta no ${t.turno}`}
              >
                <div
                  className={cx(
                    'h-full rounded-full transition-[width] duration-500',
                    tom === 'sucesso'
                      ? 'bg-emerald-500'
                      : tom === 'alerta'
                        ? 'bg-ouro-400'
                        : 'bg-rose-500',
                  )}
                  style={{ width: `${Math.max(t.aderencia, 2)}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Tempo médio de reparo neste turno: <strong>{fmt.minutos(t.reparo_medio)}</strong>
                {t.em_aberto > 0 && ` · ${t.em_aberto} chamado(s) ainda em aberto`}
              </p>
            </div>
          );
        })}
      </div>

      {/* ------------------------- Gráficos ------------------------- */}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Cartao
          className="xl:col-span-2"
          titulo="Evolução do TA por dia"
          subtitulo={`Uma linha por turno. A faixa tracejada é a meta de ${meta} minutos.`}
        >
          {serieGrafico.length === 0 ? (
            <SemDados />
          ) : (
            <>
              <ResumoAcessivel>
                Evolução diária do tempo de atendimento por turno entre {fmt.diaCurto(filtros.de)} e{' '}
                {fmt.diaCurto(filtros.ate)}.
              </ResumoAcessivel>
              <div className="h-80" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serieGrafico} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={cor.grade} vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: cor.grade }}
                      minTickGap={16}
                    />
                    <YAxis
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v) => `${v}m`}
                    />
                    <Tooltip
                      content={<DicaGrafico formatarValor={(v) => fmt.minutos(v)} />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: cor.texto }} iconType="circle" />
                    <ReferenceLine
                      y={meta}
                      stroke={cor.meta}
                      strokeDasharray="6 4"
                      label={{
                        value: `Meta ${meta}min`,
                        position: 'insideTopRight',
                        fill: cor.meta,
                        fontSize: 11,
                      }}
                    />
                    {dados?.serie.turnos.map((turno, i) => (
                      <Line
                        isAnimationActive={false}
                        key={turno}
                        type="monotone"
                        dataKey={turno}
                        name={turno}
                        stroke={CORES_GRAFICO[i % CORES_GRAFICO.length]}
                        strokeWidth={2.5}
                        dot={{ r: 2.5 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Cartao>

        <Cartao titulo="TA médio por turno" subtitulo="Comparação direta entre os turnos">
          {!dados || dados.resumo.itens.length === 0 ? (
            <SemDados />
          ) : (
            <div className="h-80" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.resumo.itens}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={cor.grade} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: cor.texto, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}m`}
                  />
                  <YAxis
                    type="category"
                    dataKey="turno"
                    tick={{ fill: cor.texto, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: escuro ? '#1e293b66' : '#e2e8f088' }}
                    content={<DicaGrafico formatarValor={(v) => fmt.minutos(v)} />}
                  />
                  <ReferenceLine x={meta} stroke={cor.meta} strokeDasharray="6 4" />
                  <Bar dataKey="ta_medio" name="TA médio" radius={[0, 8, 8, 0]} maxBarSize={40} isAnimationActive={false}>
                    {dados.resumo.itens.map((t, i) => (
                      <Cell
                        key={i}
                        fill={(t.ta_medio ?? 0) <= meta ? '#10b981' : COR_MARCA}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Cartao>

        {/* Desempenho por técnico */}
        <Cartao
          className="xl:col-span-2"
          titulo="Desempenho por técnico"
          subtitulo="Volume de chamados, tempo até chegar na máquina e tempo de reparo"
          semPadding
        >
          {!dados || dados.tecnicos.itens.length === 0 ? (
            <SemDados />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <caption className="sr-only">Desempenho de tempo de atendimento por técnico</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-5 py-3">Técnico</th>
                    <th scope="col" className="px-5 py-3 text-right">Chamados</th>
                    <th scope="col" className="px-5 py-3 text-right">TA médio</th>
                    <th scope="col" className="px-5 py-3 text-right">Reparo médio</th>
                    <th scope="col" className="px-5 py-3">Dentro da meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dados.tecnicos.itens.map((t) => (
                    <tr key={t.tecnico} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                          <Users className="size-4 text-slate-400" aria-hidden />
                          {t.tecnico}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {fmt.numero(t.chamados)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                        {fmt.minutos(t.ta_medio)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {fmt.minutos(t.reparo_medio)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={cx(
                                'h-full rounded-full',
                                t.aderencia >= 80
                                  ? 'bg-emerald-500'
                                  : t.aderencia >= 60
                                    ? 'bg-ouro-400'
                                    : 'bg-rose-500',
                              )}
                              style={{ width: `${Math.max(t.aderencia, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                            {fmt.porcento(t.aderencia)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        {/* Piores atendimentos */}
        <Cartao
          titulo="Demoraram mais para ser atendidos"
          subtitulo="Chamados com o maior TA no período"
          semPadding
        >
          {!dados || dados.piores.itens.length === 0 ? (
            <SemDados />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {dados.piores.itens.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        {p.maquina_codigo}
                      </span>
                      <Etiqueta tom={TOM_PRIORIDADE[p.prioridade]}>{p.prioridade}</Etiqueta>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                      {p.descricao}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.turno} · {fmt.dataHoraCurta(p.aberto_em)} · {p.tecnico}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    <Clock3 className="size-3.5" aria-hidden />
                    {fmt.minutos(p.ta_min)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
