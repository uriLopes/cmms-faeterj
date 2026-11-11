const db = require('../database/db');
const chamadoCoreService = require('../services/chamadoCoreService');

function diferencaMinutos(dataIni, dataFim) {
  if (!dataIni || !dataFim) return 0;
  return Math.max(0, Math.round((new Date(dataFim).getTime() - new Date(dataIni).getTime()) / 60000));
}

const syncController = {
  /**
   * POST /api/v2/sync/events
   * Reconciliador Local-First idempotente para eventos da fila offline (IndexedDB Outbox).
   * Preserva timestamps causais do cliente (T2, pausas, T3) e detecta conflitos de reatribuicao.
   */
  async sincronizarEventos(req, res) {
    try {
      const { device_id = 'field-web-client', events } = req.body;
      const usuarioId = req.user.id;
      const perfil = req.user.perfil;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ erro: 'Lista de eventos offline (events) e obrigatoria.' });
      }

      // Ordena cronologicamente pelo instante exato gerado no campo (causa -> efeito)
      const ordenados = [...events].sort(
        (a, b) => new Date(a.occurred_at_client_utc).getTime() - new Date(b.occurred_at_client_utc).getTime()
      );

      const resultados = [];
      const osImpactadas = new Set();

      for (const evt of ordenados) {
        const {
          event_id,
          event_type,
          chamado_id,
          occurred_at_client_utc,
          payload = {}
        } = evt;

        if (!event_id || !event_type || !occurred_at_client_utc) {
          resultados.push({
            event_id: event_id || null,
            status: 'REJEITADO_VALIDACAO',
            erro: 'Campos event_id, event_type e occurred_at_client_utc sao obrigatorios.'
          });
          continue;
        }

        const agoraServidor = new Date();
        const clientTs = new Date(occurred_at_client_utc);
        if (Number.isNaN(clientTs.getTime())) {
          resultados.push({
            event_id,
            status: 'REJEITADO_VALIDACAO',
            erro: 'occurred_at_client_utc invalido.'
          });
          continue;
        }

        // Clamping leve caso relogio do dispositivo esteja muito no futuro (> 5 min)
        const tsEfetivo =
          clientTs.getTime() > agoraServidor.getTime() + 5 * 60 * 1000 ? agoraServidor : clientTs;

        const resEvento = await db.transaction(async (trx) => {
          // 1. Checagem estrita de Idempotencia
          const jaExiste = await trx('outbox_eventos_sync').where({ event_id }).first();
          if (jaExiste) {
            return {
              event_id,
              chamado_id: jaExiste.chamado_id,
              status: 'IGNORADO_DUPLICADO',
              status_original: jaExiste.status_reconciliacao
            };
          }

          const gravarAuditoria = async (statusRec, motivo = null) => {
            await trx('outbox_eventos_sync').insert({
              event_id,
              device_id,
              usuario_id: usuarioId,
              chamado_id: chamado_id ? Number(chamado_id) : null,
              event_type,
              occurred_at_client_utc: tsEfetivo,
              received_at_server_utc: agoraServidor,
              payload_json: JSON.stringify(payload),
              status_reconciliacao: statusRec,
              motivo_reconciliacao: motivo,
              created_at: agoraServidor
            });
          };

          if (!chamado_id) {
            await gravarAuditoria('REJEITADO_VALIDACAO', 'chamado_id ausente para evento de campo.');
            return { event_id, status: 'REJEITADO_VALIDACAO', motivo: 'chamado_id obrigatorio.' };
          }

          const chamado = await trx('chamados_os')
            .where({ id: Number(chamado_id) })
            .forUpdate()
            .first();

          if (!chamado) {
            await gravarAuditoria('REJEITADO_VALIDACAO', 'OS nao encontrada.');
            return { event_id, chamado_id, status: 'REJEITADO_VALIDACAO', motivo: 'OS nao encontrada.' };
          }

          // 2. Guarda de conflito por reatribuicao / fechamento concorrente na Central
          const reatribuidoParaOutro =
            chamado.mantenedor_atribuido_id &&
            chamado.mantenedor_atribuido_id !== usuarioId &&
            perfil !== 'admin';

          const jaFinalizadaPorOutro =
            ['concluido', 'cancelado_invalido'].includes(chamado.status) &&
            event_type !== 'APONTAR_PECA';

          if (reatribuidoParaOutro || jaFinalizadaPorOutro) {
            const motivoConflito = reatribuidoParaOutro
              ? `OS ${chamado.numero_os} foi reatribuida na Central para outro mantenedor enquanto offline.`
              : `OS ${chamado.numero_os} ja foi encerrada (${chamado.status}) no servidor.`;

            // Preserva eventuais notas tecnicas como adendo de historico para nao perder trabalho digitado offline
            if (payload.observacoes_tecnicas || payload.causa_raiz || payload.acao_executada) {
              await trx('chamado_adendos').insert({
                chamado_pai_id: chamado.id,
                origem: 'SYNC_CONFLITO',
                operador_matricula: req.user.matricula,
                operador_nome: req.user.nome,
                descricao: `[OFFLINE PRESERVADO - ${event_type}] Causa: ${payload.causa_raiz || '-'} | Obs: ${payload.observacoes_tecnicas || '-'}`,
                elevou_prioridade: false,
                created_at: agoraServidor
              });
              await trx('chamados_os')
                .where({ id: chamado.id })
                .increment('total_adendos', 1);
            }

            await gravarAuditoria('CONFLITO_REATRIBUICAO', motivoConflito);
            return {
              event_id,
              chamado_id: chamado.id,
              numero_os: chamado.numero_os,
              status: 'CONFLITO_REATRIBUICAO',
              http_status: 409,
              motivo: motivoConflito,
              estado_servidor: {
                status: chamado.status,
                mantenedor_atribuido_id: chamado.mantenedor_atribuido_id
              }
            };
          }

          // 3. Execucao causal por tipo de evento
          if (event_type === 'T2_INICIAR_REPARO') {
            const t2Efetivo = chamado.t2_inicio_reparo || tsEfetivo;
            const refDeslocamento = chamado.t1_atribuicao || chamado.t0_abertura;
            const tempoDesloc = diferencaMinutos(refDeslocamento, t2Efetivo);

            await trx('chamados_os')
              .where({ id: chamado.id })
              .update({
                mantenedor_atribuido_id: chamado.mantenedor_atribuido_id || usuarioId,
                t1_atribuicao: chamado.t1_atribuicao || t2Efetivo,
                t2_inicio_reparo: t2Efetivo,
                tempo_deslocamento_minutos: tempoDesloc,
                status: 'em_reparo',
                updated_at: tsEfetivo
              });

            await trx('ativos_postos')
              .where({ id: chamado.ativo_id })
              .update({ status_operacional: 'em_manutencao', updated_at: tsEfetivo });

            await gravarAuditoria('APLICADO', 'Inicio de reparo T2 sincronizado com timestamp local.');
            osImpactadas.add(chamado.id);
            return { event_id, chamado_id: chamado.id, status: 'APLICADO', novo_status: 'em_reparo' };
          }

          if (event_type === 'PAUSAR_OS') {
            const motivosValidos = ['aguardando_peca', 'apoio_especialista', 'troca_turno', 'seguranca_loto', 'teste_operacional'];
            const motivoFinal = motivosValidos.includes(payload.motivo) ? payload.motivo : 'aguardando_peca';

            await trx('os_pausas').insert({
              chamado_id: chamado.id,
              motivo: motivoFinal,
              justificativa: payload.justificativa || payload.observacao || 'Pausa registrada offline',
              t_inicio_pausa: tsEfetivo,
              registrado_por_id: usuarioId
            });

            await trx('chamados_os')
              .where({ id: chamado.id })
              .update({ status: 'pausado_peca', updated_at: tsEfetivo });

            await gravarAuditoria('APLICADO', 'Pausa offline aplicada.');
            osImpactadas.add(chamado.id);
            return { event_id, chamado_id: chamado.id, status: 'APLICADO', novo_status: 'pausado_peca' };
          }

          if (event_type === 'RETOMAR_OS') {
            const pausaAberta = await trx('os_pausas')
              .where({ chamado_id: chamado.id })
              .whereNull('t_fim_pausa')
              .orderBy('id', 'desc')
              .first();

            if (pausaAberta) {
              const duracao = diferencaMinutos(pausaAberta.t_inicio_pausa, tsEfetivo);
              await trx('os_pausas').where({ id: pausaAberta.id }).update({
                t_fim_pausa: tsEfetivo,
                duracao_minutos: duracao
              });
            }

            await trx('chamados_os')
              .where({ id: chamado.id })
              .update({ status: 'em_reparo', updated_at: tsEfetivo });

            await gravarAuditoria('APLICADO', 'Retomada offline aplicada.');
            osImpactadas.add(chamado.id);
            return { event_id, chamado_id: chamado.id, status: 'APLICADO', novo_status: 'em_reparo' };
          }

          if (event_type === 'T3_CONCLUIR_OS') {
            const resumoConclusao = await chamadoCoreService.concluirOSTrx(trx, {
              chamado,
              mantenedorId: usuarioId,
              dataConclusao: tsEfetivo,
              modo_falha_id: payload.modo_falha_id,
              causa_raiz_id: payload.causa_raiz_id,
              acao_corretiva_id: payload.acao_corretiva_id,
              causa_raiz: payload.causa_raiz,
              acao_executada: payload.acao_executada,
              arvore_falha_sistema: payload.arvore_falha_sistema,
              necessita_revisao_preventiva: payload.necessita_revisao_preventiva,
              observacoes_tecnicas: payload.observacoes_tecnicas,
              pecas_consumidas: payload.pecas_consumidas || []
            });

            await gravarAuditoria('APLICADO', 'Conclusao T3 sincronizada com timestamp offline.');
            osImpactadas.add(chamado.id);
            return {
              event_id,
              chamado_id: chamado.id,
              status: 'APLICADO',
              novo_status: 'concluido',
              tempo_reparo_liquido_minutos: resumoConclusao.tempoReparoLiquido
            };
          }

          if (event_type === 'APONTAR_PECA') {
            const resPeca = await chamadoCoreService.registrarPecaNaOSTrx(trx, {
              chamadoId: chamado.id,
              pecaId: payload.peca_id,
              quantidade: payload.quantidade,
              usuarioId,
              modalidade: payload.modalidade || 'BAIXA_DIRETA',
              dataEvento: tsEfetivo,
              observacao: payload.observacao
            });
            await gravarAuditoria('APLICADO', 'Apontamento de peca sincronizado.');
            osImpactadas.add(chamado.id);
            return { event_id, chamado_id: chamado.id, status: 'APLICADO', peca_resultado: resPeca };
          }

          await gravarAuditoria('REJEITADO_VALIDACAO', `event_type desconhecido: ${event_type}`);
          return { event_id, chamado_id: chamado.id, status: 'REJEITADO_VALIDACAO', motivo: `Tipo ${event_type} invalido.` };
        });

        resultados.push(resEvento);
      }

      // Emite notificacao via Socket.io para OSs reconciliadas
      const io = req.app.get('io');
      if (io && osImpactadas.size > 0) {
        const chamadoController = require('./chamadoController');
        for (const idOs of osImpactadas) {
          const osAtualizada = await chamadoController._buscarDetalhado(idOs);
          if (osAtualizada) {
            io.emit(osAtualizada.status === 'concluido' ? 'os_concluida' : 'os_atualizada', {
              chamado: osAtualizada
            });
          }
        }
      }

      const aplicados = resultados.filter((r) => r.status === 'APLICADO').length;
      const conflitos = resultados.filter((r) => r.status === 'CONFLITO_REATRIBUICAO').length;
      const duplicados = resultados.filter((r) => r.status === 'IGNORADO_DUPLICADO').length;

      let httpStatus = 200;
      if (conflitos > 0 && aplicados === 0) httpStatus = 409;
      else if (conflitos > 0 && aplicados > 0) httpStatus = 207;

      return res.status(httpStatus).json({
        resumo: { total: resultados.length, aplicados, conflitos, duplicados },
        results: resultados
      });
    } catch (error) {
      console.error('[Sync Offline] Erro:', error);
      return res.status(error.statusCode || 500).json({ erro: error.message || 'Erro interno na sincronizacao Local-First.' });
    }
  }
};

module.exports = syncController;
