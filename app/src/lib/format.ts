const pad = (n: number) => String(n).padStart(2, '0');

export function dataBR(iso?: string | null): string {
  if (!iso) return '-';
  // datas "puras" (yyyy-mm-dd) não devem sofrer fuso horário
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function horaBR(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dataHoraBR(iso?: string | null): string {
  return iso ? `${dataBR(iso)} ${horaBR(iso)}` : '-';
}

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function somarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

/** yyyy-mm-dd no fuso local */
export function dataISOLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function diaSemana(d: Date): string {
  return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()];
}

export function enderecoLinha(l: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): string {
  const rua = [l.logradouro, l.numero].filter(Boolean).join(', ');
  const partes = [rua, l.complemento, l.bairro, [l.cidade, l.uf].filter(Boolean).join('/')];
  return partes.filter(Boolean).join(' - ') || 'Endereço não informado';
}

export function numeroOS(numero?: number | null): string {
  return numero ? `OS ${String(numero).padStart(5, '0')}` : 'OS (nº após sincronizar)';
}

/** Código de verificação do certificado, derivado do id da OS (único e gerado offline). */
export function codigoCertificado(osId: string): string {
  return 'EOL-' + osId.replace(/-/g, '').slice(0, 10).toUpperCase();
}

export function numeroBR(v?: number | null): string {
  if (v === null || v === undefined) return '-';
  return String(v).replace('.', ',');
}

export function lerNumero(txt: string): number | null {
  const limpo = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt;
  const n = Number(limpo.trim());
  return txt.trim() === '' || Number.isNaN(n) ? null : n;
}
