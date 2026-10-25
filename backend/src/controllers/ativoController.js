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
  }
};

module.exports = ativoController;
