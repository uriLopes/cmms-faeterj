const db = require('../database/db');

const taxonomiaController = {
  /**
   * GET /api/v2/taxonomia
   * Retorna taxonomia estruturada ISO 14224 em 3 niveis (Modos -> Causas -> Acoes).
   */
  async listarCompleta(req, res) {
    try {
      const { subsistema } = req.query;

      const modosQuery = db('iso_modos_falha')
        .where({ ativo: true })
        .orderBy('subsistema', 'asc')
        .orderBy('codigo_iso', 'asc');

      if (subsistema) {
        modosQuery.where({ subsistema: subsistema.toLowerCase() });
      }

      const [modos, causas, acoes] = await Promise.all([
        modosQuery,
        db('iso_causas_raiz').where({ ativo: true }).orderBy('codigo_iso', 'asc'),
        db('iso_acoes_corretivas').where({ ativo: true }).orderBy('codigo_iso', 'asc')
      ]);

      const modosComCausas = modos.map((m) => ({
        ...m,
        causas_raiz: causas.filter((c) => c.modo_falha_id === m.id)
      }));

      return res.status(200).json({
        subsistemas_padrao: [
          { id: 'mecanico', label: 'Mecânico' },
          { id: 'eletrico', label: 'Elétrico' },
          { id: 'pneumatico', label: 'Pneumático' },
          { id: 'hidraulico', label: 'Hidráulico' },
          { id: 'operacional', label: 'Operacional' }
        ],
        modos_falha: modosComCausas,
        acoes_corretivas: acoes
      });
    } catch (error) {
      console.error('[Taxonomia] Erro ao carregar ISO 14224:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar taxonomia ISO 14224.' });
    }
  }
};

module.exports = taxonomiaController;
