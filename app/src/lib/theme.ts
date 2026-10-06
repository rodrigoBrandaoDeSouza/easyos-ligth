export const cores = {
  primaria: '#1B6B4A',
  primariaEscura: '#12503A',
  fundo: '#F4F6F5',
  cartao: '#FFFFFF',
  texto: '#1C2321',
  textoSuave: '#5E6B66',
  borda: '#D9E0DD',
  perigo: '#C0392B',
  aviso: '#D68910',
  info: '#2E6DB4',
  sucesso: '#1E8449',
};

export const statusOS: Record<string, { rotulo: string; cor: string }> = {
  agendada: { rotulo: 'Agendada', cor: cores.info },
  em_andamento: { rotulo: 'Em atendimento', cor: cores.aviso },
  concluida: { rotulo: 'Concluída', cor: cores.sucesso },
  cancelada: { rotulo: 'Cancelada', cor: cores.textoSuave },
};
