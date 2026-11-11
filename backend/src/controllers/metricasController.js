const db = require('../database/db');

const HORAS_TURNO_DIA = 16;

function round2(num) {
  return Math.round(num * 100) / 100;
}

const metricasController = {
  /**
   * GET /api/metricas/dashboard
   * Motor de Indicadores Industriais & Confiabilidade V2 (ISO 14224):
   * - Disponibilidade Operacional (A_op, inclui esperas T3-T0) vs Inerente (A_i, MTBF/(MTBF+MTTR_liq))
   * - Calculo dinamico por quantidade real de linhas ativas (sem hardcoded 5)
   * - Dual Bad Actors Pareto (Downtime vs Frequencia)
   * - Distribuicao de Causas Raiz (%) por Setor fabril
   */
  async getDashboardAnalytics(req, res) {
    try {
      const dias = Math.max(1, Number(req.query.dias) || 30);
      const linhaId = req.query.linha_id ? Number(req.query.linha_id) : null;
      const dataCorte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

      // 1. Linhas ativas reais no banco
      const linhasQuery = db('linhas').where({ ativo: true });
      if (linhaId) linhasQuery.andWhere({ id: linhaId });
      const linhasAtivas = await linhasQuery.select('id', 'nome', 'setor');
      const totalLinhasReais = Math.max(1, linhasAtivas.length);

      const horasPlanejadas = dias * HORAS_TURNO_DIA * totalLinhasReais;

      // 2. Consulta OS concluidas no periodo
      const concluidasQuery = db('chamados_os as c')
        .join('ativos_postos as a', 'c.ativo_id', 'a.id')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .leftJoin('apontamentos_os as ap', 'ap.chamado_id', 'c.id')
        .leftJoin('iso_modos_falha as mf', 'ap.modo_falha_id', 'mf.id')
        .leftJoin('iso_causas_raiz as cr', 'ap.causa_raiz_id', 'cr.id')
        .leftJoin('iso_acoes_corretivas as ac', 'ap.acao_corretiva_id', 'ac.id')
        .where('c.status', 'concluido')
        .andWhere('c.chamado_invalido', false)
        .andWhere('c.t0_abertura', '>=', dataCorte)
        .select(
          'c.id',
          'c.ativo_id',
          'a.tag_patrimonio',
          'a.nome as ativo_nome',
          'a.criticidade',
          'l.id as linha_id',
          'l.nome as linha_nome',
          'l.setor as linha_setor',
          'c.subsistema',
          'c.tempo_resposta_minutos',
          'c.tempo_reparo_liquido_minutos',
          'c.tempo_downtime_total_minutos',
          'ap.arvore_falha_sistema',
          'ap.causa_raiz',
          'ap.necessita_revisao_preventiva',
          'mf.codigo_iso as modo_codigo',
          'mf.nome as modo_nome',
          'cr.codigo_iso as causa_codigo',
          'cr.nome as causa_iso_nome',
          'cr.categoria as causa_categoria'
        );

      if (linhaId) {
        concluidasQuery.andWhere('l.id', linhaId);
      }

      const osConcluidas = await concluidasQuery;

      // 3. Total de OS em aberto no escopo
      const abertasQuery = db('chamados_os as c')
        .join('ativos_postos as a', 'c.ativo_id', 'a.id')
        .whereIn('c.status', ['aberto', 'atribuido', 'em_deslocamento', 'em_reparo', 'pausado_peca'])
        .andWhere('c.chamado_invalido', false);
      if (linhaId) abertasQuery.andWhere('a.linha_id', linhaId);
      const abertasRow = await abertasQuery.count('c.id as total').first();
      const totalAbertas = Number(abertasRow?.total || 0);

      // 4. Indicadores agregados (MTTA, MTTR Liquido, MTBF, A_op vs A_i)
      const totalConcluidas = osConcluidas.length;
      let somaRespostaMin = 0;
      let somaReparoLiqMin = 0;
      let somaDowntimeMin = 0;
      let revisoesPreventivas = 0;

      for (const os of osConcluidas) {
        somaRespostaMin += Number(os.tempo_resposta_minutos || 0);
        somaReparoLiqMin += Number(os.tempo_reparo_liquido_minutos || 0);
        somaDowntimeMin += Number(os.tempo_downtime_total_minutos || os.tempo_reparo_liquido_minutos || 0);
        if (os.necessita_revisao_preventiva) revisoesPreventivas += 1;
      }

      const mttaMin = totalConcluidas > 0 ? Math.round(somaRespostaMin / totalConcluidas) : 0;
      const mttrMin = totalConcluidas > 0 ? Math.round(somaReparoLiqMin / totalConcluidas) : 0;
      const mttrHoras = round2(mttrMin / 60);
      const downtimeTotalHoras = round2(somaDowntimeMin / 60);
      const reparoLiquidoTotalHoras = round2(somaReparoLiqMin / 60);
      const tempoPerdidoEsperaHoras = Math.max(0, round2(downtimeTotalHoras - reparoLiquidoTotalHoras));

      const horasOperacaoEfetiva = Math.max(0, horasPlanejadas - downtimeTotalHoras);
      const mtbfHoras = totalConcluidas > 0
        ? round2(horasOperacaoEfetiva / totalConcluidas)
        : horasPlanejadas;

      // Disponibilidade Inerente Pura: MTBF / (MTBF + MTTR_liquido)
      const disponibilidadeInerentePct =
        mtbfHoras + mttrHoras > 0 ? round2((mtbfHoras / (mtbfHoras + mttrHoras)) * 100) : 100;

      // Disponibilidade Operacional Real: (Horas Planejadas - Downtime T3-T0) / Horas Planejadas
      const disponibilidadeOperacionalPct =
        horasPlanejadas > 0
          ? Math.max(0, round2((horasOperacaoEfetiva / horasPlanejadas) * 100))
          : 100;

      // 5. Pareto de Subsistemas (compatibilidade + normalizacao mecanico/eletrico/pneumatico/hidraulico/operacional)
      const subContagem = {};
      for (const os of osConcluidas) {
        const sub = (os.subsistema || os.arvore_falha_sistema || 'nao_classificado').toLowerCase();
        subContagem[sub] = (subContagem[sub] || 0) + 1;
      }

      const subOrdenados = Object.entries(subContagem)
        .map(([subsistema, quantidade]) => ({ subsistema, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);

      let acumulado = 0;
      const paretoSubsistemas = subOrdenados.map((item) => {
        const pct = totalConcluidas > 0 ? round2((item.quantidade / totalConcluidas) * 100) : 0;
        acumulado = Math.min(100, round2(acumulado + pct));
        return {
          ...item,
          percentual: pct,
          percentual_acumulado: acumulado
        };
      });

      // 6. Dual Bad Actors Pareto por Ativo (Top 5 Downtime & Top 5 Volume)
      const ativoMap = {};
      for (const os of osConcluidas) {
        if (!ativoMap[os.ativo_id]) {
          ativoMap[os.ativo_id] = {
            ativo_id: os.ativo_id,
            tag_patrimonio: os.tag_patrimonio,
            ativo_nome: os.ativo_nome,
            criticidade: os.criticidade,
            linha_nome: os.linha_nome,
            total_quebras: 0,
            soma_downtime_min: 0,
            soma_reparo_liq_min: 0
          };
        }
        const entry = ativoMap[os.ativo_id];
        entry.total_quebras += 1;
        entry.soma_downtime_min += Number(os.tempo_downtime_total_minutos || 0);
        entry.soma_reparo_liq_min += Number(os.tempo_reparo_liquido_minutos || 0);
      }

      const ativosLista = Object.values(ativoMap).map((a) => ({
        ativo_id: a.ativo_id,
        tag_patrimonio: a.tag_patrimonio,
        ativo_nome: a.ativo_nome,
        criticidade: a.criticidade,
        linha_nome: a.linha_nome,
        total_quebras: a.total_quebras,
        downtime_horas: round2(a.soma_downtime_min / 60),
        mttr_medio_minutos: a.total_quebras > 0 ? Math.round(a.soma_reparo_liq_min / a.total_quebras) : 0
      }));

      const topOfensoresDowntime = [...ativosLista]
        .sort((a, b) => b.downtime_horas - a.downtime_horas || b.total_quebras - a.total_quebras)
        .slice(0, 5);

      const topOfensoresVolume = [...ativosLista]
        .sort((a, b) => b.total_quebras - a.total_quebras || b.downtime_horas - a.downtime_horas)
        .slice(0, 5);

      // 7. Metricas consolidadas por Linha Fabril
      const linhaMap = {};
      for (const os of osConcluidas) {
        if (!linhaMap[os.linha_id]) {
          linhaMap[os.linha_id] = {
            linha_id: os.linha_id,
            linha_nome: os.linha_nome,
            total_os: 0,
            soma_downtime_min: 0,
            soma_reparo_min: 0
          };
        }
        const lEntry = linhaMap[os.linha_id];
        lEntry.total_os += 1;
        lEntry.soma_downtime_min += Number(os.tempo_downtime_total_minutos || 0);
        lEntry.soma_reparo_min += Number(os.tempo_reparo_liquido_minutos || 0);
      }

      const metricasLinhas = Object.values(linhaMap)
        .map((l) => ({
          linha_id: l.linha_id,
          linha_nome: l.linha_nome,
          total_os: l.total_os,
          downtime_horas: round2(l.soma_downtime_min / 60),
          mttr_medio_minutos: l.total_os > 0 ? Math.round(l.soma_reparo_min / l.total_os) : 0
        }))
        .sort((a, b) => b.downtime_horas - a.downtime_horas);

      // 8. Causas Raiz (%) por Setor (ISO 14224 + fallback texto legado)
      const setorTotal = {};
      const setorCausas = {};
      for (const os of osConcluidas) {
        const setor = os.linha_setor || 'Geral';
        const causaLabel = os.causa_iso_nome || os.causa_raiz || 'Nao especificada';
        const codigo = os.causa_codigo || 'LEGADO';
        const chave = `${setor}::${codigo}::${causaLabel}`;

        setorTotal[setor] = (setorTotal[setor] || 0) + 1;
        if (!setorCausas[chave]) {
          setorCausas[chave] = {
            setor,
            codigo_iso: codigo,
            causa_raiz: causaLabel,
            categoria: os.causa_categoria || 'Geral',
            quantidade: 0
          };
        }
        setorCausas[chave].quantidade += 1;
      }

      const causasRaizPorSetor = Object.values(setorCausas)
        .map((item) => ({
          ...item,
          percentual_setor: setorTotal[item.setor] > 0
            ? round2((item.quantidade / setorTotal[item.setor]) * 100)
            : 0
        }))
        .sort((a, b) => b.percentual_setor - a.percentual_setor || b.quantidade - a.quantidade);

      return res.status(200).json({
        periodo_dias: dias,
        resumo_geral: {
          linhas_ativas_consideradas: totalLinhasReais,
          horas_planejadas: horasPlanejadas,
          disponibilidade_percentual: disponibilidadeOperacionalPct,
          disponibilidade_operacional_pct: disponibilidadeOperacionalPct,
          disponibilidade_inerente_pct: disponibilidadeInerentePct,
          mtbf_horas: mtbfHoras,
          mttr_medio_minutos: mttrMin,
          mttr_medio_horas: mttrHoras,
          mtta_medio_minutos: mttaMin,
          downtime_total_horas: downtimeTotalHoras,
          tempo_perdido_espera_horas: tempoPerdidoEsperaHoras,
          total_os_concluidas: totalConcluidas,
          total_os_em_aberto: totalAbertas,
          revisao_preventiva_sinalizada: revisoesPreventivas
        },
        pareto_subsistemas: paretoSubsistemas,
        top_ofensores: topOfensoresDowntime,
        top_ofensores_downtime: topOfensoresDowntime,
        top_ofensores_volume: topOfensoresVolume,
        causas_raiz_por_setor: causasRaizPorSetor,
        metricas_linhas: metricasLinhas
      });
    } catch (error) {
      console.error('[Metricas V2] Erro ao calcular dashboard:', error);
      return res.status(500).json({ erro: 'Erro interno ao processar indicadores industriais.' });
    }
  }
};

module.exports = metricasController;
