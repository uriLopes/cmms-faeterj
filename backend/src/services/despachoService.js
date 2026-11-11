const db = require('../database/db');

const RANK_CRITICIDADE = { A: 3, B: 2, C: 1 };

const despachoService = {
  /**
   * Calcula matriz GUT (Gravidade x Urgencia x Tendencia) para apoio de triagem PCM.
   */
  calcularScoreGUT(chamado) {
    const crit = chamado.ativo_criticidade || chamado.criticidade || 'B';
    const parada = chamado.status_impacto === 'maquina_parada';

    const gravidade = crit === 'A' ? 5 : crit === 'B' ? 4 : 2;
    const urgencia = parada ? 5 : 3;
    const tendencia = parada && crit === 'A' ? 5 : parada ? 4 : 2;

    return {
      gravidade,
      urgencia,
      tendencia,
      gut_score: gravidade * urgencia * tendencia
    };
  },

  /**
   * Seleciona o mantenedor mais adequado considerando carga ativa e especialidade.
   */
  async _contarCargaMantenedores(trx, usuarioIds) {
    if (!usuarioIds.length) return {};

    const rows = await trx('chamados_os')
      .select('mantenedor_atribuido_id')
      .count('id as total')
      .whereIn('mantenedor_atribuido_id', usuarioIds)
      .whereIn('status', ['atribuido', 'em_deslocamento', 'em_reparo', 'pausado_peca'])
      .groupBy('mantenedor_atribuido_id');

    const cargaMap = {};
    for (const id of usuarioIds) cargaMap[id] = 0;
    for (const r of rows) {
      cargaMap[r.mantenedor_atribuido_id] = Number(r.total) || 0;
    }
    return cargaMap;
  },

  /**
   * Busca regra mais especifica ativa para o ativo/subsistema/impacto.
   */
  async encontrarRegraAplicavel(trx, { linha_id, subsistema, criticidade, status_impacto }) {
    const queryBuilder = trx || db;
    const regras = await queryBuilder('regras_despacho_auto')
      .where({ ativo: true })
      .orderBy('id', 'asc');

    const rankAtivo = RANK_CRITICIDADE[criticidade] || 1;
    const isParada = status_impacto === 'maquina_parada';

    const elegiveis = regras.filter((r) => {
      const rankMinimo = RANK_CRITICIDADE[r.criticidade_ativo_minima] || 3;
      if (rankAtivo < rankMinimo) return false;
      if (r.exige_linha_parada && !isParada) return false;
      if (r.linha_id && r.linha_id !== linha_id) return false;
      if (r.subsistema && r.subsistema !== subsistema) return false;
      return true;
    });

    if (!elegiveis.length) return null;

    // Prioriza especificidade: linha + subsistema > linha > subsistema > global
    elegiveis.sort((a, b) => {
      const specA = (a.linha_id ? 2 : 0) + (a.subsistema ? 1 : 0);
      const specB = (b.linha_id ? 2 : 0) + (b.subsistema ? 1 : 0);
      return specB - specA;
    });

    return elegiveis[0];
  },

  /**
   * Eixo 3: Avalia e executa Auto-Dispatching dentro da transacao de abertura de OS.
   * Pula a fila de triagem manual da Central quando criterio critico for atendido.
   */
  async avaliarAutoDespacho(trx, { chamadoId, ativo, subsistema, status_impacto, t0 }) {
    const regra = await despachoService.encontrarRegraAplicavel(trx, {
      linha_id: ativo.linha_id,
      subsistema: subsistema || null,
      criticidade: ativo.criticidade,
      status_impacto
    });

    if (!regra) {
      return { despachado: false, motivo: 'Sem regra de despacho automatico para este nivel de impacto/criticidade.' };
    }

    const candidatosIds = [regra.mantenedor_primario_id, regra.mantenedor_backup_id].filter(Boolean);
    const candidatosAtivos = await trx('usuarios')
      .whereIn('id', candidatosIds)
      .andWhere({ ativo: true })
      .select('id', 'nome', 'matricula');

    if (!candidatosAtivos.length) {
      return { despachado: false, motivo: 'Mantenedores configurados na regra estao inativos.' };
    }

    const cargaMap = await despachoService._contarCargaMantenedores(
      trx,
      candidatosAtivos.map((u) => u.id)
    );

    // Mantem preferencia no primario, mas migra para backup se primario estiver sobrecarregado (>= 2 OS a mais)
    const primario = candidatosAtivos.find((u) => u.id === regra.mantenedor_primario_id);
    const backup = candidatosAtivos.find((u) => u.id === regra.mantenedor_backup_id);

    let escolhido = primario || candidatosAtivos[0];
    if (primario && backup) {
      const cargaPrim = cargaMap[primario.id] || 0;
      const cargaBkp = cargaMap[backup.id] || 0;
      if (cargaPrim >= cargaBkp + 2) {
        escolhido = backup;
      }
    }

    await trx('chamados_os')
      .where({ id: chamadoId })
      .update({
        mantenedor_atribuido_id: escolhido.id,
        status: 'atribuido',
        t1_atribuicao: t0,
        tempo_resposta_minutos: 0,
        despacho_automatico: true,
        updated_at: t0
      });

    return {
      despachado: true,
      regra_id: regra.id,
      mantenedor: escolhido,
      sla_aceite_minutos: regra.sla_aceite_minutos,
      sla_escalonamento_nivel2_minutos: regra.sla_escalonamento_nivel2_minutos
    };
  },

  /**
   * Gera recomendacao semi-automatizada de tecnico + score GUT para chamados nao criticos na Central.
   */
  async recomendarTriagemParaChamados(chamados) {
    const manutentores = await db('usuarios')
      .where({ perfil: 'manutentor', ativo: true })
      .select('id', 'nome', 'matricula');

    const cargaMap = await despachoService._contarCargaMantenedores(
      db,
      manutentores.map((m) => m.id)
    );

    return chamados.map((chamado) => {
      const gut = despachoService.calcularScoreGUT(chamado);
      const sub = (chamado.subsistema || '').toLowerCase();

      const ranqueados = manutentores
        .map((m) => {
          const nomeLower = m.nome.toLowerCase();
          let afinidade = 0;
          if (sub === 'eletrico' && (nomeLower.includes('eletric') || nomeLower.includes('autom'))) afinidade = 2;
          if ((sub === 'mecanico' || sub === 'pneumatico' || sub === 'hidraulico') && (nomeLower.includes('mec') || nomeLower.includes('mecat'))) afinidade = 2;
          const carga = cargaMap[m.id] || 0;
          return {
            id: m.id,
            nome: m.nome,
            matricula: m.matricula,
            carga_ativa: carga,
            afinidade_especialidade: afinidade > 0,
            score_adequacao: (afinidade * 10) - (carga * 4)
          };
        })
        .sort((a, b) => b.score_adequacao - a.score_adequacao);

      return {
        ...chamado,
        gut,
        tecnico_recomendado: ranqueados[0] || null
      };
    });
  }
};

module.exports = despachoService;
