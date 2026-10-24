const db = require('../database/db');

const pecaController = {
  /**
   * GET /api/pecas
   * Catálogo de peças com indicadores de estoque crítico
   */
  async listarPecas(req, res) {
    try {
      const { categoria, busca, apenas_critico } = req.query;

      const query = db('pecas').where({ ativo: true });

      if (categoria) {
        query.where({ categoria });
      }

      if (busca) {
        query.andWhere((builder) => {
          builder.where('codigo_sap', 'like', `%${busca}%`)
            .orWhere('descricao', 'like', `%${busca}%`);
        });
      }

      if (apenas_critico === 'true') {
        query.whereRaw('quantidade_estoque <= quantidade_minima');
      }

      const pecas = await query.orderBy('descricao', 'asc');

      // Adiciona flag de alerta de estoque para o frontend
      const formatadas = pecas.map((p) => ({
        ...p,
        estoque_critico: p.quantidade_estoque <= p.quantidade_minima
      }));

      return res.status(200).json(formatadas);
    } catch (error) {
      console.error('[Pecas] Erro ao listar peças:', error);
      return res.status(500).json({ erro: 'Erro interno ao consultar estoque de peças.' });
    }
  },

  /**
   * POST /api/chamados/:id/pecas
   * Técnico solicita peça para a OS (Modo Reserva Pendente: NÃO trava a execução técnica)
   */
  async solicitarPecaOS(req, res) {
    try {
      const chamado_id = Number(req.params.id);
      const { peca_id, quantidade } = req.body;
      const solicitado_por_id = req.user.id;

      if (!peca_id || !quantidade || quantidade <= 0) {
        return res.status(400).json({
          erro: 'ID da peça e quantidade válida são obrigatórios.'
        });
      }

      const chamado = await db('chamados_os').where({ id: chamado_id }).first();
      if (!chamado) {
        return res.status(404).json({ erro: 'Ordem de serviço não encontrada.' });
      }

      const peca = await db('pecas').where({ id: peca_id, ativo: true }).first();
      if (!peca) {
        return res.status(404).json({ erro: 'Peça não encontrada no almoxarifado.' });
      }

      const [solicitacaoId] = await db('pecas_utilizadas_os').insert({
        chamado_id,
        peca_id,
        quantidade: Number(quantidade),
        status_movimentacao: 'reserva_pendente',
        solicitado_por_id,
        created_at: new Date()
      });

      const solicitacao = await db('pecas_utilizadas_os as pu')
        .join('pecas as p', 'pu.peca_id', 'p.id')
        .select(
          'pu.id',
          'pu.chamado_id',
          'p.codigo_sap',
          'p.descricao',
          'pu.quantidade',
          'pu.status_movimentacao',
          'p.localizacao_almoxarifado',
          'pu.created_at'
        )
        .where('pu.id', solicitacaoId)
        .first();

      // Notifica o almoxarifado via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('reserva_peca_solicitada', {
          solicitacao,
          chamado_id,
          numero_os: chamado.numero_os
        });
      }

      return res.status(201).json({
        mensagem: 'Peça adicionada à OS em modo reserva pendente.',
        solicitacao
      });
    } catch (error) {
      console.error('[Pecas] Erro ao solicitar peça para OS:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar solicitação de peça.' });
    }
  },

  /**
   * PATCH /api/pecas-os/:id/baixar
   * Almoxarife confirma entrega e baixa física do item no estoque
   */
  async baixarPecaAlmoxarifado(req, res) {
    try {
      const { id } = req.params; // ID do pecas_utilizadas_os
      const atendido_por_id = req.user.id;

      const solicitacao = await db('pecas_utilizadas_os').where({ id }).first();
      if (!solicitacao) {
        return res.status(404).json({ erro: 'Registro de solicitação não encontrado.' });
      }

      if (solicitacao.status_movimentacao === 'baixado_almoxarifado') {
        return res.status(400).json({ erro: 'Esta peça já foi baixada anteriormente.' });
      }

      const peca = await db('pecas').where({ id: solicitacao.peca_id }).first();
      if (!peca) {
        return res.status(404).json({ erro: 'Peça não encontrada.' });
      }

      if (peca.quantidade_estoque < solicitacao.quantidade) {
        return res.status(400).json({
          erro: `Estoque insuficiente. Disponível: ${peca.quantidade_estoque}, Requisitado: ${solicitacao.quantidade}.`
        });
      }

      // Transação: baixa estoque e atualiza status
      await db.transaction(async (trx) => {
        await trx('pecas')
          .where({ id: peca.id })
          .decrement('quantidade_estoque', solicitacao.quantidade);

        await trx('pecas_utilizadas_os')
          .where({ id })
          .update({
            status_movimentacao: 'baixado_almoxarifado',
            atendido_por_id,
            data_baixa: new Date()
          });
      });

      const pecaAtualizada = await db('pecas').where({ id: peca.id }).first();

      // Se atingiu saldo mínimo, emite alerta sonoro/visual
      const io = req.app.get('io');
      if (io && pecaAtualizada.quantidade_estoque <= pecaAtualizada.quantidade_minima) {
        io.emit('alerta_estoque_critico', {
          peca: pecaAtualizada
        });
      }

      return res.status(200).json({
        mensagem: 'Baixa de peça realizada com sucesso no almoxarifado.',
        novo_saldo: pecaAtualizada.quantidade_estoque
      });
    } catch (error) {
      console.error('[Pecas] Erro ao baixar peça:', error);
      return res.status(500).json({ erro: 'Erro interno ao realizar baixa da peça.' });
    }
  },

  /**
   * GET /api/chamados/:id/pecas
   * Lista todas as peças associadas a uma OS
   */
  async listarPecasPorOS(req, res) {
    try {
      const chamado_id = Number(req.params.id);

      const pecas = await db('pecas_utilizadas_os as pu')
        .join('pecas as p', 'pu.peca_id', 'p.id')
        .leftJoin('usuarios as u_sol', 'pu.solicitado_por_id', 'u_sol.id')
        .leftJoin('usuarios as u_ate', 'pu.atendido_por_id', 'u_ate.id')
        .select(
          'pu.id',
          'p.id as peca_id',
          'p.codigo_sap',
          'p.descricao',
          'p.categoria',
          'p.localizacao_almoxarifado',
          'pu.quantidade',
          'p.unidade_medida',
          'p.custo_unitario',
          'pu.status_movimentacao',
          'u_sol.nome as solicitado_por_nome',
          'u_ate.nome as atendido_por_nome',
          'pu.created_at',
          'pu.data_baixa'
        )
        .where('pu.chamado_id', chamado_id)
        .orderBy('pu.id', 'asc');

      return res.status(200).json(pecas);
    } catch (error) {
      console.error('[Pecas] Erro ao listar peças da OS:', error);
      return res.status(500).json({ erro: 'Erro ao consultar peças da OS.' });
    }
  },

  /**
   * GET /api/pecas-os/requisicoes
   * Fila geral de requisições de peças em campo (para o painel do almoxarife)
   */
  async listarRequisicoes(req, res) {
    try {
      const { status } = req.query; // 'reserva_pendente' ou 'baixado_almoxarifado'

      const query = db('pecas_utilizadas_os as pu')
        .join('pecas as p', 'pu.peca_id', 'p.id')
        .join('chamados_os as c', 'pu.chamado_id', 'c.id')
        .join('ativos_postos as a', 'c.ativo_id', 'a.id')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .leftJoin('usuarios as u_sol', 'pu.solicitado_por_id', 'u_sol.id')
        .leftJoin('usuarios as u_ate', 'pu.atendido_por_id', 'u_ate.id')
        .select(
          'pu.id',
          'pu.chamado_id',
          'c.numero_os',
          'c.status as chamado_status',
          'a.tag_patrimonio',
          'a.nome as ativo_nome',
          'a.criticidade as ativo_criticidade',
          'l.nome as linha_nome',
          'p.id as peca_id',
          'p.codigo_sap',
          'p.descricao as peca_descricao',
          'p.categoria as peca_categoria',
          'p.localizacao_almoxarifado',
          'p.quantidade_estoque',
          'p.quantidade_minima',
          'pu.quantidade as quantidade_solicitada',
          'p.unidade_medida',
          'pu.status_movimentacao',
          'u_sol.nome as solicitado_por_nome',
          'u_ate.nome as atendido_por_nome',
          'pu.created_at',
          'pu.data_baixa'
        );

      if (status) {
        query.where('pu.status_movimentacao', status);
      }

      const requisicoes = await query.orderBy('pu.created_at', 'desc');
      return res.status(200).json(requisicoes);
    } catch (error) {
      console.error('[Pecas] Erro ao listar requisições gerais:', error);
      return res.status(500).json({ erro: 'Erro ao consultar requisições de peças.' });
    }
  },

  /**
   * POST /api/pecas/:id/entrada
   * Entrada de estoque ou reposição pelo almoxarife
   */
  async entradaEstoque(req, res) {
    try {
      const peca_id = Number(req.params.id);
      const { quantidade, observacao } = req.body;

      if (!quantidade || quantidade <= 0) {
        return res.status(400).json({ erro: 'Quantidade deve ser maior que zero.' });
      }

      const peca = await db('pecas').where({ id: peca_id, ativo: true }).first();
      if (!peca) {
        return res.status(404).json({ erro: 'Peça não encontrada.' });
      }

      await db('pecas')
        .where({ id: peca_id })
        .increment('quantidade_estoque', Number(quantidade));

      const pecaAtualizada = await db('pecas').where({ id: peca_id }).first();

      const io = req.app.get('io');
      if (io) {
        io.emit('estoque_atualizado', {
          peca: pecaAtualizada,
          entrada: Number(quantidade),
          observacao
        });
      }

      return res.status(200).json({
        mensagem: 'Entrada de estoque realizada com sucesso.',
        peca: pecaAtualizada
      });
    } catch (error) {
      console.error('[Pecas] Erro na entrada de estoque:', error);
      return res.status(500).json({ erro: 'Erro ao registrar entrada de estoque.' });
    }
  }
};

module.exports = pecaController;
