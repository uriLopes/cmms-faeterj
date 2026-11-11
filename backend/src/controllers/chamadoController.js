const db = require('../database/db');
const chamadoCoreService = require('../services/chamadoCoreService');
const despachoService = require('../services/despachoService');

/**
 * Função utilitária para gerar número sequencial amigável de OS (ex: OS-2026-0001)
 */
async function gerarNumeroOS() {
  const anoAtual = new Date().getFullYear();
  const ultimoChamado = await db('chamados_os')
    .where('numero_os', 'like', `OS-${anoAtual}-%`)
    .orderBy('id', 'desc')
    .first();

  let sequencial = 1;
  if (ultimoChamado && ultimoChamado.numero_os) {
    const partes = ultimoChamado.numero_os.split('-');
    if (partes.length === 3) {
      sequencial = parseInt(partes[2], 10) + 1;
    }
  }

  const padded = String(sequencial).padStart(4, '0');
  return `OS-${anoAtual}-${padded}`;
}

/**
 * Diferença em minutos entre duas datas
 */
function diferencaMinutos(inicio, fim) {
  if (!inicio || !fim) return 0;
  const dInicio = new Date(inicio);
  const dFim = new Date(fim);
  const diffMs = dFim.getTime() - dInicio.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60)));
}

const chamadoController = {
  /**
   * POST /api/chamados
   * Abertura do Chamado pelo Operador (Fricção Zero)
   * Captura T0 (abertura / parada reportada)
   */
  async criar(req, res) {
    try {
      const {
        qr_code_token,
        ativo_id,
        operador_matricula,
        operador_nome,
        sintoma_id,
        subsistema,
        descricao_sintoma,
        status_impacto,
        origem_abertura,
        idempotency_key,
        forcar_nova_os,
        foto_anexo,
        audio_anexo
      } = req.body;

      if (!operador_matricula) {
        return res.status(400).json({ erro: 'Matrícula do operador é obrigatória.' });
      }

      // Validação estrita de operador previamente cadastrado no sistema fabril
      const matOperador = String(operador_matricula).trim();
      const semPrefixoMat = matOperador.replace(/^RE-?/i, '').trim();

      const usuarioOperador = await db('usuarios')
        .where({ ativo: true })
        .andWhere(function() {
          this.where('matricula', matOperador)
            .orWhere('matricula', `RE-${semPrefixoMat}`)
            .orWhere('matricula', semPrefixoMat);
        })
        .first();

      if (!usuarioOperador) {
        return res.status(400).json({
          erro: `Identifiant "${matOperador}" não cadastrado no sistema fabril. Procure o Team Leader.`
        });
      }

      // Localiza ativo por QR Code ou por ID direto
      let ativo;
      if (qr_code_token) {
        ativo = await db('ativos_postos').where({ qr_code_token, ativo: true }).first();
      } else if (ativo_id) {
        ativo = await db('ativos_postos').where({ id: ativo_id, ativo: true }).first();
      }

      if (!ativo) {
        return res.status(404).json({ erro: 'Ativo/posto não encontrado.' });
      }

      const io = req.app.get('io');
      const origemFinal =
        origem_abertura || (qr_code_token ? 'OPERADOR_QR' : 'OPERADOR_HIERARQUIA');

      const resultado = await chamadoCoreService.abrirOuDeduplicarOS({
        ativoId: ativo.id,
        origemAbertura: origemFinal,
        operadorMatricula: usuarioOperador.matricula,
        operadorNome: usuarioOperador.nome || operador_nome,
        subsistema: subsistema || null,
        sintomaId: sintoma_id || null,
        descricaoSintoma: descricao_sintoma || null,
        statusImpacto: status_impacto || 'maquina_parada',
        fotoAnexo: foto_anexo || null,
        audioAnexo: audio_anexo || null,
        idempotencyKey: idempotency_key || null,
        forcarNovaOS: Boolean(forcar_nova_os),
        io
      });

      if (resultado.acao === 'DEDUPLICADO_ADENDO') {
        return res.status(200).json({
          mensagem: 'Chamado agrupado como adendo de contexto na OS já em aberto.',
          acao: 'AGRUPADO_COMO_ADENDO',
          elevou_prioridade: resultado.elevouPrioridade,
          adendo: resultado.adendo,
          chamado: resultado.chamado
        });
      }

      if (resultado.acao === 'IDEMPOTENTE') {
        return res.status(200).json({
          mensagem: 'Chamado recuperado por chave de idempotencia.',
          acao: 'IDEMPOTENTE',
          chamado: resultado.chamado
        });
      }

      return res.status(201).json({
        mensagem: 'Ordem de serviço aberta com sucesso.',
        acao: 'OS_CRIADA',
        despacho_automatico: Boolean(resultado.despacho?.despachado),
        despacho: resultado.despacho || null,
        chamado: resultado.chamado
      });
    } catch (error) {
      console.error('[Chamados] Erro ao abrir chamado:', error);
      return res.status(error.statusCode || 500).json({ erro: error.message || 'Erro interno ao registrar ordem de serviço.' });
    }
  },

  /**
   * GET /api/chamados
   * Listagem de ordens de serviço com filtros avançados para o cockpit
   */
  async listar(req, res) {
    try {
      const { status, linha_id, prioridade, mantenedor_id, ordenar } = req.query;

      const query = db('chamados_os as c')
        .join('ativos_postos as a', 'c.ativo_id', 'a.id')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .leftJoin('sintomas_falha as s', 'c.sintoma_id', 's.id')
        .leftJoin('usuarios as m', 'c.mantenedor_atribuido_id', 'm.id')
        .select(
          'c.id',
          'c.numero_os',
          'c.status',
          'c.prioridade',
          'c.tipo_manutencao',
          'c.operador_matricula',
          'c.operador_nome',
          's.descricao as sintoma_descricao',
          'c.descricao_sintoma',
          'a.id as ativo_id',
          'a.tag_patrimonio',
          'a.nome as ativo_nome',
          'a.posto_trabalho',
          'a.criticidade as ativo_criticidade',
          'l.id as linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'm.id as mantenedor_id',
          'm.nome as mantenedor_nome',
          'c.chamado_invalido',
          'c.status_impacto',
          'c.origem_abertura',
          'c.subsistema',
          'c.despacho_automatico',
          'c.total_adendos',
          'c.sla_nivel_escalonado',
          'c.iot_evento_ref',
          'c.foto_anexo',
          'c.audio_anexo',
          'c.t0_abertura',
          'c.t1_atribuicao',
          'c.t2_inicio_reparo',
          'c.t3_conclusao_reparo',
          'c.tempo_reparo_liquido_minutos',
          'c.tempo_downtime_total_minutos'
        );

      if (status) {
        if (status.includes(',')) {
          query.whereIn('c.status', status.split(','));
        } else {
          query.where('c.status', status);
        }
      }

      if (linha_id) query.where('l.id', linha_id);
      if (prioridade) query.where('c.prioridade', prioridade);
      if (mantenedor_id) query.where('c.mantenedor_atribuido_id', mantenedor_id);

      const chamados = await query.orderBy('c.t0_abertura', 'desc');

      // Calcula tempo decorrido, Matriz de Priorização Dinâmica e Indicadores de SLA
      const agora = new Date();
      const formatados = chamados.map((item) => {
        let minutos_em_aberto = 0;
        if (item.status !== 'concluido' && item.status !== 'cancelado_invalido') {
          minutos_em_aberto = diferencaMinutos(item.t0_abertura, agora);
        } else {
          minutos_em_aberto = item.tempo_downtime_total_minutos || diferencaMinutos(item.t0_abertura, item.t3_conclusao_reparo);
        }

        // 1. Matriz de Priorização Industrial (Score ponderado)
        // Peso Criticidade do Ativo: A = 300, B = 200, C = 100
        const pesoCriticidade = item.ativo_criticidade === 'A' ? 300 : item.ativo_criticidade === 'B' ? 200 : 100;

        // Peso Impacto Operacional Imediato
        const pesoImpacto = item.status_impacto === 'maquina_parada'
          ? 300
          : (item.status_impacto === 'operando_com_restricao' || item.status_impacto === 'degradacao_funcao')
            ? 150
            : 50;

        // Fator de aceleração por tempo decorrido
        const fatorTempo = item.status_impacto === 'maquina_parada' ? 2.5 : 1.0;
        const gut = despachoService.calcularScoreGUT(item);
        const adendosBonus = (item.total_adendos || 0) * 15;
        const score_prioridade = Math.round(pesoCriticidade + pesoImpacto + adendosBonus + (minutos_em_aberto * fatorTempo));

        // 2. SLA de Triagem e Despacho T0 -> T1 (em minutos)
        // Crítico (A): 15 min | Alerta (B): 30 min | Baixo (C): 60 min
        const sla_limite_t1 = item.ativo_criticidade === 'A' ? 15 : item.ativo_criticidade === 'B' ? 30 : 60;
        const sla_estourado = (item.status === 'aberto' && minutos_em_aberto > sla_limite_t1);
        const sla_restante_minutos = Math.max(0, sla_limite_t1 - minutos_em_aberto);

        return {
          ...item,
          gut,
          minutos_em_aberto,
          score_prioridade,
          sla_limite_t1,
          sla_estourado,
          sla_restante_minutos
        };
      });

      const abertosRecomendados = await despachoService.recomendarTriagemParaChamados(
        formatados.filter((f) => f.status === 'aberto')
      );
      const recMap = new Map(abertosRecomendados.map((r) => [r.id, r.tecnico_recomendado]));
      for (const item of formatados) {
        if (recMap.has(item.id)) {
          item.tecnico_recomendado = recMap.get(item.id);
        }
      }

      // Ordenação: se ordenar='prioridade' (ou padrão nos ativos), prioriza score dos ativos não concluídos
      if (ordenar === 'prioridade' || !ordenar) {
        formatados.sort((a, b) => {
          const aAtivo = a.status !== 'concluido' && a.status !== 'cancelado_invalido';
          const bAtivo = b.status !== 'concluido' && b.status !== 'cancelado_invalido';
          if (aAtivo && !bAtivo) return -1;
          if (!aAtivo && bAtivo) return 1;
          if (aAtivo && bAtivo) {
            return b.score_prioridade - a.score_prioridade;
          }
          return new Date(b.t0_abertura).getTime() - new Date(a.t0_abertura).getTime();
        });
      }

      return res.status(200).json(formatados);
    } catch (error) {
      console.error('[Chamados] Erro ao listar chamados:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar ordens de serviço.' });
    }
  },

  /**
   * GET /api/chamados/:id
   * Retorna os detalhes completos da OS, incluindo pausas, apontamentos e peças
   */
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const chamado = await chamadoController._buscarDetalhado(id);

      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      // Busca pausas da OS
      const pausas = await db('os_pausas as p')
        .join('usuarios as u', 'p.registrado_por_id', 'u.id')
        .select(
          'p.id',
          'p.motivo',
          'p.justificativa',
          'p.t_inicio_pausa',
          'p.t_fim_pausa',
          'p.duracao_minutos',
          'u.nome as registrado_por_nome'
        )
        .where('p.chamado_id', id)
        .orderBy('p.id', 'asc');

      // Busca peças requisitadas
      const pecas = await db('pecas_utilizadas_os as pu')
        .join('pecas as p', 'pu.peca_id', 'p.id')
        .leftJoin('usuarios as u_sol', 'pu.solicitado_por_id', 'u_sol.id')
        .select(
          'pu.id',
          'p.id as peca_id',
          'p.codigo_sap',
          'p.descricao',
          'pu.quantidade',
          'pu.status_movimentacao',
          'p.localizacao_almoxarifado',
          'u_sol.nome as solicitado_por_nome'
        )
        .where('pu.chamado_id', id);

      // Busca apontamento técnico de encerramento se existir
      const apontamento = await db('apontamentos_os as ap')
        .join('usuarios as u', 'ap.mantenedor_id', 'u.id')
        .leftJoin('iso_modos_falha as mf', 'ap.modo_falha_id', 'mf.id')
        .leftJoin('iso_causas_raiz as cr', 'ap.causa_raiz_id', 'cr.id')
        .leftJoin('iso_acoes_corretivas as ac', 'ap.acao_corretiva_id', 'ac.id')
        .select(
          'ap.id',
          'ap.causa_raiz',
          'ap.acao_executada',
          'ap.arvore_falha_sistema',
          'ap.modo_falha_id',
          'ap.causa_raiz_id',
          'ap.acao_corretiva_id',
          'mf.codigo_iso as modo_falha_codigo',
          'mf.nome as modo_falha_nome',
          'cr.codigo_iso as causa_raiz_codigo',
          'cr.nome as causa_raiz_nome',
          'ac.codigo_iso as acao_corretiva_codigo',
          'ac.nome as acao_corretiva_nome',
          'ap.necessita_revisao_preventiva',
          'ap.observacoes_tecnicas',
          'ap.created_at',
          'u.nome as mantenedor_nome'
        )
        .where('ap.chamado_id', id)
        .first();

      const adendos = await db('chamado_adendos')
        .where({ chamado_pai_id: id })
        .orderBy('created_at', 'desc');

      const escalonamentos = await db('escalonamento_sla_logs as es')
        .leftJoin('usuarios as dest', 'es.destinatario_id', 'dest.id')
        .select('es.*', 'dest.nome as destinatario_nome')
        .where('es.chamado_id', id)
        .orderBy('es.escalonado_em', 'desc');

      return res.status(200).json({
        ...chamado,
        pausas,
        pecas,
        adendos,
        escalonamentos,
        apontamento: apontamento || null
      });
    } catch (error) {
      console.error('[Chamados] Erro ao buscar chamado por ID:', error);
      return res.status(500).json({ erro: 'Erro ao consultar detalhes da ordem de serviço.' });
    }
  },

  /**
   * PATCH /api/chamados/:id/atribuir
   * Captura T1 (Atribuição do mantenedor pelo PCM ou auto-atribuição)
   */
  async atribuir(req, res) {
    try {
      const { id } = req.params;
      const { mantenedor_id } = req.body;
      const mantenedorFinalId = mantenedor_id || req.user.id;

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      const t1 = new Date();
      const tempo_resposta = diferencaMinutos(chamado.t0_abertura, t1);

      await db('chamados_os')
        .where({ id })
        .update({
          mantenedor_atribuido_id: mantenedorFinalId,
          status: 'atribuido',
          t1_atribuicao: t1,
          tempo_resposta_minutos: tempo_resposta,
          updated_at: t1
        });

      const chamadoAtualizado = await chamadoController._buscarDetalhado(id);

      const io = req.app.get('io');
      if (io) {
        io.emit('status_alterado', {
          chamado: chamadoAtualizado,
          evento: 'atribuido',
          mensagem: `OS ${chamado.numero_os} atribuída ao técnico.`
        });
      }

      return res.status(200).json({
        mensagem: 'Mantenedor atribuído com sucesso (T1 registrado).',
        chamado: chamadoAtualizado
      });
    } catch (error) {
      console.error('[Chamados] Erro ao atribuir mantenedor:', error);
      return res.status(500).json({ erro: 'Erro interno ao atribuir mantenedor.' });
    }
  },

  /**
   * PATCH /api/chamados/:id/iniciar-reparo
   * Captura T2 (Técnico chega ao posto fabril e inicia a intervenção física)
   */
  async iniciarReparo(req, res) {
    try {
      const { id } = req.params;

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      const t2 = new Date();
      const tempo_deslocamento = diferencaMinutos(chamado.t1_atribuicao || chamado.t0_abertura, t2);

      await db.transaction(async (trx) => {
        await trx('chamados_os')
          .where({ id })
          .update({
            status: 'em_reparo',
            t2_inicio_reparo: t2,
            tempo_deslocamento_minutos: tempo_deslocamento,
            updated_at: t2
          });

        await trx('ativos_postos')
          .where({ id: chamado.ativo_id })
          .update({
            status_operacional: 'em_manutencao',
            updated_at: t2
          });
      });

      const chamadoAtualizado = await chamadoController._buscarDetalhado(id);

      const io = req.app.get('io');
      if (io) {
        io.emit('status_alterado', {
          chamado: chamadoAtualizado,
          evento: 'em_reparo',
          mensagem: `Reparo da OS ${chamado.numero_os} iniciado no posto.`
        });
      }

      return res.status(200).json({
        mensagem: 'Reparo iniciado (T2 registrado - deslocamento concluído).',
        chamado: chamadoAtualizado
      });
    } catch (error) {
      console.error('[Chamados] Erro ao iniciar reparo:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar início do reparo.' });
    }
  },

  /**
   * POST /api/chamados/:id/pausar
   * Registra pausa operacional sem penalizar o tempo de reparo líquido do técnico
   */
  async pausar(req, res) {
    try {
      const { id } = req.params;
      const { motivo, justificativa } = req.body;
      const registrado_por_id = req.user.id;

      if (!motivo) {
        return res.status(400).json({ erro: 'Motivo da pausa é obrigatório.' });
      }

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      // Verifica se já não existe pausa ativa
      const pausaAberta = await db('os_pausas')
        .where({ chamado_id: id, t_fim_pausa: null })
        .first();

      if (pausaAberta) {
        return res.status(400).json({ erro: 'Já existe uma pausa ativa para esta OS.' });
      }

      const t_inicio = new Date();

      await db.transaction(async (trx) => {
        await trx('os_pausas').insert({
          chamado_id: id,
          motivo,
          justificativa: justificativa || null,
          t_inicio_pausa: t_inicio,
          registrado_por_id
        });

        await trx('chamados_os')
          .where({ id })
          .update({
            status: 'pausado_peca',
            updated_at: t_inicio
          });
      });

      const chamadoAtualizado = await chamadoController._buscarDetalhado(id);

      const io = req.app.get('io');
      if (io) {
        io.emit('status_alterado', {
          chamado: chamadoAtualizado,
          evento: 'pausado',
          mensagem: `OS ${chamado.numero_os} pausada: ${motivo}.`
        });
      }

      return res.status(200).json({
        mensagem: 'Pausa operacional registrada.',
        chamado: chamadoAtualizado
      });
    } catch (error) {
      console.error('[Chamados] Erro ao pausar OS:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar pausa.' });
    }
  },

  /**
   * PATCH /api/chamados/:id/retomar
   * Encerra a pausa e retorna o cronômetro para o status 'em_reparo'
   */
  async retomar(req, res) {
    try {
      const { id } = req.params;

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      const pausaAberta = await db('os_pausas')
        .where({ chamado_id: id, t_fim_pausa: null })
        .first();

      if (!pausaAberta) {
        return res.status(400).json({ erro: 'Nenhuma pausa ativa encontrada para retomar.' });
      }

      const t_fim = new Date();
      const duracao = diferencaMinutos(pausaAberta.t_inicio_pausa, t_fim);

      await db.transaction(async (trx) => {
        await trx('os_pausas')
          .where({ id: pausaAberta.id })
          .update({
            t_fim_pausa: t_fim,
            duracao_minutos: duracao
          });

        await trx('chamados_os')
          .where({ id })
          .update({
            status: 'em_reparo',
            updated_at: t_fim
          });
      });

      const chamadoAtualizado = await chamadoController._buscarDetalhado(id);

      const io = req.app.get('io');
      if (io) {
        io.emit('status_alterado', {
          chamado: chamadoAtualizado,
          evento: 'retomado',
          mensagem: `Atendimento da OS ${chamado.numero_os} retomado.`
        });
      }

      return res.status(200).json({
        mensagem: 'Atendimento retomado com sucesso.',
        duracao_pausa_minutos: duracao,
        chamado: chamadoAtualizado
      });
    } catch (error) {
      console.error('[Chamados] Erro ao retomar atendimento:', error);
      return res.status(500).json({ erro: 'Erro interno ao retomar atendimento.' });
    }
  },

  /**
   * POST /api/chamados/:id/concluir
   * Captura T3 (Liberação da máquina e encerramento técnico)
   * Calcula o MTTR Líquido Puro e o Downtime Total
   */
  async concluir(req, res) {
    try {
      const { id } = req.params;
      const {
        modo_falha_id,
        causa_raiz_id,
        acao_corretiva_id,
        causa_raiz,
        acao_executada,
        arvore_falha_sistema,
        necessita_revisao_preventiva,
        observacoes_tecnicas,
        pecas_consumidas
      } = req.body;
      const mantenedor_id = req.user.id;

      const t3 = new Date();
      let resumoConclusao;

      await db.transaction(async (trx) => {
        const chamado = await trx('chamados_os').where({ id }).forUpdate().first();
        if (!chamado) {
          const err = new Error('Ordem de serviço não encontrada.');
          err.statusCode = 404;
          throw err;
        }

        if (chamado.status === 'concluido') {
          const err = new Error('Esta OS já se encontra concluída.');
          err.statusCode = 400;
          throw err;
        }

        resumoConclusao = await chamadoCoreService.concluirOSTrx(trx, {
          chamado,
          mantenedorId: mantenedor_id,
          dataConclusao: t3,
          modo_falha_id,
          causa_raiz_id,
          acao_corretiva_id,
          causa_raiz,
          acao_executada,
          arvore_falha_sistema,
          necessita_revisao_preventiva,
          observacoes_tecnicas,
          pecas_consumidas: pecas_consumidas || []
        });
      });

      const chamadoFinal = await chamadoController._buscarDetalhado(id);

      // Emite evento WebSocket informando liberação da máquina
      const io = req.app.get('io');
      if (io) {
        io.emit('status_alterado', {
          chamado: chamadoFinal,
          evento: 'concluido',
          mensagem: `Máquina ${chamadoFinal.tag_patrimonio} liberada! Reparo concluído.`
        });
        io.emit('os_concluida', { chamado: chamadoFinal });
        if (resumoConclusao.baixasEstoque?.some((b) => b.abaixo_minimo)) {
          io.emit('alerta_estoque_critico', { chamado_id: id, baixas: resumoConclusao.baixasEstoque });
        }
      }

      return res.status(200).json({
        mensagem: 'Ordem de serviço concluída e máquina liberada (T3 registrado).',
        metricas: {
          tempo_resposta_minutos: chamadoFinal.tempo_resposta_minutos,
          tempo_deslocamento_minutos: chamadoFinal.tempo_deslocamento_minutos,
          tempo_reparo_liquido_minutos: resumoConclusao.tempoReparoLiquido,
          soma_pausas_minutos: resumoConclusao.totalPausadoMin,
          tempo_downtime_total_minutos: resumoConclusao.tempoDowntimeTotal
        },
        baixas_estoque: resumoConclusao.baixasEstoque,
        chamado: chamadoFinal
      });
    } catch (error) {
      console.error('[Chamados] Erro ao concluir OS:', error);
      return res.status(error.statusCode || 500).json({ erro: error.message || 'Erro interno ao concluir ordem de serviço.' });
    }
  },

  /**
   * PATCH /api/chamados/:id/sinalizar-invalido
   * Team Leader sinaliza alarme falso ou chamado incorreto sem bloquear o fluxo
   */
  async sinalizarInvalido(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const team_leader_id = req.user.id;

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      await db('chamados_os')
        .where({ id })
        .update({
          chamado_invalido: true,
          motivo_invalido: motivo || 'Sinalizado pelo Team Leader como não procedente',
          team_leader_id,
          updated_at: new Date()
        });

      return res.status(200).json({
        mensagem: 'Chamado sinalizado como inválido pelo Team Leader.'
      });
    } catch (error) {
      console.error('[Chamados] Erro ao sinalizar chamado inválido:', error);
      return res.status(500).json({ erro: 'Erro ao sinalizar chamado.' });
    }
  },

  /**
   * Helper interno para buscar dados consolidados da OS
   */
  async _buscarDetalhado(id) {
    return db('chamados_os as c')
      .join('ativos_postos as a', 'c.ativo_id', 'a.id')
      .join('linhas as l', 'a.linha_id', 'l.id')
      .leftJoin('sintomas_falha as s', 'c.sintoma_id', 's.id')
      .leftJoin('usuarios as m', 'c.mantenedor_atribuido_id', 'm.id')
      .leftJoin('usuarios as tl', 'c.team_leader_id', 'tl.id')
      .select(
        'c.id',
        'c.numero_os',
        'c.status',
        'c.prioridade',
        'c.tipo_manutencao',
        'c.operador_matricula',
        'c.operador_nome',
        's.descricao as sintoma_descricao',
        'c.descricao_sintoma',
        'a.id as ativo_id',
        'a.tag_patrimonio',
        'a.nome as ativo_nome',
        'a.posto_trabalho',
        'a.criticidade as ativo_criticidade',
        'l.id as linha_id',
        'l.nome as linha_nome',
        'l.setor as linha_setor',
        'm.id as mantenedor_id',
        'm.nome as mantenedor_nome',
        'tl.nome as team_leader_nome',
        'c.status_impacto',
        'c.origem_abertura',
        'c.subsistema',
        'c.despacho_automatico',
        'c.total_adendos',
        'c.sla_nivel_escalonado',
        'c.iot_evento_ref',
        'c.foto_anexo',
        'c.audio_anexo',
        'c.chamado_invalido',
        'c.motivo_invalido',
        'c.t0_abertura',
        'c.t1_atribuicao',
        'c.t2_inicio_reparo',
        'c.t3_conclusao_reparo',
        'c.tempo_resposta_minutos',
        'c.tempo_deslocamento_minutos',
        'c.tempo_reparo_liquido_minutos',
        'c.tempo_downtime_total_minutos',
        'c.created_at'
      )
      .where('c.id', id)
      .first();
  }
};

module.exports = chamadoController;
