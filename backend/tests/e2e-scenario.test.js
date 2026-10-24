/**
 * TESTE DE VALIDAÇÃO END-TO-END (E2E): CICLO COMPLETO DE MANUTENÇÃO FABRIL
 * Simulação de um turno de produção no Polo Automotivo:
 * Operador (T0) -> Cockpit PCM (T1) -> Mantenedor em Campo (T2) -> Pausa Operacional ->
 * Almoxarifado (Reserva Pendente & Baixa) -> Conclusão Técnica (T3) -> Motor de Métricas (MTTR/MTBF/Pareto)
 */

require('dotenv').config();
const http = require('http');
const db = require('../src/database/db');
const { server } = require('../src/server');

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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2EValidation() {
  console.log('='.repeat(80));
  console.log('  HOMOLOGAÇÃO E2E CMMS: SIMULAÇÃO REAL DE CHÃO DE FÁBRICA (UC01 a UC19)');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  function assertStep(stepName, condition, detail = '') {
    if (condition) {
      console.log(`  [OK] PASSO ${stepName}: ${detail}`);
      passed++;
    } else {
      console.error(`  [FALHA] PASSO ${stepName}: ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Autenticação dos Atores da Planta
    console.log('\n[CENÁRIO 1] Autenticação e Verificação de Acessos');
    const pcmAuth = await request('POST', '/api/auth/login', { matricula: 'RE-1042', senha: 'cmms123' });
    const tokenPCM = pcmAuth.data.token;
    assertStep('1.1', pcmAuth.status === 200, 'Gestor PCM Carlos Eduardo autenticado (RE-1042)');

    const tecAuth = await request('POST', '/api/auth/login', { matricula: 'RE-3088', senha: 'cmms123' });
    const tokenTecnico = tecAuth.data.token;
    assertStep('1.2', tecAuth.status === 200, 'Mantenedor Rodrigo Silva autenticado (RE-3088)');

    const almAuth = await request('POST', '/api/auth/login', { matricula: 'RE-4015', senha: 'cmms123' });
    const tokenAlmoxarife = almAuth.data.token;
    assertStep('1.3', almAuth.status === 200, 'Almoxarife Antônio Ferreira autenticado (RE-4015)');

    // 2. Operador no Posto: Leitura do QR Code físico (Fricção Zero)
    console.log('\n[CENÁRIO 2] Operador abre OS em 2 Toques via QR Code (T0)');
    const qrToken = 'qr_mv3_rob_04_token_hash_faeterj_2026';
    const qrLookup = await request('GET', `/api/ativos/qr/${qrToken}`);
    assertStep('2.1', qrLookup.status === 200 && qrLookup.data.ativo.tag_patrimonio === 'MV3-ROB-04', 'QR Code reconhecido no posto físico');

    const resAbertura = await request('POST', '/api/chamados', {
      ativo_id: qrLookup.data.ativo.id,
      operador_matricula: 'RE-5001',
      sintoma_id: 2, // Vazamento pneumático
      descricao_sintoma: 'Pressão da linha caiu abaixo de 4 bar. Válvula principal assobiando.'
    });
    const chamado = resAbertura.data.chamado;
    assertStep('2.2', resAbertura.status === 201 && chamado.status === 'aberto', `OS gerada: ${chamado.numero_os} com marco T0`);

    // 3. Cockpit PCM: Visualização e Atribuição do Técnico (T1)
    console.log('\n[CENÁRIO 3] PCM no Cockpit visualiza parada de máquina e despacha técnico (T1)');
    await delay(200); // Simula intervalo
    const resAtribuicao = await request('PATCH', `/api/chamados/${chamado.id}/atribuir`, {
      mantenedor_id: tecAuth.data.usuario.id
    }, tokenPCM);
    assertStep('3.1', resAtribuicao.status === 200 && resAtribuicao.data.chamado.status === 'atribuido', `Chamado atribuído a Rodrigo Silva (T1 capturado)`);

    // 4. Mantenedor em Campo: Chegada no Posto e Início da Intervenção (T2)
    console.log('\n[CENÁRIO 4] Técnico chega no posto industrial e aciona cronômetro de reparo (T2)');
    await delay(300);
    const resInicioReparo = await request('PATCH', `/api/chamados/${chamado.id}/iniciar-reparo`, {}, tokenTecnico);
    assertStep('4.1', resInicioReparo.status === 200 && resInicioReparo.data.chamado.status === 'em_reparo', 'Cronômetro T2 iniciado; ativo entra em manutenção');

    // 5. Técnico Requisita Peça e Registra Pausa Operacional
    console.log('\n[CENÁRIO 5] Técnico solicita sobressalente em reserva pendente e pausa cronômetro');
    const resReqPeca = await request('POST', `/api/chamados/${chamado.id}/pecas`, {
      peca_id: 1, // Válvula Festo
      quantidade: 1
    }, tokenTecnico);
    assertStep('5.1', resReqPeca.status === 201 && resReqPeca.data.solicitacao.status_movimentacao === 'reserva_pendente', 'Peça vinculada em modo reserva pendente');

    const resPausa = await request('POST', `/api/chamados/${chamado.id}/pausar`, {
      motivo: 'aguardando_peca',
      justificativa: 'Aguardando almoxarife liberar válvula Festo sobressalente'
    }, tokenTecnico);
    assertStep('5.2', resPausa.status === 200 && resPausa.data.chamado.status === 'pausado_peca', 'Atendimento pausado; MTTR Líquido temporariamente congelado');

    // 6. Almoxarifado: Atendimento da Reserva Pendente e Baixa Física
    console.log('\n[CENÁRIO 6] Almoxarife confirma entrega física no balcão e dá baixa no estoque');
    const reqId = resReqPeca.data.solicitacao.id;
    const resBaixa = await request('PATCH', `/api/pecas-os/${reqId}/baixar`, {}, tokenAlmoxarife);
    assertStep('6.1', resBaixa.status === 200, 'Baixa física confirmada e estoque decrementado');

    // 7. Retomada do Trabalho e Conclusão Técnica com Árvore de Falhas (T3)
    console.log('\n[CENÁRIO 7] Técnico retoma o serviço, instala a peça e conclui o reparo (T3)');
    await request('PATCH', `/api/chamados/${chamado.id}/retomar`, {}, tokenTecnico);

    await delay(500); // Tempo simulado de intervenção

    const resConcluir = await request('POST', `/api/chamados/${chamado.id}/concluir`, {
      arvore_falha_sistema: 'pneumatica',
      causa_raiz: 'Fadiga no corpo da válvula direcional de 5/2 vias',
      acao_executada: 'Instalada nova válvula Festo, verificado torque e reapertada linha de ar',
      necessita_revisao_preventiva: true,
      observacoes_tecnicas: 'Substituição com êxito. Pressão estabilizada em 6.2 bar.'
    }, tokenTecnico);

    assertStep(
      '7.1',
      resConcluir.status === 200 &&
      resConcluir.data.metricas.tempo_reparo_liquido_minutos !== undefined,
      `Reparo concluído (T3). MTTR Líquido: ${resConcluir.data.metricas.tempo_reparo_liquido_minutos} min`
    );

    // 8. Motor de Indicadores: Recalculo Automático de MTBF, MTTR e Pareto
    console.log('\n[CENÁRIO 8] Motor de Indicadores atualiza KPIs de confiabilidade em tempo real');
    const resAnalytics = await request('GET', '/api/metricas/dashboard', null, tokenPCM);
    assertStep(
      '8.1',
      resAnalytics.status === 200 &&
      resAnalytics.data.resumo_geral.disponibilidade_percentual > 0 &&
      resAnalytics.data.pareto_subsistemas.length > 0,
      `Disponibilidade Global: ${resAnalytics.data.resumo_geral.disponibilidade_percentual}% • MTTR Médio: ${resAnalytics.data.resumo_geral.mttr_medio_minutos} min`
    );

  } catch (err) {
    console.error('Erro na execução do cenário E2E:', err);
    failed++;
  } finally {
    console.log('\n' + '='.repeat(80));
    console.log(`RESULTADO DA HOMOLOGAÇÃO E2E: ${passed} PASSOU | ${failed} FALHOU`);
    console.log('='.repeat(80));
    if (server && server.close) server.close();
    await db.destroy();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runE2EValidation();