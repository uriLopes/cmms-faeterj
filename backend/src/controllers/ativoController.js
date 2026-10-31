const db = require('../database/db');

const ativoController = {
  /**
   * GET /api/linhas
   * Lista todas as linhas de produção fabris
   */
  async listarLinhas(req, res) {
    try {
      const linhas = await db('linhas')
        .where({ ativo: true })
        .orderBy('nome', 'asc');

      return res.status(200).json(linhas);
    } catch (error) {
      console.error('[Ativo] Erro ao listar linhas:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar linhas de produção.' });
    }
  },

  /**
   * GET /api/ativos
   * Lista ativos e postos com filtros por linha, criticidade ou status
   */
  async listarAtivos(req, res) {
    try {
      const { linha_id, criticidade, status_operacional } = req.query;

      const query = db('ativos_postos as a')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .select(
          'a.id',
          'a.linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'a.tag_patrimonio',
          'a.nome',
          'a.posto_trabalho',
          'a.criticidade',
          'a.qr_code_token',
          'a.status_operacional',
          'a.created_at'
        )
        .where('a.ativo', true);

      if (linha_id) query.where('a.linha_id', linha_id);
      if (criticidade) query.where('a.criticidade', criticidade);
      if (status_operacional) query.where('a.status_operacional', status_operacional);

      const ativos = await query.orderBy('l.nome', 'asc').orderBy('a.tag_patrimonio', 'asc');
      return res.status(200).json(ativos);
    } catch (error) {
      console.error('[Ativo] Erro ao listar ativos:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar ativos da fábrica.' });
    }
  },

  /**
   * GET /api/ativos/qr/:token
   * Ponto de entrada do Operador: escaneamento do QR Code físico colado no posto
   * Retorna os dados da máquina, a linha e os sintomas disponíveis para 2 toques
   */
  async buscarPorQrCode(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ erro: 'Token do QR Code não informado.' });
      }

      const ativo = await db('ativos_postos as a')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .select(
          'a.id',
          'a.linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'a.tag_patrimonio',
          'a.nome',
          'a.posto_trabalho',
          'a.criticidade',
          'a.qr_code_token',
          'a.status_operacional'
        )
        .where('a.ativo', true)
        .andWhere(function() {
          this.where('a.qr_code_token', token.trim())
            .orWhere('a.tag_patrimonio', token.trim().toUpperCase());
        })
        .first();

      if (!ativo) {
        return res.status(404).json({
          erro: 'Ativo/posto não encontrado para este QR Code. Verifique o adesivo físico.'
        });
      }

      // Verifica se há alguma OS aberta ou em atendimento neste momento (Trava de duplicidade)
      let osAtivaInfo = null;
      const osAtiva = await db('chamados_os as c')
        .leftJoin('sintomas_falha as s', 'c.sintoma_id', 's.id')
        .select(
          'c.id',
          'c.numero_os',
          'c.status',
          'c.prioridade',
          'c.operador_matricula',
          'c.operador_nome',
          'c.descricao_sintoma',
          'c.t0_abertura',
          's.descricao as sintoma_nome'
        )
        .where({ 'c.ativo_id': ativo.id })
        .whereIn('c.status', ['aberto', 'atribuido', 'em_deslocamento', 'em_reparo', 'pausado_peca'])
        .orderBy('c.id', 'desc')
        .first();

      if (osAtiva) {
        const agora = new Date();
        const t0 = new Date(osAtiva.t0_abertura);
        const minutos = Math.max(1, Math.round((agora.getTime() - t0.getTime()) / (1000 * 60)));
        osAtivaInfo = {
          ...osAtiva,
          minutos_aberto: minutos,
          descricao_exibicao: osAtiva.descricao_sintoma || osAtiva.sintoma_nome || 'Falha reportada na linha'
        };
      }

      // Catálogo de sintomas para abertura imediata
      const sintomas = await db('sintomas_falha')
        .where({ ativo: true })
        .orderBy('id', 'asc');

      return res.status(200).json({
        ativo,
        em_atendimento: Boolean(osAtivaInfo),
        os_ativa: osAtivaInfo,
        sintomas
      });
    } catch (error) {
      console.error('[Ativo] Erro ao buscar por QR Code:', error);
      return res.status(500).json({ erro: 'Erro ao identificar ativo via QR Code.' });
    }
  },

  /**
   * GET /api/sintomas
   * Catálogo de sintomas pré-cadastrados
   */
  async listarSintomas(req, res) {
    try {
      const sintomas = await db('sintomas_falha')
        .where({ ativo: true })
        .orderBy('id', 'asc');

      return res.status(200).json(sintomas);
    } catch (error) {
      console.error('[Ativo] Erro ao listar sintomas:', error);
      return res.status(500).json({ erro: 'Erro ao consultar catálogo de sintomas.' });
    }
  },

  /**
   * POST /api/ativos
   * Cadastro de novo ativo/máquina na Vanguard Central
   */
  async criarAtivo(req, res) {
    try {
      const {
        linha_id,
        tag_patrimonio,
        nome,
        posto_trabalho,
        criticidade = 'B',
        qr_code_token
      } = req.body;

      if (!linha_id || !tag_patrimonio || !nome || !posto_trabalho) {
        return res.status(400).json({
          erro: 'Linha, TAG de patrimônio, nome do ativo e posto de trabalho são obrigatórios.'
        });
      }

      const tagUpper = tag_patrimonio.trim().toUpperCase();

      // Verifica se a TAG já existe
      const existente = await db('ativos_postos')
        .where({ tag_patrimonio: tagUpper })
        .first();

      if (existente) {
        return res.status(400).json({
          erro: `A TAG de patrimônio "${tagUpper}" já está cadastrada no ativo "${existente.nome}".`
        });
      }

      // Gera QR code token padronizado se não informado
      const tokenFinal = qr_code_token?.trim() || 
        `qr_${tagUpper.toLowerCase().replace(/[^a-z0-9]/g, '_')}_token_hash_faeterj_${Date.now()}`;

      const [novoId] = await db('ativos_postos').insert({
        linha_id,
        tag_patrimonio: tagUpper,
        nome: nome.trim(),
        posto_trabalho: posto_trabalho.trim(),
        criticidade: ['A', 'B', 'C'].includes(criticidade) ? criticidade : 'B',
        qr_code_token: tokenFinal,
        status_operacional: 'em_operacao',
        ativo: true
      });

      const novoAtivo = await db('ativos_postos as a')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .select(
          'a.id',
          'a.linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'a.tag_patrimonio',
          'a.nome',
          'a.posto_trabalho',
          'a.criticidade',
          'a.qr_code_token',
          'a.status_operacional',
          'a.created_at'
        )
        .where('a.id', novoId)
        .first();

      return res.status(201).json({
        mensagem: 'Ativo cadastrado com sucesso!',
        ativo: novoAtivo
      });
    } catch (error) {
      console.error('[Ativo] Erro ao cadastrar ativo:', error);
      return res.status(500).json({ erro: 'Erro interno ao cadastrar ativo.' });
    }
  },

  /**
   * GET /api/ativos/:id/prontuario
   * Prontuário de Manutenção Completo do Ativo (Histórico de Vida, MTTR, MTBF e OSs passadas)
   */
  async buscarProntuario(req, res) {
    try {
      const { id } = req.params;

      const ativo = await db('ativos_postos as a')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .select(
          'a.id',
          'a.linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'a.tag_patrimonio',
          'a.nome',
          'a.posto_trabalho',
          'a.criticidade',
          'a.qr_code_token',
          'a.status_operacional',
          'a.created_at'
        )
        .where('a.id', id)
        .first();

      if (!ativo) {
        return res.status(404).json({ erro: 'Ativo não encontrado.' });
      }

      // Busca todos os chamados deste ativo
      const chamados = await db('chamados_os as c')
        .leftJoin('sintomas_falha as s', 'c.sintoma_id', 's.id')
        .leftJoin('usuarios as m', 'c.mantenedor_atribuido_id', 'm.id')
        .leftJoin('apontamentos_os as ap', 'c.id', 'ap.chamado_id')
        .select(
          'c.id',
          'c.numero_os',
          'c.status',
          'c.prioridade',
          'c.tipo_manutencao',
          'c.status_impacto',
          'c.operador_matricula',
          'c.operador_nome',
          's.descricao as sintoma_descricao',
          's.categoria as sintoma_categoria',
          'c.descricao_sintoma',
          'c.foto_anexo',
          'c.audio_anexo',
          'm.nome as mantenedor_nome',
          'ap.causa_raiz',
          'ap.acao_executada',
          'ap.arvore_falha_sistema',
          'ap.necessita_revisao_preventiva',
          'ap.observacoes_tecnicas',
          'c.t0_abertura',
          'c.t1_atribuicao',
          'c.t2_inicio_reparo',
          'c.t3_conclusao_reparo',
          'c.tempo_resposta_minutos',
          'c.tempo_reparo_liquido_minutos',
          'c.tempo_downtime_total_minutos'
        )
        .where('c.ativo_id', id)
        .orderBy('c.t0_abertura', 'desc');

      // Para cada chamado, carregar peças utilizadas se houver
      const chamadosComPecas = await Promise.all(
        chamados.map(async (ch) => {
          const pecas = await db('pecas_utilizadas_os as pu')
            .join('pecas as p', 'pu.peca_id', 'p.id')
            .select(
              'p.codigo_sap',
              'p.descricao',
              'pu.quantidade',
              'pu.status_movimentacao'
            )
            .where('pu.chamado_id', ch.id);

          return {
            ...ch,
            pecas
          };
        })
      );

      // Métricas específicas deste ativo
      const totalChamados = chamados.length;
      const concluidos = chamados.filter(c => c.status === 'concluido');
      const totalDowntimeMinutos = concluidos.reduce((acc, cur) => acc + (cur.tempo_downtime_total_minutos || 0), 0);
      const somaReparoLiquido = concluidos.reduce((acc, cur) => acc + (cur.tempo_reparo_liquido_minutos || 0), 0);
      const mttrMedioMinutos = concluidos.length > 0 ? Math.round(somaReparoLiquido / concluidos.length) : 0;

      // MTBF (Mean Time Between Failures): Horas operando entre quebras
      const horasOperacao = 720; // Período de 30 dias fabris
      const horasParadas = totalDowntimeMinutos / 60;
      const horasUptime = Math.max(0, horasOperacao - horasParadas);
      const mtbfHoras = totalChamados > 0 ? Number((horasUptime / totalChamados).toFixed(1)) : horasOperacao;
      const disponibilidadePercentual = Number(((horasUptime / horasOperacao) * 100).toFixed(1));

      // Reincidência de sintomas / subsistemas
      const contagemSistemas = {};
      chamados.forEach(c => {
        const sist = c.arvore_falha_sistema || c.sintoma_categoria || 'geral';
        contagemSistemas[sist] = (contagemSistemas[sist] || 0) + 1;
      });

      return res.status(200).json({
        ativo,
        metricas: {
          total_chamados: totalChamados,
          chamados_concluidos: concluidos.length,
          chamados_ativos: totalChamados - concluidos.length,
          total_downtime_minutos: totalDowntimeMinutos,
          total_downtime_horas: Number((totalDowntimeMinutos / 60).toFixed(1)),
          mttr_medio_minutos: mttrMedioMinutos,
          mtbf_horas: mtbfHoras,
          disponibilidade_percentual: disponibilidadePercentual,
          reincidencia_sistemas: contagemSistemas
        },
        historico: chamadosComPecas
      });
    } catch (error) {
      console.error('[Ativo] Erro ao buscar prontuário:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar prontuário do ativo.' });
    }
  },

  /**
   * POST /api/sintomas
   * Adiciona nova falha/sintoma na árvore de falhas da central
   */
  async criarSintoma(req, res) {
    try {
      const { descricao, categoria = 'geral' } = req.body;
      if (!descricao || !descricao.trim()) {
        return res.status(400).json({ erro: 'Descrição do sintoma é obrigatória.' });
      }

      const [novoId] = await db('sintomas_falha').insert({
        descricao: descricao.trim(),
        categoria: categoria.trim().toLowerCase(),
        ativo: true
      });

      const novoSintoma = await db('sintomas_falha').where({ id: novoId }).first();
      return res.status(201).json({
        mensagem: 'Sintoma adicionado à árvore de falhas com sucesso.',
        sintoma: novoSintoma
      });
    } catch (error) {
      console.error('[Ativo] Erro ao cadastrar sintoma:', error);
      return res.status(500).json({ erro: 'Erro ao cadastrar novo sintoma na árvore de falhas.' });
    }
  }
};

module.exports = ativoController;
