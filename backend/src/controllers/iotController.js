const crypto = require('crypto');
const db = require('../database/db');
const chamadoCoreService = require('../services/chamadoCoreService');

const DEBOUNCE_MIN_MS = Number(process.env.IOT_DEBOUNCE_MIN_MS || 10000);
const CHATTERING_WINDOW_MS = Number(process.env.IOT_CHATTERING_WINDOW_MS || 5 * 60 * 1000);
const CHATTERING_MAX_TRANSITIONS = Number(process.env.IOT_CHATTERING_MAX_TRANSITIONS || 3);
const CHATTERING_COOLDOWN_MS = Number(process.env.IOT_CHATTERING_COOLDOWN_MS || 15 * 60 * 1000);

function verificarAssinaturaHmac(req, secret) {
  const headerSig = req.headers['x-iot-signature'];
  if (!headerSig || !secret) return false;

  const fornecida = String(headerSig).replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fornecida)) return false;

  const payloadBuffer = req.rawBody
    ? Buffer.from(req.rawBody)
    : Buffer.from(JSON.stringify(req.body || {}));

  const esperada = crypto
    .createHmac('sha256', secret)
    .update(payloadBuffer)
    .digest('hex');

  const bufA = Buffer.from(fornecida, 'hex');
  const bufB = Buffer.from(esperada, 'hex');
  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

function extrairAssetDoTopico(topic) {
  if (!topic || typeof topic !== 'string') return null;
  // Formato: vanguard/telemetry/{plant_id}/{line_id}/{asset_id}/alarm
  const partes = topic.split('/').filter(Boolean);
  if (partes.length >= 6 && partes[0] === 'vanguard' && partes[1] === 'telemetry') {
    return partes[4];
  }
  return null;
}

function inferirSubsistemaCLP(subsistemaPayload, tagClp = '') {
  const validos = ['mecanico', 'eletrico', 'pneumatico', 'hidraulico', 'operacional'];
  if (subsistemaPayload && validos.includes(String(subsistemaPayload).toLowerCase())) {
    return String(subsistemaPayload).toLowerCase();
  }
  const upper = String(tagClp).toUpperCase();
  if (upper.includes('PNE') || upper.includes('AIR') || upper.includes('VALV')) return 'pneumatico';
  if (upper.includes('HID') || upper.includes('OIL') || upper.includes('PRESS')) return 'hidraulico';
  if (upper.includes('MEC') || upper.includes('VIB') || upper.includes('TORQ')) return 'mecanico';
  if (upper.includes('OPE') || upper.includes('REC')) return 'operacional';
  return 'eletrico';
}

const iotController = {
  /**
   * POST /api/v2/iot/alarms
   * Ingestao autenticada por HMAC-SHA256 com Gatekeeper Anti-Chattering (ISA-18.2).
   */
  async ingestAlarm(req, res) {
    try {
      const {
        gateway_id,
        topic,
        ativo_id,
        tag_ativo,
        codigo_falha_clp,
        tag_clp = 'DB_ALARM.FAULT',
        subsistema,
        severidade = 'CRITICAL',
        estado = 'ACTIVE',
        duracao_ms = 0,
        descricao
      } = req.body;

      if (!gateway_id || !codigo_falha_clp) {
        return res.status(400).json({
          erro: 'gateway_id e codigo_falha_clp sao obrigatorios no payload de telemetria.'
        });
      }

      const gateway = await db('iot_dispositivos')
        .where({ gateway_id, ativo: true })
        .first();

      if (!gateway) {
        return res.status(404).json({ erro: `Gateway IoT '${gateway_id}' nao cadastrado ou inativo.` });
      }

      if (!verificarAssinaturaHmac(req, gateway.hmac_secret)) {
        return res.status(401).json({ erro: 'Assinatura HMAC-SHA256 do Edge Gateway invalida ou ausente.' });
      }

      const agora = new Date();
      await db('iot_dispositivos')
        .where({ id: gateway.id })
        .update({ ultimo_heartbeat: agora, status_saude: 'ONLINE', updated_at: agora });

      const tagAlvo = (tag_ativo || extrairAssetDoTopico(topic) || '').trim().toUpperCase();
      const ativo = await db('ativos_postos')
        .where({ ativo: true })
        .andWhere(function () {
          if (ativo_id) this.where('id', Number(ativo_id));
          else if (tagAlvo) this.where('tag_patrimonio', tagAlvo);
          else this.whereRaw('1 = 0');
        })
        .first();

      if (!ativo) {
        return res.status(404).json({ erro: 'Ativo alvo do sinal CLP nao localizado.' });
      }

      const subsistemaInferido = inferirSubsistemaCLP(subsistema, `${tag_clp} ${codigo_falha_clp}`);
      const io = req.app.get('io');

      // 1. Verifica Cool-Down ativo de Chattering (ISA-18.2)
      const cooldownAtivo = await db('iot_sinais_ingestao')
        .where({ ativo_id: ativo.id, codigo_falha_clp })
        .where('cooldown_ate', '>', agora)
        .orderBy('id', 'desc')
        .first();

      if (cooldownAtivo) {
        await db('iot_sinais_ingestao').insert({
          gateway_id,
          ativo_id: ativo.id,
          codigo_falha_clp,
          tag_clp,
          severidade_clp: severidade,
          subsistema_inferido: subsistemaInferido,
          estado_sinal: 'SUPRESSED_CHATTERING',
          transicoes_janela_5m: cooldownAtivo.transicoes_janela_5m + 1,
          cooldown_ate: cooldownAtivo.cooldown_ate,
          payload_bruto_json: JSON.stringify(req.body),
          ocorrido_em: agora
        });

        return res.status(202).json({
          status_gatekeeper: 'SUPRESSED_CHATTERING',
          motivo: 'Alarme em janela de cool-down por chattering (ISA-18.2).',
          cooldown_ate: cooldownAtivo.cooldown_ate,
          ativo_tag: ativo.tag_patrimonio,
          codigo_falha_clp
        });
      }

      // 2. Contagem de transicoes na janela deslizante de 5 min
      const janelaInicio = new Date(agora.getTime() - CHATTERING_WINDOW_MS);
      const historicoRecente = await db('iot_sinais_ingestao')
        .where({ ativo_id: ativo.id, codigo_falha_clp })
        .andWhere('ocorrido_em', '>=', janelaInicio)
        .count('id as total')
        .first();

      const totalTransicoes = Number(historicoRecente?.total || 0) + 1;

      // 3. Anti-Chattering: >= 3 transicoes em 5 min -> suprime por 15 min
      if (totalTransicoes >= CHATTERING_MAX_TRANSITIONS) {
        const cooldownAte = new Date(agora.getTime() + CHATTERING_COOLDOWN_MS);

        await db('iot_sinais_ingestao').insert({
          gateway_id,
          ativo_id: ativo.id,
          codigo_falha_clp,
          tag_clp,
          severidade_clp: severidade,
          subsistema_inferido: subsistemaInferido,
          estado_sinal: 'SUPRESSED_CHATTERING',
          transicoes_janela_5m: totalTransicoes,
          cooldown_ate: cooldownAte,
          payload_bruto_json: JSON.stringify(req.body),
          ocorrido_em: agora
        });

        if (io) {
          io.emit('iot_chattering_supresso', {
            gateway_id,
            ativo_tag: ativo.tag_patrimonio,
            codigo_falha_clp,
            transicoes_5m: totalTransicoes,
            cooldown_ate: cooldownAte
          });
        }

        return res.status(202).json({
          status_gatekeeper: 'SUPRESSED_CHATTERING',
          motivo: `Chattering detectado (${totalTransicoes} transicoes em 5 min). Alarme suprimido ate ${cooldownAte.toISOString()}.`,
          transicoes_5m: totalTransicoes,
          cooldown_ate: cooldownAte
        });
      }

      // 4. Debounce de micro-oscilacao (< 10s ou sinal ja normalizado CLEARED)
      const duracaoNum = Number(duracao_ms || 0);
      if (String(estado).toUpperCase() === 'CLEARED' || (duracaoNum > 0 && duracaoNum < DEBOUNCE_MIN_MS)) {
        await db('iot_sinais_ingestao').insert({
          gateway_id,
          ativo_id: ativo.id,
          codigo_falha_clp,
          tag_clp,
          severidade_clp: severidade,
          subsistema_inferido: subsistemaInferido,
          estado_sinal: 'CLEARED',
          transicoes_janela_5m: totalTransicoes,
          cooldown_ate: null,
          payload_bruto_json: JSON.stringify(req.body),
          ocorrido_em: agora
        });

        return res.status(202).json({
          status_gatekeeper: 'DEBOUNCED_CLEARED',
          motivo: `Micro-oscilacao transitoria suprimida (duracao ${duracaoNum}ms / estado ${estado}).`,
          transicoes_5m: totalTransicoes
        });
      }

      // 5. Falha critica sustentada >= 10s -> Abertura automatica ou adendo IoT + Auto-Dispatch
      const isCritico = ['CRITICAL', 'HIGH', 'LINE_STOP', 'EMERGENCY'].includes(
        String(severidade).toUpperCase()
      );
      const statusImpacto = isCritico ? 'maquina_parada' : 'degradacao_funcao';

      const osResult = await chamadoCoreService.abrirOuDeduplicarOS({
        ativoId: ativo.id,
        origemAbertura: 'IOT_PLC',
        operadorMatricula: 'IOT-EDGE',
        operadorNome: `CLP Bridge (${gateway.gateway_id})`,
        subsistema: subsistemaInferido,
        descricaoSintoma:
          descricao || `[TELEMETRIA CLP] ${codigo_falha_clp} (${tag_clp}) - Duracao ${duracaoNum || DEBOUNCE_MIN_MS}ms`,
        statusImpacto,
        iotEventoRef: `${codigo_falha_clp}@${tag_clp}`,
        io
      });

      await db('iot_sinais_ingestao').insert({
        gateway_id,
        ativo_id: ativo.id,
        codigo_falha_clp,
        tag_clp,
        severidade_clp: severidade,
        subsistema_inferido: subsistemaInferido,
        estado_sinal: 'ACTIVE',
        transicoes_janela_5m: totalTransicoes,
        cooldown_ate: null,
        chamado_gerado_id: osResult.chamado?.id || osResult.chamadoId,
        payload_bruto_json: JSON.stringify(req.body),
        ocorrido_em: agora
      });

      const httpCode = osResult.acao === 'OS_CRIADA' ? 201 : 200;
      return res.status(httpCode).json({
        status_gatekeeper: osResult.acao === 'OS_CRIADA' ? 'OS_ABERTA_IOT' : 'ADENDO_IOT_ANEXADO',
        despacho_automatico: Boolean(osResult.despacho?.despachado),
        chamado: osResult.chamado
      });
    } catch (error) {
      console.error('[IoT Ingest] Erro ao processar alarme CLP:', error);
      return res.status(error.statusCode || 500).json({ erro: error.message || 'Erro interno na ingestao IoT.' });
    }
  },

  /**
   * POST /api/v2/iot/heartbeat
   * Watchdog periodico do gateway Edge PLC.
   */
  async heartbeat(req, res) {
    try {
      const { gateway_id, status_saude = 'ONLINE', metadata } = req.body;
      if (!gateway_id) {
        return res.status(400).json({ erro: 'gateway_id obrigatorio.' });
      }

      const gateway = await db('iot_dispositivos').where({ gateway_id, ativo: true }).first();
      if (!gateway) {
        return res.status(404).json({ erro: 'Gateway nao encontrado.' });
      }

      if (!verificarAssinaturaHmac(req, gateway.hmac_secret)) {
        return res.status(401).json({ erro: 'Assinatura HMAC invalida no heartbeat.' });
      }

      const agora = new Date();
      await db('iot_dispositivos')
        .where({ id: gateway.id })
        .update({
          status_saude,
          ultimo_heartbeat: agora,
          ...(metadata ? { metadata_json: JSON.stringify(metadata) } : {}),
          updated_at: agora
        });

      const io = req.app.get('io');
      if (io) {
        io.emit('iot_heartbeat', { gateway_id, status_saude, ultimo_heartbeat: agora });
      }

      return res.status(200).json({ ok: true, gateway_id, status_saude, ultimo_heartbeat: agora });
    } catch (error) {
      console.error('[IoT Heartbeat] Erro:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar heartbeat IoT.' });
    }
  },

  /**
   * GET /api/v2/iot/dispositivos
   * Consulta gateways e ultimos sinais (authenticated Central).
   */
  async listarDispositivosESinais(req, res) {
    try {
      const dispositivos = await db('iot_dispositivos')
        .select('id', 'gateway_id', 'nome', 'protocolo', 'plant_id', 'status_saude', 'ultimo_heartbeat', 'metadata_json', 'ativo')
        .orderBy('id', 'asc');

      const sinaisRecentes = await db('iot_sinais_ingestao as s')
        .join('ativos_postos as a', 's.ativo_id', 'a.id')
        .leftJoin('chamados_os as c', 's.chamado_gerado_id', 'c.id')
        .select(
          's.id',
          's.gateway_id',
          'a.tag_patrimonio',
          's.codigo_falha_clp',
          's.tag_clp',
          's.subsistema_inferido',
          's.estado_sinal',
          's.transicoes_janela_5m',
          's.cooldown_ate',
          'c.numero_os',
          's.ocorrido_em'
        )
        .orderBy('s.id', 'desc')
        .limit(20);

      return res.status(200).json({ dispositivos, sinais_recentes: sinaisRecentes });
    } catch (error) {
      console.error('[IoT] Erro ao listar telemetria:', error);
      return res.status(500).json({ erro: 'Erro ao consultar dispositivos IoT.' });
    }
  }
};

module.exports = iotController;
