import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Clock,
  Gauge,
  Timer,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Filtros, filtrosPadrao, type FiltrosPeriodo } from '../components/Filtros';
import { TituloPagina } from '../components/Layout';
import { Indicador, IndicadorEsqueleto } from '../components/Indicador';
import { DicaGrafico, ResumoAcessivel, SemDados } from '../components/graficos';
import { Alerta, Botao, Cartao, Etiqueta, EstadoVazio } from '../components/ui';
import { api, type Distribuicao, type LinhaMaquina, type LinhaPareto, type ListaOcorrencias, type PontoSerie, type ResumoIndicadores } from '../lib/api';
import { useApi, useTema } from '../lib/hooks';
import * as fmt from '../lib/formato';
import { CORES_GRAFICO, COR_ALERTA, COR_MARCA, eixos, TOM_PRIORIDADE, TOM_STATUS } from '../lib/visual';

type DadosPainel = {
  resumo: ResumoIndicadores;
  serie: { itens: PontoSerie[] };
  pareto: { total_minutos: number; itens: LinhaPareto[] };
  distribuicao: Distribuicao;
  maquinas: { itens: LinhaMaquina[] };
  abertas: ListaOcorrencias;
};

export function Painel() {
  const [filtros, setFiltros] = useState<FiltrosPeriodo>(() => filtrosPadrao(30));
  const { escuro } = useTema();
  const cor = eixos(escuro);

  const chave = JSON.stringify(filtros);

  const { dados, carregando, erro, recarregar } = useApi<DadosPainel>(async () => {
    const p = { ...filtros };
    const [resumo, serie, pareto, distribuicao, maquinas, abertas] = await Promise.all([
      api.get<ResumoIndicadores>('/indicadores/resumo', p),
      api.get<{ itens: PontoSerie[] }>('/indicadores/serie', p),
      api.get<{ total_minutos: number; itens: LinhaPareto[] }>('/indicadores/pareto', { ...p, limite: 8 }),
      api.get<Distribuicao>('/indicadores/distribuicao', p),
      api.get<{ itens: LinhaMaquina[] }>('/indicadores/por-maquina', { ...p, limite: 8 }),
      api.get<ListaOcorrencias>('/ocorrencias', { abertas: 1, porPagina: 6 }),
    ]);
    return { resumo, serie, pareto, distribuicao, maquinas, abertas };
  }, chave);

  const serie = useMemo(
    () =>
      (dados?.serie.itens ?? []).map((p) => ({
        ...p,
        rotulo: fmt.diaCurto(p.dia),
        horas_parado: Math.round(((p.minutos_parado || 0) / 60) * 10) / 10,
      })),
    [dados],
  );

  return (
    <>
      <TituloPagina
        titulo="Painel de manutenção"
        descricao="Visão geral das paradas, do tempo de reparo e da disponibilidade das máquinas no período escolhido."
        acoes={
          <Link to="/ocorrencias">
            <Botao icone={<Wrench className="size-4" aria-hidden />}>Registrar parada</Botao>
          </Link>
        }
      />

      <Filtros valores={filtros} aoMudar={setFiltros} />

      {erro && (
        <div className="mb-6">
          <Alerta titulo="Não foi possível carregar o painel">
            <p>{erro}</p>
            <Botao variante="secundario" tamanho="pequeno" className="mt-3" onClick={recarregar}>
              Tentar de novo
            </Botao>
          </Alerta>
        </div>
      )}

      {/* ------------------------- Indicadores ------------------------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {carregando || !dados ? (
          Array.from({ length: 6 }, (_, i) => <IndicadorEsqueleto key={i} />)
        ) : (
          <>
            <Indicador
              rotulo="Disponibilidade"
              valor={fmt.numero(dados.resumo.disponibilidade, 1)}
              unidade="%"
              tom={
                (dados.resumo.disponibilidade ?? 0) >= 95
                  ? 'sucesso'
                  : (dados.resumo.disponibilidade ?? 0) >= 90
                    ? 'alerta'
                    : 'perigo'
              }
              icone={<Gauge className="size-5" aria-hidden />}
              progresso={dados.resumo.disponibilidade}
              ajuda={`${fmt.numero(dados.resumo.horas_paradas, 1)} h paradas de ${fmt.numero(
                dados.resumo.horas_programadas,
                0,
              )} h programadas.`}
            />

            <Indicador
              rotulo="MTTR"
              valor={fmt.minutos(dados.resumo.mttr_min)}
              tom="info"
              icone={<Wrench className="size-5" aria-hidden />}
              ajuda="Tempo médio de reparo: quanto a equipe leva, em média, para consertar depois que chega na máquina."
            />

            <Indicador
              rotulo="MTBF"
              valor={dados.resumo.mtbf_h === null ? '—' : fmt.numero(dados.resumo.mtbf_h, 1)}
              unidade={dados.resumo.mtbf_h === null ? undefined : 'h'}
              tom="roxo"
              icone={<TrendingUp className="size-5" aria-hidden />}
              ajuda="Tempo médio entre falhas: quanto o parque roda, em média, antes de uma nova quebra."
            />

            <Indicador
              rotulo="TA médio"
              valor={fmt.minutos(dados.resumo.ta_min)}
              tom="marca"
              icone={<Timer className="size-5" aria-hidden />}
              ajuda="Tempo de atendimento: da abertura do chamado até a manutenção chegar na máquina."
            />

            <Indicador
              rotulo="Ocorrências"
              valor={fmt.numero(dados.resumo.total)}
              tom="alerta"
              icone={<Activity className="size-5" aria-hidden />}
              ajuda={`${dados.resumo.corretivas} corretivas · ${dados.resumo.preventivas} preventivas`}
            />

            <Indicador
              rotulo="Em aberto agora"
              valor={fmt.numero(dados.resumo.abertas + dados.resumo.em_atendimento)}
              tom={dados.resumo.criticas_abertas > 0 ? 'perigo' : 'sucesso'}
              icone={<AlertOctagon className="size-5" aria-hidden />}
              ajuda={
                dados.resumo.criticas_abertas > 0
                  ? `${dados.resumo.criticas_abertas} com prioridade crítica esperando atendimento.`
                  : 'Nenhum chamado crítico pendente no período.'
              }
            />
          </>
        )}
      </div>

      {/* ------------------------- Gráficos ------------------------- */}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Evolução das paradas */}
        <Cartao
          className="xl:col-span-2"
          titulo="Paradas ao longo do período"
          subtitulo="Barras = horas paradas por dia · Linha = quantidade de ocorrências"
        >
          {serie.length === 0 ? (
            <SemDados />
          ) : (
            <>
              <ResumoAcessivel>
                Gráfico de barras com as horas paradas por dia entre {fmt.diaCurto(filtros.de)} e{' '}
                {fmt.diaCurto(filtros.ate)}, somando{' '}
                {fmt.numero(serie.reduce((s, p) => s + p.horas_parado, 0), 1)} horas em{' '}
                {fmt.numero(serie.reduce((s, p) => s + p.ocorrencias, 0))} ocorrências.
              </ResumoAcessivel>
              <div className="h-80" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradParadas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COR_MARCA} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={COR_MARCA} stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={cor.grade} vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: cor.grade }}
                      minTickGap={16}
                    />
                    <YAxis
                      yAxisId="esq"
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={54}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <YAxis
                      yAxisId="dir"
                      orientation="right"
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: escuro ? '#1e293b66' : '#e2e8f088' }}
                      content={
                        <DicaGrafico
                          formatarValor={(v, nome) =>
                            nome === 'Horas paradas' ? `${fmt.numero(v, 1)} h` : fmt.numero(v)
                          }
                        />
                      }
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: cor.texto, paddingTop: 8 }}
                      iconType="circle"
                    />
                    <Bar
                      isAnimationActive={false}
                      yAxisId="esq"
                      dataKey="horas_parado"
                      name="Horas paradas"
                      fill="url(#gradParadas)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={38}
                    />
                    <Line
                      isAnimationActive={false}
                      yAxisId="dir"
                      type="monotone"
                      dataKey="ocorrencias"
                      name="Ocorrências"
                      stroke={COR_ALERTA}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Cartao>

        {/* Chamados em aberto */}
        <Cartao
          titulo="Chamados em aberto"
          subtitulo="Os mais antigos aparecem primeiro"
          acao={
            <Link
              to="/ocorrencias"
              className="inline-flex items-center gap-1 text-sm font-semibold text-marca-600 hover:underline dark:text-marca-400"
            >
              Ver todos <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
          semPadding
        >
          {!dados || dados.abertas.itens.length === 0 ? (
            <EstadoVazio
              icone={<Wrench className="size-7" aria-hidden />}
              titulo="Nenhum chamado em aberto"
              descricao="Todas as máquinas estão liberadas para produção."
            />
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {dados.abertas.itens.map((o) => (
                <li key={o.id} className="flex gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        {o.maquina_codigo}
                      </span>
                      <Etiqueta tom={TOM_PRIORIDADE[o.prioridade]}>{o.prioridade}</Etiqueta>
                      <Etiqueta tom={TOM_STATUS[o.status]}>{o.status}</Etiqueta>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {o.maquina_nome}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {o.motivo_nome || o.descricao}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="inline-flex items-center gap-1 text-xs font-bold text-ouro-700 dark:text-ouro-300">
                      <Clock className="size-3.5" aria-hidden />
                      {fmt.decorridoDesde(o.aberto_em)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {fmt.dataHoraCurta(o.aberto_em)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {/* Pareto de motivos */}
        <Cartao
          className="xl:col-span-2"
          titulo="Onde o tempo está indo"
          subtitulo="Pareto dos motivos de parada — as barras somam o tempo perdido, a linha mostra o acumulado"
        >
          {!dados || dados.pareto.itens.length === 0 ? (
            <SemDados />
          ) : (
            <>
              <ResumoAcessivel>
                Principais motivos de parada:{' '}
                {dados.pareto.itens
                  .slice(0, 3)
                  .map((m) => `${m.motivo} com ${fmt.minutos(m.minutos)}`)
                  .join(', ')}
                .
              </ResumoAcessivel>
              <div className="h-80" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dados.pareto.itens.map((i) => ({
                      ...i,
                      horas: Math.round((i.minutos / 60) * 10) / 10,
                    }))}
                    margin={{ top: 8, right: 8, left: -12, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={cor.grade} vertical={false} />
                    <XAxis
                      dataKey="motivo"
                      tick={{ fill: cor.texto, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: cor.grade }}
                      angle={-32}
                      textAnchor="end"
                      height={70}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="esq"
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={54}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <YAxis
                      yAxisId="dir"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fill: cor.texto, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ fill: escuro ? '#1e293b66' : '#e2e8f088' }}
                      content={
                        <DicaGrafico
                          formatarValor={(v, nome) =>
                            nome === 'Acumulado' ? `${fmt.numero(v, 1)}%` : `${fmt.numero(v, 1)} h`
                          }
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: cor.texto }} iconType="circle" />
                    <Bar
                      isAnimationActive={false}
                      yAxisId="esq"
                      dataKey="horas"
                      name="Horas paradas"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={46}
                    >
                      {dados.pareto.itens.map((_, i) => (
                        <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />
                      ))}
                    </Bar>
                    <Line
                      isAnimationActive={false}
                      yAxisId="dir"
                      type="monotone"
                      dataKey="acumulado"
                      name="Acumulado"
                      stroke={COR_ALERTA}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Cartao>

        {/* Distribuição por tipo */}
        <Cartao titulo="Tipo de manutenção" subtitulo="Proporção de corretivas x planejadas">
          {!dados || dados.distribuicao.por_tipo.length === 0 ? (
            <SemDados />
          ) : (
            <>
              <ResumoAcessivel>
                {dados.distribuicao.por_tipo
                  .map((t) => `${t.rotulo}: ${t.total} ocorrências`)
                  .join('; ')}
                .
              </ResumoAcessivel>
              <div className="h-64" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={dados.distribuicao.por_tipo}
                      dataKey="total"
                      nameKey="rotulo"
                      innerRadius="58%"
                      outerRadius="85%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {dados.distribuicao.por_tipo.map((_, i) => (
                        <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<DicaGrafico formatarValor={(v) => `${fmt.numero(v)} ocorrências`} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2">
                {dados.distribuicao.por_tipo.map((t, i) => (
                  <li key={t.rotulo} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: CORES_GRAFICO[i % CORES_GRAFICO.length] }}
                      aria-hidden
                    />
                    <span className="text-slate-600 dark:text-slate-300">{t.rotulo}</span>
                    <span className="ml-auto font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {fmt.numero(t.total)}
                    </span>
                    <span className="w-16 text-right text-xs text-slate-400 tabular-nums">
                      {fmt.minutos(t.minutos)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Cartao>

        {/* Ranking de máquinas */}
        <Cartao
          className="xl:col-span-3"
          titulo="Máquinas que mais pararam"
          subtitulo="Ordenadas pelo tempo total de parada no período"
          semPadding
        >
          {!dados || dados.maquinas.itens.length === 0 ? (
            <SemDados texto="Nenhuma parada registrada no período" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">
                  Ranking de máquinas por tempo de parada, com disponibilidade, MTTR e MTBF
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-5 py-3">Máquina</th>
                    <th scope="col" className="px-5 py-3">Setor</th>
                    <th scope="col" className="px-5 py-3 text-right">Paradas</th>
                    <th scope="col" className="px-5 py-3 text-right">Tempo parado</th>
                    <th scope="col" className="px-5 py-3 text-right">MTTR</th>
                    <th scope="col" className="px-5 py-3 text-right">MTBF</th>
                    <th scope="col" className="px-5 py-3">Disponibilidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dados.maquinas.itens.map((m) => (
                    <tr
                      key={m.id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3">
                        <span className="block font-mono text-xs font-bold text-marca-600 dark:text-marca-400">
                          {m.codigo}
                        </span>
                        <span className="block font-semibold text-slate-800 dark:text-slate-100">
                          {m.nome}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{m.setor}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {fmt.numero(m.paradas)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {fmt.minutos(m.minutos_parado)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {fmt.minutos(m.mttr_min)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {m.mtbf_h === null ? '—' : `${fmt.numero(m.mtbf_h, 1)} h`}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={
                                m.disponibilidade >= 95
                                  ? 'h-full rounded-full bg-emerald-500'
                                  : m.disponibilidade >= 90
                                    ? 'h-full rounded-full bg-ouro-400'
                                    : 'h-full rounded-full bg-rose-500'
                              }
                              style={{ width: `${Math.max(m.disponibilidade, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                            {fmt.porcento(m.disponibilidade)}
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
      </div>
    </>
  );
}
