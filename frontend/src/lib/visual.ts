import type { Criticidade, Prioridade, StatusOcorrencia, TipoManutencao } from './api';
import type { Tom } from '../components/ui';

/* ---------------------------------------------------------------------
 * Traducao dos estados do dominio para as cores da interface.
 *
 * O vermelho da marca fica reservado para a identidade (menu, botao
 * principal, logo). Nas etiquetas de estado a escala de gravidade sobe
 * assim: cinza -> dourado -> laranja -> vermelho, de forma que o
 * "Critica" continue saltando aos olhos mesmo num sistema vermelho.
 * ------------------------------------------------------------------ */

export const TOM_STATUS: Record<StatusOcorrencia, Tom> = {
  Aberta: 'alerta',
  'Em atendimento': 'info',
  Concluida: 'sucesso',
  Cancelada: 'neutro',
};

export const TOM_PRIORIDADE: Record<Prioridade, Tom> = {
  Baixa: 'neutro',
  Media: 'alerta',
  Alta: 'laranja',
  Critica: 'perigo',
};

export const TOM_TIPO: Record<TipoManutencao, Tom> = {
  Corretiva: 'perigo',
  Preventiva: 'sucesso',
  Preditiva: 'info',
  Melhoria: 'roxo',
};

export const TOM_CRITICIDADE: Record<Criticidade, Tom> = {
  Baixa: 'neutro',
  Media: 'alerta',
  Alta: 'perigo',
};

/* Paleta dos graficos: comeca pelas duas cores da marca (vermelho e
   dourado) e segue com tons que se distinguem bem entre si nos dois temas. */
export const CORES_GRAFICO = [
  '#d91f17', // vermelho Capricche
  '#e7b528', // dourado da fita
  '#0ea5e9', // azul
  '#10b981', // verde
  '#8b5cf6', // violeta
  '#f97316', // laranja
  '#14b8a6', // turquesa
  '#ec4899', // rosa
  '#64748b', // ardosia
];

export const COR_MARCA = '#d91f17';
export const COR_OURO = '#d69a17';
export const COR_ALERTA = '#d69a17';
export const COR_PERIGO = '#b31712';
export const COR_SUCESSO = '#10b981';

/** Cores dos eixos, grades e linhas de referencia conforme o tema ativo. */
export function eixos(escuro: boolean) {
  return {
    texto: escuro ? '#94a3b8' : '#64748b',
    grade: escuro ? '#1e293b' : '#e2e8f0',
    fundoTooltip: escuro ? '#0f172a' : '#ffffff',
    bordaTooltip: escuro ? '#334155' : '#e2e8f0',
    textoTooltip: escuro ? '#e2e8f0' : '#0f172a',
    /* Linha de meta: quase preta no claro, quase branca no escuro. Fica
       legivel por cima de barras vermelhas ou douradas, o que nao
       aconteceria com mais uma cor da paleta. */
    meta: escuro ? '#e2e8f0' : '#0f172a',
  };
}
