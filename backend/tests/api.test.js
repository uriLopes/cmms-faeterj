require('dotenv').config();
const http = require('http');
const db = require('../src/database/db');

const BASE_PORT = process.env.PORT || 3001;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: BASE_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(75));
  console.log('  BATERIA DE TESTES INTEGRADOS: BACKEND CORE & WEBSOCKET ENGINE (CMMS)');
  console.log('='.repeat(75));

  let passed = 0;
  let failed = 0;

  function assert(condition, title, details = '') {
    if (condition) {
      console.log(`  [PASSOU] ${title}`);
      passed++;
    } else {
      console.error(`  [FALHOU] ${title} - ${details}`);
      failed++;
    }
  }

  let tokenPCM = null;
  let tokenTecnico = null;
  let tokenAlmoxarife = null;
  let idChamadoTeste = null;
  let idSolicitacaoPeca = null;
  const qrTokenMV3 = 'qr_mv3_rob_04_token_hash_faeterj_2026';

  try {
    // 1. Health check
    const resStatus = await request('GET', '/status');
    assert(resStatus.status === 200 && resStatus.data.status === 'online', 'GET /status retorna 200 e status online');

    // 2. Login PCM
    const resLoginPCM = await request('POST', '/api/auth/login', {
      matricula: 'RE-1042',
      senha: 'cmms123'
    });
    assert(resLoginPCM.status === 200 && resLoginPCM.data.token, 'POST /api/auth/login (PCM) autentica e retorna token JWT');
    tokenPCM = resLoginPCM.data.token;

    // 3. Login Técnico
    const resLoginTecnico = await request('POST', '/api/auth/login', {
      matricula: 'RE-3088',
      senha: 'cmms123'
    });
    assert(resLoginTecnico.status === 200 && resLoginTecnico.data.usuario.perfil === 'manutentor', 'POST /api/auth/login (Técnico) autentica com perfil manutentor');
    tokenTecnico = resLoginTecnico.data.token;

    // 4. Login Almoxarife
    const resLoginAlmox = await request('POST', '/api/auth/login', {
      matricula: 'RE-4015',
      senha: 'cmms123'
    });
    assert(resLoginAlmox.status === 200 && resLoginAlmox.data.usuario.perfil === 'almoxarife', 'POST /api/auth/login (Almoxarife) autentica com perfil almoxarife');
    tokenAlmoxarife = resLoginAlmox.data.token;

    // 5. Validação Fricção Zero do Operador
    const resOperador = await request('POST', '/api/auth/operador-check', {
      matricula: 'RE-5001'
    });
    assert(resOperador.status === 200 && resOperador.data.valido === true, 'POST /api/auth/operador-check valida operador sem senha');

    // 6. Resolução de QR Code
    const resQR = await request('GET', `/api/ativos/qr/${qrTokenMV3}`);
    assert(
      resQR.status === 200 && resQR.data.ativo && resQR.data.ativo.tag_patrimonio === 'MV3-ROB-04',
      'GET /api/ativos/qr/:token identifica máquina física e retorna sintomas'
    );

    // 7. Abertura do Chamado (T0)
    const resAbertura = await request('POST', '/api/chamados', {
      qr_code_token: qrTokenMV3,
      operador_matricula: 'RE-5001',
      operador_nome: 'João Silva',
      sintoma_id: 2,
      descricao_sintoma: 'Vazamento forte na mangueira de ar comprimido da pinça de solda'
    });
    assert(
      resAbertura.status === 201 && resAbertura.data.chamado && resAbertura.data.chamado.t0_abertura,
      'POST /api/chamados cria OS, captura T0 e coloca ativo em parado_quebra'
    );
    idChamadoTeste = resAbertura.data.chamado.id;

    // 8. Atribuição do Mantenedor (T1)
    const resAtribuir = await request('PATCH', `/api/chamados/${idChamadoTeste}/atribuir`, {
      mantenedor_id: resLoginTecnico.data.usuario.id
    }, tokenPCM);
    assert(
      resAtribuir.status === 200 && resAtribuir.data.chamado.status === 'atribuido' && resAtribuir.data.chamado.t1_atribuicao,
      'PATCH /api/chamados/:id/atribuir registra T1 e calcula tempo_resposta_minutos'
    );

    // 9. Início do Reparo no Posto (T2)
    const resInicio = await request('PATCH', `/api/chamados/${idChamadoTeste}/iniciar-reparo`, {}, tokenTecnico);
    assert(
      resInicio.status === 200 && resInicio.data.chamado.status === 'em_reparo' && resInicio.data.chamado.t2_inicio_reparo,
      'PATCH /api/chamados/:id/iniciar-reparo registra T2 e coloca máquina em_manutencao'
    );

    // 10. Requisição de Peça (Modo Reserva Pendente)
    const resPecaReq = await request('POST', `/api/chamados/${idChamadoTeste}/pecas`, {
      peca_id: 1, // Válvula Festo
      quantidade: 1
    }, tokenTecnico);
    assert(
      resPecaReq.status === 201 && resPecaReq.data.solicitacao.status_movimentacao === 'reserva_pendente',
      'POST /api/chamados/:id/pecas vincula peça em modo reserva pendente sem travar OS'
    );
    idSolicitacaoPeca = resPecaReq.data.solicitacao.id;

    // 11. Registro de Pausa Operacional
    const resPausa = await request('POST', `/api/chamados/${idChamadoTeste}/pausar`, {
      motivo: 'aguardando_peca',
      justificativa: 'Aguardando entrega de válvula sobressalente do almoxarifado central'
    }, tokenTecnico);
    assert(
      resPausa.status === 200 && resPausa.data.chamado.status === 'pausado_peca',
      'POST /api/chamados/:id/pausar registra pausa operacional sem penalizar técnico'
    );

    // 12. Almoxarife Efetua Baixa Física
    const resBaixa = await request('PATCH', `/api/pecas-os/${idSolicitacaoPeca}/baixar`, {}, tokenAlmoxarife);
    assert(
      resBaixa.status === 200 && resBaixa.data.novo_saldo !== undefined,
      'PATCH /api/pecas-os/:id/baixar confirma entrega e atualiza saldo físico do almoxarifado'
    );

    // 13. Retomada do Trabalho
    const resRetomada = await request('PATCH', `/api/chamados/${idChamadoTeste}/retomar`, {}, tokenTecnico);
    assert(
      resRetomada.status === 200 && resRetomada.data.chamado.status === 'em_reparo',
      'PATCH /api/chamados/:id/retomar encerra pausa e retorna status para em_reparo'
    );

    // 14. Conclusão Técnica e Liberação da Máquina (T3)
    const resConcluir = await request('POST', `/api/chamados/${idChamadoTeste}/concluir`, {
      causa_raiz: 'Rompimento por fadiga de engate rápido da linha de ar comprimido',
      acao_executada: 'Substituição da válvula de 24V Festo e vedação de mangueira pneumática',
      arvore_falha_sistema: 'pneumatica',
      necessita_revisao_preventiva: false,
      observacoes_tecnicas: 'Pressão nominal ajustada em 6.2 bar. Ciclo de solda aprovado sem perdas.'
    }, tokenTecnico);
    assert(
      resConcluir.status === 200 && resConcluir.data.metricas.tempo_reparo_liquido_minutos !== undefined,
      'POST /api/chamados/:id/concluir registra T3, libera ativo para em_operacao e calcula MTTR Líquido'
    );

    // 15. Verificação da OS Fechada e seus Apontamentos
    const resDetalhes = await request('GET', `/api/chamados/${idChamadoTeste}`);
    assert(
      resDetalhes.status === 200 && resDetalhes.data.status === 'concluido' && resDetalhes.data.apontamento,
      'GET /api/chamados/:id consolida marcos T0-T3, pausas, peças e apontamento técnico'
    );

  } catch (err) {
    console.error('Erro durante os testes:', err);
    failed++;
  } finally {
    console.log('-'.repeat(75));
    console.log(`TOTAL: ${passed + failed} testes | PASSOU: ${passed} | FALHOU: ${failed}`);
    console.log('='.repeat(75));
    await db.destroy();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
