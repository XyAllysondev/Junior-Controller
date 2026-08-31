/* Funcoes de formatacao usadas em toda a interface (pt-BR). */

/** 95 -> "1h 35min" | 12 -> "12 min" | 1500 -> "1d 1h" */
export function minutos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const total = Math.round(valor);
  if (total < 1) return 'menos de 1 min';
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas < 24) return resto ? `${horas}h ${resto}min` : `${horas}h`;

  const dias = Math.floor(horas / 24);
  const hRestantes = horas % 24;
  return hRestantes ? `${dias}d ${hRestantes}h` : `${dias}d`;
}

/** Versao curta para eixos de grafico: "1h35" */
export function minutosCurto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const total = Math.round(valor);
  if (total < 60) return `${total}m`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`;
}

export function numero(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function porcento(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return `${numero(valor, casas)}%`;
}

/** "2026-08-29 14:24:00" -> "29/08/2026 14:24" */
export function dataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [data, hora = ''] = valor.split(' ');
  const [a, m, d] = data.split('-');
  if (!a || !m || !d) return valor;
  return `${d}/${m}/${a} ${hora.slice(0, 5)}`.trim();
}

/** "2026-08-29 14:24:00" -> "29/08 14:24" (para tabelas apertadas) */
export function dataHoraCurta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [data, hora = ''] = valor.split(' ');
  const [, m, d] = data.split('-');
  if (!m || !d) return valor;
  return `${d}/${m} ${hora.slice(0, 5)}`.trim();
}

/** "2026-08-29" -> "29/08" */
export function diaCurto(valor: string): string {
  const [, m, d] = valor.split('-');
  return m && d ? `${d}/${m}` : valor;
}

/** Banco ("2026-08-29 14:24:00") -> <input type="datetime-local"> */
export function paraInput(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor.replace(' ', 'T').slice(0, 16);
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Agora, no formato do <input type="datetime-local"> */
export function agoraInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(
    d.getDate(),
  )}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** Data de hoje (ou N dias atras) no formato do <input type="date"> */
export function diaISO(diasAtras = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Ha quanto tempo o chamado esta aberto, em texto. */
export function decorridoDesde(valor: string | null | undefined): string {
  if (!valor) return '—';
  const inicio = new Date(valor.replace(' ', 'T')).getTime();
  if (Number.isNaN(inicio)) return '—';
  return minutos((Date.now() - inicio) / 60000);
}
