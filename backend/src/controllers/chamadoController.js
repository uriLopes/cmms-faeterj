const db = require('../database/db');

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
        descricao_sintoma,
        tipo_manutencao,
        prioridade,
        status_impacto,
        foto_anexo,
        audio_anexo
      } = req.body;

      if (!operador_matricula) {
        return res.status(400).json({ erro: 'Matrícula do operador é obrigatória.' });
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

      // Impacto operacional imediato (3 Estados do Vanguard Trigger)
      // A. Máquina Parada (Crítico / Emergência)
      // B. Operando com Restrição / Anomalia (Alerta)
      // C. Melhoria / Falha Estética (Baixa prioridade)
      let prioridadeFinal = prioridade;
      let tipoManutencaoFinal = tipo_manutencao || 'corretiva_emergencial';
      let statusOperacionalAtivo = 'parado_quebra';

      if (status_impacto === 'operando_com_restricao') {
        prioridadeFinal = 'alta';
        tipoManutencaoFinal = 'corretiva_programada';
        statusOperacionalAtivo = 'alerta_preditivo';
      } else if (status_impacto === 'melhoria_estetica') {
        prioridadeFinal = 'baixa';
        tipoManutencaoFinal = 'preventiva';
        statusOperacionalAtivo = 'em_operacao';
      } else {
        prioridadeFinal = 'critica';
        tipoManutencaoFinal = 'corretiva_emergencial';
        statusOperacionalAtivo = 'parado_quebra';
      }

      const numero_os = await gerarNumeroOS();
      const t0 = new Date();

      // Transação: cria OS e atualiza status da máquina
      let novoChamadoId;
      await db.transaction(async (trx) => {
        const [id] = await trx('chamados_os').insert({
          numero_os,
          ativo_id: ativo.id,
          tipo_manutencao: tipoManutencaoFinal,
          prioridade: prioridadeFinal,
          status: 'aberto',
          status_impacto: status_impacto || 'maquina_parada',
          operador_matricula: operador_matricula.trim(),
          operador_nome: operador_nome || `Operador RE-${operador_matricula.trim()}`,
          sintoma_id: sintoma_id || null,
          descricao_sintoma: descricao_sintoma || null,
          foto_anexo: foto_anexo || null,
          audio_anexo: audio_anexo || null,
          t0_abertura: t0,
          created_at: t0,
          updated_at: t0
        });

        novoChamadoId = id;

        // Atualiza status do ativo
        await trx('ativos_postos')
          .where({ id: ativo.id })
          .update({
            status_operacional: statusOperacionalAtivo,
            updated_at: t0
          });
      });

      // Busca OS completa para retorno e emissão no WebSocket
      const chamadoCompleto = await chamadoController._buscarDetalhado(novoChamadoId);

      // Emite evento em tempo real via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.emit('novo_chamado', {
          chamado: chamadoCompleto,
          mensagem: `Nova OS ${numero_os} aberta na linha ${chamadoCompleto.linha_nome}!`,
          timestamp: t0
        });
      }

      return res.status(201).json({
        mensagem: 'Ordem de serviço aberta com sucesso.',
        chamado: chamadoCompleto
      });
    } catch (error) {
      console.error('[Chamados] Erro ao abrir chamado:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar ordem de serviço.' });
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
          : item.status_impacto === 'operando_com_restricao'
            ? 150
            : 50;

        // Fator de aceleração por tempo decorrido
        const fatorTempo = item.status_impacto === 'maquina_parada' ? 2.5 : 1.0;
        const score_prioridade = Math.round(pesoCriticidade + pesoImpacto + (minutos_em_aberto * fatorTempo));

        // 2. SLA de Triagem e Despacho T0 -> T1 (em minutos)
        // Crítico (A): 15 min | Alerta (B): 30 min | Baixo (C): 60 min
        const sla_limite_t1 = item.ativo_criticidade === 'A' ? 15 : item.ativo_criticidade === 'B' ? 30 : 60;
        const sla_estourado = (item.status === 'aberto' && minutos_em_aberto > sla_limite_t1);
        const sla_restante_minutos = Math.max(0, sla_limite_t1 - minutos_em_aberto);

        return {
          ...item,
          minutos_em_aberto,
          score_prioridade,
          sla_limite_t1,
          sla_estourado,
          sla_restante_minutos
        };
      });

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
        .select(
          'ap.id',
          'ap.causa_raiz',
          'ap.acao_executada',
          'ap.arvore_falha_sistema',
          'ap.necessita_revisao_preventiva',
          'ap.observacoes_tecnicas',
          'ap.created_at',
          'u.nome as mantenedor_nome'
        )
        .where('ap.chamado_id', id)
        .first();

      return res.status(200).json({
        ...chamado,
        pausas,
        pecas,
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
        causa_raiz,
        acao_executada,
        arvore_falha_sistema,
        necessita_revisao_preventiva,
        observacoes_tecnicas
      } = req.body;
      const mantenedor_id = req.user.id;

      if (!causa_raiz || !acao_executada || !arvore_falha_sistema) {
        return res.status(400).json({
          erro: 'Causa raiz, ação executada e sistema na árvore de falhas são obrigatórios.'
        });
      }

      const chamado = await db('chamados_os').where({ id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      if (chamado.status === 'concluido') {
        return res.status(400).json({ erro: 'Esta OS já se encontra concluída.' });
      }

      const t3 = new Date();

      // Encerra qualquer pausa que tenha ficado aberta
      await db('os_pausas')
        .where({ chamado_id: id, t_fim_pausa: null })
        .update({
          t_fim_pausa: t3,
          duracao_minutos: db.raw('TIMESTAMPDIFF(MINUTE, t_inicio_pausa, NOW())')
        });

      // Soma de todas as pausas da OS em minutos
      const totalPausas = await db('os_pausas')
        .where({ chamado_id: id })
        .sum('duracao_minutos as total');

      const somaPausasMinutos = Number(totalPausas[0].total) || 0;

      // Cálculo de métricas
      const t0 = chamado.t0_abertura;
      const t2 = chamado.t2_inicio_reparo || chamado.t1_atribuicao || t0;

      // MTTR Puro: tempo de reparo líquido descontando pausas de peça/turno
      const tempoBrutoReparo = diferencaMinutos(t2, t3);
      const tempo_reparo_liquido = Math.max(1, tempoBrutoReparo - somaPausasMinutos);

      // Downtime Total: máquina parada desde a abertura até a liberação
      const tempo_downtime_total = diferencaMinutos(t0, t3);

      await db.transaction(async (trx) => {
        // 1. Registra o apontamento técnico de encerramento
        await trx('apontamentos_os').insert({
          chamado_id: id,
          mantenedor_id,
          causa_raiz,
          acao_executada,
          arvore_falha_sistema,
          necessita_revisao_preventiva: Boolean(necessita_revisao_preventiva),
          observacoes_tecnicas: observacoes_tecnicas || null,
          created_at: t3
        });

        // 2. Conclui a OS gravando os marcos consolidados
        await trx('chamados_os')
          .where({ id })
          .update({
            status: 'concluido',
            t3_conclusao_reparo: t3,
            tempo_reparo_liquido_minutos: tempo_reparo_liquido,
            tempo_downtime_total_minutos: tempo_downtime_total,
            updated_at: t3
          });

        // 3. Libera o ativo de volta para operação normal
        await trx('ativos_postos')
          .where({ id: chamado.ativo_id })
          .update({
            status_operacional: 'em_operacao',
            updated_at: t3
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
      }

      return res.status(200).json({
        mensagem: 'Ordem de serviço concluída e máquina liberada (T3 registrado).',
        metricas: {
          tempo_resposta_minutos: chamado.tempo_resposta_minutos,
          tempo_deslocamento_minutos: chamado.tempo_deslocamento_minutos,
          tempo_reparo_liquido_minutos: tempo_reparo_liquido, // MTTR Puro
          soma_pausas_minutos: somaPausasMinutos,
          tempo_downtime_total_minutos: tempo_downtime_total
        },
        chamado: chamadoFinal
      });
    } catch (error) {
      console.error('[Chamados] Erro ao concluir OS:', error);
      return res.status(500).json({ erro: 'Erro interno ao concluir ordem de serviço.' });
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
