/**
 * Geração do Certificado / Comprovante de Execução de Serviço em PDF.
 * Tudo acontece no aparelho (expo-print), portanto funciona offline.
 *
 * Os campos seguem o que a ANVISA exige no comprovante de execução
 * (RDC 622/2022) — confira com o seu Responsável Técnico e a vigilância
 * sanitária local antes de usar em produção.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  empresa as lerEmpresa,
  osDetalhe,
  pragasDaOS,
  produtosDaOS,
} from '@/db/repos';
import { codigoCertificado, dataBR, dataHoraBR, enderecoLinha, numeroBR, numeroOS } from '@/lib/format';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export async function montarHtmlCertificado(osId: string): Promise<string> {
  const [os, emp, pragas, produtos] = await Promise.all([
    osDetalhe(osId),
    lerEmpresa(),
    pragasDaOS(osId),
    produtosDaOS(osId),
  ]);
  if (!os) throw new Error('OS não encontrada');

  const codigo = os.certificado_codigo ?? codigoCertificado(os.id);
  const endereco = enderecoLinha({ ...os, numero: os.local_numero });

  const linhasProdutos = produtos.length
    ? produtos
        .map(
          (p) => `<tr>
            <td>${esc(p.nome_comercial)}${p.registro_ms ? `<br><small>Reg. MS ${esc(p.registro_ms)}</small>` : ''}</td>
            <td>${esc(p.principio_ativo)}${p.concentracao ? ` (${esc(p.concentracao)})` : ''}</td>
            <td>${esc(p.grupo_quimico)}</td>
            <td>${esc(p.diluicao)}</td>
            <td>${esc(numeroBR(p.quantidade))} ${esc(p.unidade)}</td>
            <td>${esc(p.area_aplicada)}</td>
            <td>${esc(p.antidoto)}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="7">Nenhum produto químico aplicado.</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #1c2321; }
  .topo { display: flex; justify-content: space-between; border-bottom: 3px solid #1B6B4A; padding-bottom: 8px; }
  .topo h1 { font-size: 16px; margin: 0 0 4px; color: #1B6B4A; }
  .titulo { text-align: center; margin: 14px 0 6px; font-size: 15px; font-weight: bold; letter-spacing: .5px; }
  .codigo { text-align: center; color: #5e6b66; margin-bottom: 12px; }
  h2 { font-size: 12px; background: #eef3f1; padding: 4px 6px; margin: 12px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #c9d2ce; padding: 4px 5px; vertical-align: top; text-align: left; }
  th { background: #f4f6f5; font-size: 10px; }
  .grade td { border: none; padding: 2px 4px; }
  .assinaturas { display: flex; justify-content: space-between; margin-top: 28px; gap: 24px; }
  .assinaturas div { flex: 1; text-align: center; }
  .linha { border-top: 1px solid #1c2321; margin-top: 4px; padding-top: 3px; }
  .assinatura-img { height: 60px; }
  .rodape { margin-top: 18px; border-top: 1px solid #c9d2ce; padding-top: 6px; font-size: 10px; color: #5e6b66; }
  .alerta { border: 1px solid #C0392B; color: #C0392B; padding: 6px; margin-top: 10px; font-weight: bold; text-align: center; }
</style></head><body>

<div class="topo">
  <div>
    <h1>${esc(emp?.nome_fantasia || emp?.razao_social)}</h1>
    <div>${esc(emp?.razao_social)}${emp?.cnpj ? ` · CNPJ ${esc(emp.cnpj)}` : ''}</div>
    <div>${esc(emp?.endereco)}</div>
    <div>${esc(emp?.telefone)} ${emp?.email ? `· ${esc(emp.email)}` : ''}</div>
  </div>
  <div style="text-align:right">
    <div><b>Licença Sanitária:</b> ${esc(emp?.licenca_sanitaria)}</div>
    <div><b>${esc(numeroOS(os.numero))}</b></div>
  </div>
</div>

<div class="titulo">CERTIFICADO DE EXECUÇÃO DE SERVIÇO</div>
<div class="codigo">Código de verificação: <b>${esc(codigo)}</b></div>

<h2>Cliente</h2>
<table class="grade">
  <tr><td><b>Nome/Razão social:</b> ${esc(os.cliente_nome)}</td><td><b>CPF/CNPJ:</b> ${esc(os.cliente_documento)}</td></tr>
  <tr><td colspan="2"><b>Local do serviço:</b> ${esc(endereco)}</td></tr>
</table>

<h2>Serviço executado</h2>
<table class="grade">
  <tr><td><b>Serviço:</b> ${esc(os.servico_nome)}</td><td><b>Data de execução:</b> ${esc(dataHoraBR(os.concluida_em ?? os.iniciada_em))}</td></tr>
  <tr><td><b>Pragas alvo:</b> ${esc(pragas.map((p) => p.nome).join(', ') || '-')}</td><td><b>Garantia até:</b> ${esc(dataBR(os.garantia_ate))}</td></tr>
</table>

<h2>Produtos utilizados</h2>
<table>
  <tr><th>Produto</th><th>Princípio ativo (concentração)</th><th>Grupo químico</th><th>Diluição</th><th>Quantidade</th><th>Área aplicada</th><th>Antídoto</th></tr>
  ${linhasProdutos}
</table>

${os.relatorio ? `<h2>Relatório do técnico</h2><div>${esc(os.relatorio).replace(/\n/g, '<br>')}</div>` : ''}
${os.recomendacoes ? `<h2>Recomendações</h2><div>${esc(os.recomendacoes).replace(/\n/g, '<br>')}</div>` : ''}

<div class="alerta">EM CASO DE INTOXICAÇÃO: Disque-Intoxicação / CIATox ${esc(emp?.ciatox_telefone || '0800 722 6001')}</div>

<div class="assinaturas">
  <div>
    <div style="height:60px"></div>
    <div class="linha">${esc(emp?.responsavel_tecnico)}<br>Responsável Técnico · ${esc(emp?.rt_registro)}</div>
  </div>
  <div>
    <div style="height:60px"></div>
    <div class="linha">${esc(os.tecnico_nome)}<br>Técnico executor</div>
  </div>
  <div>
    ${os.assinatura_cliente ? `<img class="assinatura-img" src="${esc(os.assinatura_cliente)}">` : '<div style="height:60px"></div>'}
    <div class="linha">${esc(os.responsavel_local_nome)}${os.responsavel_local_documento ? ` · ${esc(os.responsavel_local_documento)}` : ''}<br>Cliente / responsável no local</div>
  </div>
</div>

<div class="rodape">
  Documento emitido em ${esc(dataHoraBR(new Date().toISOString()))} pelo EasyOS Light.
  A garantia está condicionada ao cumprimento das recomendações acima.
</div>
</body></html>`;
}

/** Gera o PDF e abre o menu de compartilhamento (WhatsApp, e-mail, etc.). */
export async function compartilharCertificado(osId: string): Promise<void> {
  const html = await montarHtmlCertificado(osId);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Enviar certificado',
    });
  } else {
    await Print.printAsync({ uri });
  }
}
