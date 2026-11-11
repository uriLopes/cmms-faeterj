const db = require('../database/db');
const despachoService = require('./despachoService');

const DEDUP_WINDOW_MIN = Number(process.env.DEDUP_WINDOW_MIN || 120);
const ACTIVE_STATUSES = ['aberto', 'atribuido', 'em_deslocamento', 'em_reparo', 'pausado_peca'];

const SUBSISTEMA_MAP = {
  mecanico: 'mecanico',
  mecanica: 'mecanico',
  eletrico: 'eletrico',
  eletrica: 'eletrico',
  automacao: 'eletrico',
  pneumatico: 'pneumatico',
  pneumatica: 'pneumatico',
  hidraulico: 'hidraulico',
  hidraulica: 'hidraulico',
  operacional: 'operacional'
};

function normalizarSubsistema(valor) {
  if (!valor) return null;
  const key = String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return SUBSISTEMA_MAP[key] || null;
}

/**
 * Helper compartilhado de abertura transacional de OS:
 * - Idempotency key check
 * - Lock transacional no ativo (SELECT ... FOR UPDATE)
 * - Deduplicacao ativa (agrupa como chamado_adendos + eleva prioridade)
 * - Matriz de Auto-Dispatching (pula triagem quando maquina parada critica)
 */
const chamadoCoreService = {
  DEDUP_WINDOW_MIN,
  ACTIVE_STATUSES,

  calcularPrioridadeEImpacto(criticidadeAtivo, statusImpacto) {
    const impactoNorm = statusImpacto || 'maquina_parada';
    const isParada = impactoNorm === 'maquina_parada';
    const isDegradacao =
      impactoNorm === 'degradacao_funcao' || impactoNorm === 'operando_com_restricao';

    let prioridade = 'media';
    if (isParada) {
      prioridade = criticidadeAtivo === 'A' ? 'critica' : 'alta';
    } else if (isDegradacao) {
      prioridade = criticidadeAtivo === 'A' ? 'alta' : 'media';
    } else {
      prioridade = 'baixa';
    }

    const statusOperacional = isParada ? 'parado_quebra' : 'alerta_preditivo';
    const tipoManutencao = isParada ? 'corretiva_emergencial' : 'corretiva_programada';

    return {
      impactoNorm,
      isParada,
      prioridade,
      statusOperacional,
      tipoManutencao
    };
  },

  async gerarNumeroOS(trx) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    // Verifica unicidade basica na tabela
    const candidato = `OS-${ano}${mes}${dia}-${rand}`;
    const existe = await trx('chamados_os').where({ numero_os: candidato }).first();
    if (!existe) return candidato;
    return `OS-${ano}${mes}${dia}-${Date.now().toString().slice(-5)}`;
  },

  /**
   * Abre ou deduplica OS transacionalmente para Operador, Central ou Gateway IoT.
   */
  async abrirOuDeduplicarOS(params) {
    const {
      ativoId,
      origemAbertura = 'OPERADOR_QR',
      operadorMatricula,
      operadorNome,
      subsistema = null,
      sintomaId = null,
      descricaoSintoma = null,
      statusImpacto = 'maquina_parada',
      fotoAnexo = null,
      audioAnexo = null,
      idempotencyKey = null,
      iotEventoRef = null,
      forcarNovaOS = false,
      io = null
    } = params;

    const subsistemaNorm = normalizarSubsistema(subsistema);

    const resultado = await db.transaction(async (trx) => {
      // 1. Checagem de idempotencia estrita (retries offline/edge)
      if (idempotencyKey) {
        const jaProcessado = await trx('chamados_os')
          .where({ idempotency_key: idempotencyKey })
          .first();
        if (jaProcessado) {
          return {
            acao: 'IDEMPOTENTE',
            chamadoId: jaProcessado.id,
            adendo: null,
            despacho: null
          };
        }
      }

      // 2. Lock pessimista no ativo para serializar abertura concorrente no mesmo equipamento
      const ativo = await trx('ativos_postos')
        .where({ id: ativoId, ativo: true })
        .forUpdate()
        .first();

      if (!ativo) {
        const err = new Error('Ativo/posto nao encontrado ou inativo.');
        err.statusCode = 404;
        throw err;
      }

      const agora = new Date();
      const janelaCorte = new Date(agora.getTime() - DEDUP_WINDOW_MIN * 60 * 1000);
      const {
        impactoNorm,
        isParada,
        prioridade,
        statusOperacional,
        tipoManutencao
      } = chamadoCoreService.calcularPrioridadeEImpacto(ativo.criticidade, statusImpacto);

      // 3. Busca OS ativa dentro da janela T para deduplicacao ativa
      let osPai = null;
      if (!forcarNovaOS) {
        osPai = await trx('chamados_os')
          .where({ ativo_id: ativo.id })
          .whereIn('status', ACTIVE_STATUSES)
          .andWhere('t0_abertura', '>=', janelaCorte)
          .orderBy('id', 'desc')
          .forUpdate()
          .first();
      }

      if (osPai) {
        // Verifica se novo reporte agrava severidade (Degradacao -> Maquina Parada ou IoT corrobora)
        let elevouPrioridade = false;
        const updatesPai = {
          total_adendos: (osPai.total_adendos || 0) + 1,
          updated_at: agora
        };

        if (isParada && osPai.status_impacto !== 'maquina_parada') {
          updatesPai.status_impacto = 'maquina_parada';
          updatesPai.tipo_manutencao = 'corretiva_emergencial';
          updatesPai.prioridade = ativo.criticidade === 'A' ? 'critica' : 'alta';
          elevouPrioridade = true;

          await trx('ativos_postos')
            .where({ id: ativo.id })
            .update({ status_operacional: 'parado_quebra', updated_at: agora });
        }

        const origemAdendo = origemAbertura === 'IOT_PLC' ? 'IOT_PLC' : 'OPERADOR';

        const [adendoId] = await trx('chamado_adendos').insert({
          chamado_pai_id: osPai.id,
          origem: origemAdendo,
          operador_matricula: operadorMatricula,
          operador_nome: operadorNome,
          subsistema: subsistemaNorm || osPai.subsistema || null,
          criticidade_reportada: impactoNorm,
          descricao: descricaoSintoma || 'Confirmacao concorrente de anomalia na celula.',
          elevou_prioridade: elevouPrioridade,
          created_at: agora
        });

        await trx('chamados_os').where({ id: osPai.id }).update(updatesPai);

        // Caso tenha elevado para maquina parada e OS ainda esteja em aberto, tenta auto-dispatch
        let despacho = null;
        if (elevouPrioridade && osPai.status === 'aberto') {
          despacho = await despachoService.avaliarAutoDespacho(trx, {
            chamadoId: osPai.id,
            ativo,
            subsistema: subsistemaNorm || osPai.subsistema,
            status_impacto: 'maquina_parada',
            t0: agora
          });
        }

        const adendoCriado = await trx('chamado_adendos').where({ id: adendoId }).first();
        return {
          acao: 'DEDUPLICADO_ADENDO',
          chamadoId: osPai.id,
          elevouPrioridade,
          adendo: adendoCriado,
          despacho
        };
      }

      // 4. Nenhuma OS ativa equivalente -> Cria nova OS
      const numero_os = await chamadoCoreService.gerarNumeroOS(trx);

      const [novoId] = await trx('chamados_os').insert({
        numero_os,
        origem_abertura: origemAbertura,
        ativo_id: ativo.id,
        tipo_manutencao: tipoManutencao,
        prioridade,
        status: 'aberto',
        status_impacto: impactoNorm,
        operador_matricula: operadorMatricula,
        operador_nome: operadorNome,
        sintoma_id: sintomaId || null,
        subsistema: subsistemaNorm,
        descricao_sintoma: descricaoSintoma || null,
        foto_anexo: fotoAnexo || null,
        audio_anexo: audioAnexo || null,
        idempotency_key: idempotencyKey || null,
        iot_evento_ref: iotEventoRef || null,
        t0_abertura: agora,
        created_at: agora,
        updated_at: agora
      });

      await trx('ativos_postos')
        .where({ id: ativo.id })
        .update({
          status_operacional: statusOperacional,
          updated_at: agora
        });

      // 5. Eixo 3: Avalia Auto-Dispatching imediato para linha parada critica
      const despacho = await despachoService.avaliarAutoDespacho(trx, {
        chamadoId: novoId,
        ativo,
        subsistema: subsistemaNorm,
        status_impacto: impactoNorm,
        t0: agora
      });

      return {
        acao: 'OS_CRIADA',
        chamadoId: novoId,
        adendo: null,
        despacho
      };
    });

    // Emissoes WebSocket apos commit garantido
    const chamadoController = require('../controllers/chamadoController');
    const chamadoCompleto = await chamadoController._buscarDetalhado(resultado.chamadoId);

    if (io && chamadoCompleto) {
      if (resultado.acao === 'DEDUPLICADO_ADENDO') {
        io.emit('adendo_chamado', {
          chamado: chamadoCompleto,
          adendo: resultado.adendo,
          elevou_prioridade: resultado.elevouPrioridade
        });
        io.emit('os_atualizada', { chamado: chamadoCompleto });
      } else if (resultado.acao === 'OS_CRIADA') {
        io.emit('novo_chamado', {
          chamado: chamadoCompleto,
          despacho_automatico: Boolean(resultado.despacho?.despachado)
        });
        if (resultado.despacho?.despachado) {
          io.emit('auto_despacho_executado', {
            chamado: chamadoCompleto,
            mantenedor: resultado.despacho.mantenedor,
            sla_aceite_minutos: resultado.despacho.sla_aceite_minutos
          });
        }
      }
    }

    return {
      ...resultado,
      chamado: chamadoCompleto
    };
  },

  /**
   * Consumo ou reserva atomica de peca sobressalente dentro de uma transacao existente.
   */
  async registrarPecaNaOSTrx(trx, { chamadoId, pecaId, quantidade, usuarioId, modalidade = 'BAIXA_DIRETA', dataEvento = new Date(), observacao = null }) {
    const qtd = Number(quantidade);
    if (!pecaId || !qtd || qtd <= 0) {
      const err = new Error('peca_id e quantidade valida (> 0) sao obrigatorios.');
      err.statusCode = 400;
      throw err;
    }

    const peca = await trx('pecas').where({ id: pecaId, ativo: true }).forUpdate().first();
    if (!peca) {
      const err = new Error(`Peca ID ${pecaId} nao encontrada ou inativa.`);
      err.statusCode = 404;
      throw err;
    }

    const reservadasRow = await trx('pecas_utilizadas_os')
      .where({ peca_id: peca.id, status_movimentacao: 'reserva_pendente' })
      .sum('quantidade as total')
      .first();
    const qtdReservada = Number(reservadasRow?.total || 0);
    const saldoLivre = Number(peca.quantidade_estoque) - qtdReservada;

    if (modalidade === 'RESERVA_PENDENTE') {
      if (saldoLivre < qtd) {
        const err = new Error(`Saldo livre insuficiente para reserva (${peca.codigo_sap}). Livre: ${saldoLivre}, Solicitado: ${qtd}.`);
        err.statusCode = 400;
        throw err;
      }

      const [solicitacaoId] = await trx('pecas_utilizadas_os').insert({
        chamado_id: chamadoId,
        peca_id: peca.id,
        quantidade: qtd,
        status_movimentacao: 'reserva_pendente',
        solicitado_por_id: usuarioId,
        created_at: dataEvento
      });

      await trx('movimentacoes_estoque').insert({
        peca_id: peca.id,
        chamado_id: chamadoId,
        usuario_id: usuarioId,
        tipo_movimentacao: 'RESERVA',
        quantidade: qtd,
        saldo_anterior: peca.quantidade_estoque,
        saldo_posterior: peca.quantidade_estoque,
        observacao: observacao || 'Reserva de peca pelo Field',
        created_at: dataEvento
      });

      return { id: solicitacaoId, modalidade: 'RESERVA_PENDENTE', novo_saldo: peca.quantidade_estoque };
    }

    // BAIXA_DIRETA atomica no campo
    if (peca.quantidade_estoque < qtd) {
      const err = new Error(`Estoque fisico insuficiente (${peca.codigo_sap}). Disponivel: ${peca.quantidade_estoque}, Solicitado: ${qtd}.`);
      err.statusCode = 400;
      throw err;
    }

    const saldoAnterior = Number(peca.quantidade_estoque);
    const saldoPosterior = saldoAnterior - qtd;

    await trx('pecas').where({ id: peca.id }).decrement('quantidade_estoque', qtd);

    const [movOsId] = await trx('pecas_utilizadas_os').insert({
      chamado_id: chamadoId,
      peca_id: peca.id,
      quantidade: qtd,
      status_movimentacao: 'baixado_almoxarifado',
      solicitado_por_id: usuarioId,
      atendido_por_id: usuarioId,
      created_at: dataEvento,
      data_baixa: dataEvento
    });

    await trx('movimentacoes_estoque').insert({
      peca_id: peca.id,
      chamado_id: chamadoId,
      usuario_id: usuarioId,
      tipo_movimentacao: 'BAIXA_DIRETA',
      quantidade: qtd,
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      observacao: observacao || 'Baixa direta atomica na OS (Vanguard Field)',
      created_at: dataEvento
    });

    return {
      id: movOsId,
      peca_id: peca.id,
      codigo_sap: peca.codigo_sap,
      modalidade: 'BAIXA_DIRETA',
      saldo_anterior: saldoAnterior,
      novo_saldo: saldoPosterior,
      abaixo_minimo: saldoPosterior <= Number(peca.quantidade_minima)
    };
  },

  /**
   * Conclusao transacional unificada de OS (suporta Taxonomia ISO 14224 V2 e campos livres V1).
   */
  async concluirOSTrx(trx, {
    chamado,
    mantenedorId,
    dataConclusao = new Date(),
    modo_falha_id = null,
    causa_raiz_id = null,
    acao_corretiva_id = null,
    causa_raiz = null,
    acao_executada = null,
    arvore_falha_sistema = null,
    necessita_revisao_preventiva = false,
    observacoes_tecnicas = null,
    pecas_consumidas = []
  }) {
    let modoObj = null;
    let causaObj = null;
    let acaoObj = null;

    if (modo_falha_id || causa_raiz_id || acao_corretiva_id) {
      if (!modo_falha_id || !causa_raiz_id || !acao_corretiva_id) {
        const err = new Error('Taxonomia ISO 14224 incompleta: informe modo_falha_id, causa_raiz_id e acao_corretiva_id.');
        err.statusCode = 400;
        throw err;
      }

      modoObj = await trx('iso_modos_falha').where({ id: modo_falha_id, ativo: true }).first();
      causaObj = await trx('iso_causas_raiz').where({ id: causa_raiz_id, ativo: true }).first();
      acaoObj = await trx('iso_acoes_corretivas').where({ id: acao_corretiva_id, ativo: true }).first();

      if (!modoObj || !causaObj || !acaoObj) {
        const err = new Error('Codigos de taxonomia ISO 14224 invalidos ou inativos.');
        err.statusCode = 400;
        throw err;
      }

      if (causaObj.modo_falha_id !== modoObj.id) {
        const err = new Error('A Causa Raiz selecionada nao pertence ao Modo de Falha informado.');
        err.statusCode = 400;
        throw err;
      }
    }

    const causaFinal = causa_raiz || (causaObj ? `[${causaObj.codigo_iso}] ${causaObj.nome}` : null);
    const acaoFinal = acao_executada || (acaoObj ? `[${acaoObj.codigo_iso}] ${acaoObj.nome}` : null);
    const arvoreFinal = arvore_falha_sistema || (modoObj ? modoObj.subsistema : chamado.subsistema) || null;

    if (!causaFinal || !acaoFinal || !arvoreFinal) {
      const err = new Error('Informe os codigos ISO 14224 ou os campos causa_raiz, acao_executada e arvore_falha_sistema.');
      err.statusCode = 400;
      throw err;
    }

    // Encerra pausa aberta se houver
    const pausaAberta = await trx('os_pausas')
      .where({ chamado_id: chamado.id })
      .whereNull('t_fim_pausa')
      .orderBy('id', 'desc')
      .first();

    if (pausaAberta) {
      const fimMs = new Date(dataConclusao).getTime();
      const iniMs = new Date(pausaAberta.t_inicio_pausa).getTime();
      const duracaoPausa = Math.max(0, Math.round((fimMs - iniMs) / (1000 * 60)));
      await trx('os_pausas').where({ id: pausaAberta.id }).update({
        t_fim_pausa: dataConclusao,
        duracao_minutos: duracaoPausa
      });
    }

    const todasPausas = await trx('os_pausas').where({ chamado_id: chamado.id });
    const totalPausadoMin = todasPausas.reduce((acc, p) => acc + (p.duracao_minutos || 0), 0);

    const t0Ms = new Date(chamado.t0_abertura).getTime();
    const t2Ref = chamado.t2_inicio_reparo ? new Date(chamado.t2_inicio_reparo).getTime() : t0Ms;
    const t3Ms = new Date(dataConclusao).getTime();

    const tempoDowntimeTotal = Math.max(1, Math.round((t3Ms - t0Ms) / (1000 * 60)));
    const tempoReparoBruto = Math.max(1, Math.round((t3Ms - t2Ref) / (1000 * 60)));
    const tempoReparoLiquido = Math.max(1, tempoReparoBruto - totalPausadoMin);

    const subsistemaChamado = normalizarSubsistema(chamado.subsistema || arvoreFinal);

    await trx('chamados_os')
      .where({ id: chamado.id })
      .update({
        status: 'concluido',
        subsistema: subsistemaChamado,
        t2_inicio_reparo: chamado.t2_inicio_reparo || chamado.t1_atribuicao || chamado.t0_abertura,
        t3_conclusao_reparo: dataConclusao,
        tempo_reparo_liquido_minutos: tempoReparoLiquido,
        tempo_downtime_total_minutos: tempoDowntimeTotal,
        updated_at: dataConclusao
      });

    await trx('apontamentos_os').insert({
      chamado_id: chamado.id,
      mantenedor_id: mantenedorId,
      causa_raiz: causaFinal,
      acao_executada: acaoFinal,
      arvore_falha_sistema: arvoreFinal,
      modo_falha_id: modoObj ? modoObj.id : null,
      causa_raiz_id: causaObj ? causaObj.id : null,
      acao_corretiva_id: acaoObj ? acaoObj.id : null,
      necessita_revisao_preventiva: Boolean(necessita_revisao_preventiva || acaoObj?.gera_pendencia_preventiva),
      observacoes_tecnicas: observacoes_tecnicas || null,
      created_at: dataConclusao
    });

    const baixasEstoque = [];
    if (Array.isArray(pecas_consumidas) && pecas_consumidas.length > 0) {
      for (const item of pecas_consumidas) {
        const resPeca = await chamadoCoreService.registrarPecaNaOSTrx(trx, {
          chamadoId: chamado.id,
          pecaId: item.peca_id,
          quantidade: item.quantidade,
          usuarioId: mantenedorId,
          modalidade: item.modalidade || 'BAIXA_DIRETA',
          dataEvento: dataConclusao,
          observacao: item.observacao || `Baixa no encerramento OS ${chamado.numero_os}`
        });
        baixasEstoque.push(resPeca);
      }
    }

    // Libera ativo somente se nao houver outra OS ativa de parada no mesmo posto
    const outraOsParada = await trx('chamados_os')
      .where({ ativo_id: chamado.ativo_id, status_impacto: 'maquina_parada' })
      .whereNot({ id: chamado.id })
      .whereIn('status', ACTIVE_STATUSES)
      .first();

    if (!outraOsParada) {
      await trx('ativos_postos')
        .where({ id: chamado.ativo_id })
        .update({ status_operacional: 'em_operacao', updated_at: dataConclusao });
    }

    return {
      tempoReparoLiquido,
      tempoDowntimeTotal,
      totalPausadoMin,
      baixasEstoque
    };
  }
};

module.exports = chamadoCoreService;
