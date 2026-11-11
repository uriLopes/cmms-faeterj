/**
 * Vanguard V2 - Suite de Testes Integrados E2E (6 Eixos Arquiteturais)
 * Executa contra MySQL real apos `npm run seed` na porta isolada 3098.
 */
require('dotenv').config();
process.env.PORT = process.env.V2_TEST_PORT || '3098';
process.env.NODE_ENV = 'test';

const crypto = require('crypto');
const assert = require('assert');
const db = require('../src/database/db');
const { server } = require('../src/server');

const BASE_URL = `http://localhost:${process.env.PORT}/api`;

function getTestGatewayHmacKey(gatewayId) {
  if (process.env.IOT_GATEWAY_HMAC_SECRET) {
    return process.env.IOT_GATEWAY_HMAC_SECRET;
  }
  const seedSalt = process.env.IOT_SEED_SALT || 'vanguard-v2-dev-plc-gateway';
  return crypto
    .createHash('sha256')
    .update(`${seedSalt}:${gatewayId}`)
    .digest('hex')
    .slice(0, 32);
}

function signPayload(bodyObj, secret) {
  const raw = JSON.stringify(bodyObj);
  return {
    raw,
    signature: crypto.createHmac('sha256', secret).update(raw).digest('hex')
  };
}

let total = 0;
let passaram = 0;
let falharam = 0;

async function testar(nome, fn) {
  total++;
  try {
    await fn();
    passaram++;
    console.log(`  [PASSOU] ${nome}`);
  } catch (err) {
    falharam++;
    console.error(`  [FALHOU] ${nome} -> ${err.message}`);
  }
}

async function reqJson(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  };
  if (body !== null) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n===========================================================================');
  console.log('  VANGUARD V2 ARCHITECTURE TEST SUITE (6 INDUSTRIAL AXES)');
  console.log('===========================================================================');

  await new Promise((r) => setTimeout(r, 700));

  let tokenPCM = '';
  let tokenMec = '';
  let ativoMV3 = null;
  let ativoHC1 = null;
  let osAutoDispatched = null;
  let osDedupId = null;

  await testar('Auth logins (PCM RE-1042 e Manutentor RE-3088)', async () => {
    const [rPcm, rMec, rAtivos] = await Promise.all([
      reqJson('/auth/login', { method: 'POST', body: { matricula: 'RE-1042', senha: 'cmms123' } }),
      reqJson('/auth/login', { method: 'POST', body: { matricula: 'RE-3088', senha: 'cmms123' } }),
      reqJson('/ativos')
    ]);
    assert.strictEqual(rPcm.status, 200);
    assert.strictEqual(rMec.status, 200);
    tokenPCM = rPcm.data.token;
    tokenMec = rMec.data.token;
    ativoMV3 = rAtivos.data.find((a) => a.tag_patrimonio === 'MV3-ROB-04');
    ativoHC1 = rAtivos.data.find((a) => a.tag_patrimonio === 'HC1-APT-02');
    assert.ok(ativoMV3 && ativoHC1);
  });

  // EIXO 2 & 3: Deduplicacao Ativa + Escalonamento de Prioridade por Adendo + Auto-Dispatch
  await testar('Eixo 2: Chamado degradacao_funcao abre normalmente e gera adendo com elevacao no 2o chamado', async () => {
    const r1 = await reqJson('/chamados', {
      method: 'POST',
      body: {
        ativo_id: ativoHC1.id,
        operador_matricula: 'RE-5001',
        subsistema: 'pneumatico',
        status_impacto: 'degradacao_funcao',
        descricao_sintoma: 'Queda leve pressao ciclo HC1',
        idempotency_key: 'test-hc1-idem-001'
      }
    });
    assert.strictEqual(r1.status, 201);
    assert.strictEqual(r1.data.acao, 'OS_CRIADA');
    assert.strictEqual(r1.data.despacho_automatico, false);
    osDedupId = r1.data.chamado.id;

    // Replay mesma idempotency_key
    const rReplay = await reqJson('/chamados', {
      method: 'POST',
      body: {
        ativo_id: ativoHC1.id,
        operador_matricula: 'RE-5001',
        subsistema: 'pneumatico',
        status_impacto: 'degradacao_funcao',
        idempotency_key: 'test-hc1-idem-001'
      }
    });
    assert.strictEqual(rReplay.status, 200);
    assert.strictEqual(rReplay.data.acao, 'IDEMPOTENTE');
    assert.strictEqual(rReplay.data.chamado.id, osDedupId);

    // 2o operador no mesmo ativo com maquina_parada -> vira Adendo + eleva prioridade + Auto-Dispatch eletrico/linha
    const r2 = await reqJson('/chamados', {
      method: 'POST',
      body: {
        ativo_id: ativoHC1.id,
        operador_matricula: 'RE-5001',
        subsistema: 'eletrico',
        status_impacto: 'maquina_parada',
        descricao_sintoma: 'Linha parou totalmente apos agravamento',
        idempotency_key: 'test-hc1-adendo-002'
      }
    });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.data.acao, 'AGRUPADO_COMO_ADENDO');
    assert.strictEqual(r2.data.elevou_prioridade, true);
    assert.strictEqual(r2.data.chamado.total_adendos, 1);
    assert.strictEqual(r2.data.chamado.status_impacto, 'maquina_parada');
  });

  await testar('Eixo 3: Linha parada critica (MV3-ROB-04) dispara Auto-Dispatch (T1=T0) e escala SLA Nivel 1 e 2', async () => {
    const r = await reqJson('/chamados', {
      method: 'POST',
      body: {
        ativo_id: ativoMV3.id,
        operador_matricula: 'RE-5001',
        subsistema: 'mecanico',
        status_impacto: 'maquina_parada',
        descricao_sintoma: 'Travamento garra KUKA',
        idempotency_key: 'test-mv3-autodisp-001'
      }
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.data.despacho_automatico, true);
    assert.strictEqual(r.data.chamado.status, 'atribuido');
    assert.strictEqual(Boolean(r.data.chamado.despacho_automatico), true);
    osAutoDispatched = r.data.chamado;

    // Simula SLA Nivel 1 (+6 minutos sem T2 -> redireciona para backup)
    const nowN1 = new Date(Date.now() + 6 * 60 * 1000).toISOString();
    const rSla1 = await reqJson('/v2/sla/verificar', {
      method: 'POST',
      token: tokenPCM,
      body: { now_override: nowN1 }
    });
    assert.strictEqual(rSla1.status, 200);
    const esc1 = rSla1.data.escalonamentos.find((e) => e.chamado_id === osAutoDispatched.id);
    assert.ok(esc1 && esc1.nivel === 1);

    // Simula SLA Nivel 2 (+16 minutos sem T2 -> alerta critico Supervisor PCM)
    const nowN2 = new Date(Date.now() + 16 * 60 * 1000).toISOString();
    const rSla2 = await reqJson('/v2/sla/verificar', {
      method: 'POST',
      token: tokenPCM,
      body: { now_override: nowN2 }
    });
    assert.strictEqual(rSla2.status, 200);
    const esc2 = rSla2.data.escalonamentos.find((e) => e.chamado_id === osAutoDispatched.id);
    assert.ok(esc2 && esc2.nivel === 2);

    const det = await reqJson(`/chamados/${osAutoDispatched.id}`);
    assert.strictEqual(det.data.sla_nivel_escalonado, 2);
    assert.ok(det.data.escalonamentos.length >= 2);
  });

  // EIXO 1: Sincronizacao Local-First Idempotente & Conflito 409
  await testar('Eixo 1: Outbox Local-First aplica timestamps causais, ignora replay duplicado e acusa 409 em conflito', async () => {
    // Atribui osDedupId explicitamente ao RE-3088 antes do teste offline
    await reqJson(`/chamados/${osDedupId}/atribuir`, {
      method: 'PATCH',
      token: tokenPCM,
      body: {} // Vamos buscar id do RE-3088 do banco ou atribuir via perfil manutentor
    });
    const rMe = await reqJson('/auth/me', { token: tokenMec });
    const mecId = rMe.data.usuario.id;

    await reqJson(`/chamados/${osDedupId}/atribuir`, {
      method: 'PATCH',
      token: tokenPCM,
      body: { mantenedor_id: mecId }
    });

    const tBase = Date.now() - 10 * 60 * 1000;
    const batch = [
      {
        event_id: 'sync-evt-t2-001',
        event_type: 'T2_INICIAR_REPARO',
        chamado_id: osDedupId,
        occurred_at_client_utc: new Date(tBase).toISOString(),
        payload: {}
      },
      {
        event_id: 'sync-evt-pausa-002',
        event_type: 'PAUSAR_OS',
        chamado_id: osDedupId,
        occurred_at_client_utc: new Date(tBase + 2 * 60 * 1000).toISOString(),
        payload: { motivo: 'aguardando_peca', justificativa: 'Teste pausa offline' }
      },
      {
        event_id: 'sync-evt-retoma-003',
        event_type: 'RETOMAR_OS',
        chamado_id: osDedupId,
        occurred_at_client_utc: new Date(tBase + 6 * 60 * 1000).toISOString(),
        payload: {}
      },
      {
        event_id: 'sync-evt-t3-004',
        event_type: 'T3_CONCLUIR_OS',
        chamado_id: osDedupId,
        occurred_at_client_utc: new Date(tBase + 9 * 60 * 1000).toISOString(),
        payload: {
          causa_raiz: 'Engate rapido pneumático com folga',
          acao_executada: 'Substituido engate rapido 8mm',
          arvore_falha_sistema: 'pneumatico'
        }
      }
    ];

    const rSync = await reqJson('/v2/sync/events', {
      method: 'POST',
      token: tokenMec,
      body: { device_id: 'tablet-mec-01', events: batch }
    });
    assert.strictEqual(rSync.status, 200);
    assert.strictEqual(rSync.data.resumo.aplicados, 4);

    // Replay idempotente
    const rReplay = await reqJson('/v2/sync/events', {
      method: 'POST',
      token: tokenMec,
      body: { device_id: 'tablet-mec-01', events: [batch[0]] }
    });
    assert.strictEqual(rReplay.status, 200);
    assert.strictEqual(rReplay.data.resumo.duplicados, 1);

    // Conflito 409: RE-3088 tenta concluir OS que agora esta atribuida ao backup (RE-3092 apos SLA N1!)
    const rConflito = await reqJson('/v2/sync/events', {
      method: 'POST',
      token: tokenMec,
      body: {
        device_id: 'tablet-mec-01',
        events: [
          {
            event_id: 'sync-evt-conflito-999',
            event_type: 'T3_CONCLUIR_OS',
            chamado_id: osAutoDispatched.id,
            occurred_at_client_utc: new Date().toISOString(),
            payload: {
              causa_raiz: 'Nota tecnica local que nao pode ser perdida',
              acao_executada: 'Tentativa offline apos reatribuicao'
            }
          }
        ]
      }
    });
    assert.strictEqual(rConflito.status, 409);
    assert.strictEqual(rConflito.data.results[0].status, 'CONFLITO_REATRIBUICAO');
  });

  // EIXO 4: Ingestao IoT HMAC-SHA256 & Anti-Chattering ISA-18.2
  await testar('Eixo 4: IoT valida HMAC-SHA256, aplica debounce <10s e suprime chattering >=3 em 5m', async () => {
    const gwId = 'gw-chaparia-mv3-01';
    const secret = getTestGatewayHmacKey(gwId);

    // 1. Rejeita assinatura invalida
    const rBad = await reqJson('/v2/iot/alarms', {
      method: 'POST',
      headers: { 'x-iot-signature': '0'.repeat(64) },
      body: { gateway_id: gwId, tag_ativo: 'MV3-ROB-04', codigo_falha_clp: 'FLT-BAD-HMAC' }
    });
    assert.strictEqual(rBad.status, 401);

    // 2. Heartbeat valido
    const hbBody = { gateway_id: gwId, status_saude: 'ONLINE' };
    const hbSig = signPayload(hbBody, secret);
    const rHb = await reqJson('/v2/iot/heartbeat', {
      method: 'POST',
      headers: { 'x-iot-signature': `sha256=${hbSig.signature}` },
      body: hbSig.raw
    });
    assert.strictEqual(rHb.status, 200);

    // 3. Chattering: 3 pulsos curtos em < 5m no codigo FLT-CHAT-99
    for (let i = 1; i <= 2; i++) {
      const pBody = {
        gateway_id: gwId,
        tag_ativo: 'PNT-CAB-01',
        codigo_falha_clp: 'FLT-CHAT-99',
        estado: 'CLEARED',
        duracao_ms: 2500
      };
      const pSig = signPayload(pBody, secret);
      const rPulse = await reqJson('/v2/iot/alarms', {
        method: 'POST',
        headers: { 'x-iot-signature': pSig.signature },
        body: pSig.raw
      });
      assert.strictEqual(rPulse.status, 202);
      assert.strictEqual(rPulse.data.status_gatekeeper, 'DEBOUNCED_CLEARED');
    }

    // 3o pulso dispara Anti-Chattering cool-down (15 min)
    const chatBody = {
      gateway_id: gwId,
      tag_ativo: 'PNT-CAB-01',
      codigo_falha_clp: 'FLT-CHAT-99',
      estado: 'ACTIVE',
      duracao_ms: 15000
    };
    const chatSig = signPayload(chatBody, secret);
    const rChat = await reqJson('/v2/iot/alarms', {
      method: 'POST',
      headers: { 'x-iot-signature': chatSig.signature },
      body: chatSig.raw
    });
    assert.strictEqual(rChat.status, 202);
    assert.strictEqual(rChat.data.status_gatekeeper, 'SUPRESSED_CHATTERING');

    // 4. Alarme sustentado real (novo codigo FLT-REAL-100) abre OS automatica
    const realBody = {
      gateway_id: gwId,
      topic: 'vanguard/telemetry/plant-faeterj-01/pintura/PNT-CAB-01/alarm',
      codigo_falha_clp: 'FLT-REAL-100',
      tag_clp: 'DB_PINTURA.TEMP_ALTA',
      severidade: 'CRITICAL',
      estado: 'ACTIVE',
      duracao_ms: 18000
    };
    const realSig = signPayload(realBody, secret);
    const rReal = await reqJson('/v2/iot/alarms', {
      method: 'POST',
      headers: { 'x-iot-signature': realSig.signature },
      body: realSig.raw
    });
    assert.strictEqual(rReal.status, 201);
    assert.strictEqual(rReal.data.status_gatekeeper, 'OS_ABERTA_IOT');
    assert.strictEqual(rReal.data.chamado.origem_abertura, 'IOT_PLC');
  });

  // EIXO 5 & 6: Taxonomia ISO 14224 + BOM + Baixa Direta Atomica + Metricas V2
  await testar('Eixos 5 e 6: Taxonomia ISO 14224 + BOM + Baixa Direta no encerramento + Disponibilidade Real Aop/Ai', async () => {
    const rTax = await reqJson('/v2/taxonomia');
    assert.strictEqual(rTax.status, 200);
    const modoMec = rTax.data.modos_falha.find((m) => m.subsistema === 'mecanico');
    const causaMec = modoMec.causas_raiz[0];
    const acao = rTax.data.acoes_corretivas[0];

    const rBom = await reqJson(`/v2/ativos/${ativoMV3.id}/bom`, { token: tokenMec });
    assert.strictEqual(rBom.status, 200);
    assert.ok(rBom.data.bom_pecas.length > 0);
    const pecaBom = rBom.data.bom_pecas[0];
    const estoqueAntes = Number(pecaBom.quantidade_estoque);
    assert.ok(pecaBom.saldo_livre !== undefined);

    // Atribui OS do MV3 ao mec RE-3088 e conclui com ISO 14224 + baixa direta
    const rMe = await reqJson('/auth/me', { token: tokenMec });
    await reqJson(`/chamados/${osAutoDispatched.id}/atribuir`, {
      method: 'PATCH',
      token: tokenPCM,
      body: { mantenedor_id: rMe.data.usuario.id }
    });

    const rConcluir = await reqJson(`/chamados/${osAutoDispatched.id}/concluir`, {
      method: 'POST',
      token: tokenMec,
      body: {
        modo_falha_id: modoMec.id,
        causa_raiz_id: causaMec.id,
        acao_corretiva_id: acao.id,
        pecas_consumidas: [{ peca_id: pecaBom.id, quantidade: 1, modalidade: 'BAIXA_DIRETA' }]
      }
    });
    assert.strictEqual(rConcluir.status, 200);
    assert.strictEqual(rConcluir.data.baixas_estoque[0].novo_saldo, estoqueAntes - 1);

    // Confere Dashboard V2
    const rMet = await reqJson('/metricas/dashboard?dias=30', { token: tokenPCM });
    assert.strictEqual(rMet.status, 200);
    assert.strictEqual(rMet.data.resumo_geral.linhas_ativas_consideradas, 5);
    assert.ok(rMet.data.resumo_geral.disponibilidade_operacional_pct !== undefined);
    assert.ok(rMet.data.resumo_geral.disponibilidade_inerente_pct !== undefined);
    assert.ok(Array.isArray(rMet.data.top_ofensores_downtime));
    assert.ok(Array.isArray(rMet.data.top_ofensores_volume));
    assert.ok(rMet.data.causas_raiz_por_setor.length > 0);
  });

  console.log('\n---------------------------------------------------------------------------');
  console.log(`TOTAL V2: ${total} testes | PASSOU: ${passaram} | FALHOU: ${falharam}`);
  console.log('---------------------------------------------------------------------------');

  await db.destroy();
  server.close();
  process.exit(falharam > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  console.error('Erro fatal nos testes V2:', err);
  await db.destroy().catch(() => {});
  process.exit(1);
});
