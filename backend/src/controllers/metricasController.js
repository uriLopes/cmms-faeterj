const db = require('../database/db');

const metricasController = {
  /**
   * GET /api/metricas/dashboard
   * Motor analítico industrial: MTBF, MTTR Líquido, MTTA, Disponibilidade (A) e Pareto
   */
  async getDashboardAnalytics(req, res) {
    try {
      const { dias = 30, linha_id } = req.query;
      const diasNum = Number(dias) || 30;

      // Data de corte para o filtro de dias
      const dataCorte = new Date();
      dataCorte.setDate(dataCorte.getDate() - diasNum);

      // Query base para chamados concluídos no período
      const queryBase = db('chamados_os as c')
        .join('ativos_postos as a', 'c.ativo_id', 'a.id')
        .join('linhas as l', 'a.linha_id', 'l.id')
        .leftJoin('apontamentos_os as ap', 'c.id', 'ap.chamado_id')
        .where('c.status', 'concluido')
        .andWhere('c.t3_conclusao_reparo', '>=', dataCorte);

      if (linha_id) {
        queryBase.where('a.linha_id', Number(linha_id));
      }

      const chamadosConcluidos = await queryBase.select(
        'c.id',
        'c.numero_os',
        'c.tipo_manutencao',
        'c.t0_abertura',
        'c.t1_atribuicao',
        'c.t2_inicio_reparo',
        'c.t3_conclusao_reparo',
        'c.tempo_resposta_minutos',
        'c.tempo_reparo_liquido_minutos',
        'c.tempo_downtime_total_minutos',
        'a.id as ativo_id',
        'a.tag_patrimonio',
        'a.nome as ativo_nome',
        'a.criticidade',
        'l.id as linha_id',
        'l.nome as linha_nome',
        'ap.arvore_falha_sistema',
        'ap.causa_raiz',
        'ap.necessita_revisao_preventiva'
      );

      // Total de chamados abertos e em andamento
      const chamadosEmAberto = await db('chamados_os')
        .whereIn('status', ['aberto', 'atribuido', 'em_reparo', 'pausado_peca'])
        .count('id as total')
        .first();

      const totalConcluidos = chamadosConcluidos.length;

      // 1. Cálculo do MTTR Líquido Médio (Mean Time To Repair)
      let somaMttrMinutos = 0;
      let somaMttaMinutos = 0;
      let somaDowntimeMinutos = 0;

      chamadosConcluidos.forEach((c) => {
        somaMttrMinutos += Number(c.tempo_reparo_liquido_minutos || 0);
        somaMttaMinutos += Number(c.tempo_resposta_minutos || 0);
        somaDowntimeMinutos += Number(c.tempo_downtime_total_minutos || 0);
      });

      const mttrMedioMinutos = totalConcluidos > 0 ? Math.round(somaMttrMinutos / totalConcluidos) : 0;
      const mttaMedioMinutos = totalConcluidos > 0 ? Math.round(somaMttaMinutos / totalConcluidos) : 0;
      const downtimeTotalHoras = Number((somaDowntimeMinutos / 60).toFixed(1));

      // 2. Cálculo do MTBF (Mean Time Between Failures)
      // Parâmetro de fábrica: 2 turnos de 8h = 16h/dia de produção nominal
      const totalLinhas = linha_id ? 1 : 5; // Planta com 5 linhas ativas
      const horasPlanejadas = diasNum * 16 * totalLinhas;
      const horasOperacaoNominal = Math.max(0, horasPlanejadas - downtimeTotalHoras);
      const mtbfHoras = totalConcluidos > 0 ? Number((horasOperacaoNominal / totalConcluidos).toFixed(1)) : horasPlanejadas;

      // 3. Disponibilidade Operacional Inerente (A)
      // A = MTBF / (MTBF + MTTR_em_horas) * 100%
      const mttrHoras = mttrMedioMinutos / 60;
      let disponibilidadePercentual = 100.0;
      if (mtbfHoras + mttrHoras > 0) {
        disponibilidadePercentual = Number(((mtbfHoras / (mtbfHoras + mttrHoras)) * 100).toFixed(2));
      }

      // 4. Diagrama de Pareto: Quebras por Subsistema (Árvore de Falhas)
      const subsistemasCount = {
        mecanica: 0,
        pneumatica: 0,
        eletrica: 0,
        automacao: 0
      };

      chamadosConcluidos.forEach((c) => {
        const sub = c.arvore_falha_sistema || 'mecanica';
        if (subsistemasCount[sub] !== undefined) {
          subsistemasCount[sub]++;
        } else {
          subsistemasCount[sub] = 1;
        }
      });

      // Transforma em array ordenado decrescente e calcula percentual acumulado
      const paretoSubsistemas = Object.entries(subsistemasCount)
        .map(([subsistema, quantidade]) => ({
          subsistema,
          quantidade,
          percentual: totalConcluidos > 0 ? Number(((quantidade / totalConcluidos) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.quantidade - a.quantidade);

      let somaPercentual = 0;
      paretoSubsistemas.forEach((item) => {
        somaPercentual += item.percentual;
        item.percentual_acumulado = Number(Math.min(100, somaPercentual).toFixed(1));
      });

      // 5. Maiores Ofensores da Fábrica (Ranking Top 5 por Downtime)
      const ofensoresMap = {};
      chamadosConcluidos.forEach((c) => {
        if (!ofensoresMap[c.ativo_id]) {
          ofensoresMap[c.ativo_id] = {
            ativo_id: c.ativo_id,
            tag_patrimonio: c.tag_patrimonio,
            ativo_nome: c.ativo_nome,
            criticidade: c.criticidade,
            linha_nome: c.linha_nome,
            total_quebras: 0,
            downtime_total_minutos: 0,
            mttr_medio_minutos: 0
          };
        }
        ofensoresMap[c.ativo_id].total_quebras++;
        ofensoresMap[c.ativo_id].downtime_total_minutos += Number(c.tempo_downtime_total_minutos || 0);
      });

      const topOfensores = Object.values(ofensoresMap)
        .map((o) => ({
          ...o,
          downtime_horas: Number((o.downtime_total_minutos / 60).toFixed(1)),
          mttr_medio_minutos: Math.round(o.downtime_total_minutos / (o.total_quebras || 1))
        }))
        .sort((a, b) => b.downtime_total_minutos - a.downtime_total_minutos)
        .slice(0, 5);

      // 6. Indicadores Agrupados por Linha de Produção
      const linhasMap = {};
      chamadosConcluidos.forEach((c) => {
        if (!linhasMap[c.linha_id]) {
          linhasMap[c.linha_id] = {
            linha_id: c.linha_id,
            linha_nome: c.linha_nome,
            total_os: 0,
            downtime_minutos: 0
          };
        }
        linhasMap[c.linha_id].total_os++;
        linhasMap[c.linha_id].downtime_minutos += Number(c.tempo_downtime_total_minutos || 0);
      });

      const metricasLinhas = Object.values(linhasMap).map((l) => ({
        ...l,
        downtime_horas: Number((l.downtime_minutos / 60).toFixed(1)),
        mttr_medio_minutos: Math.round(l.downtime_minutos / (l.total_os || 1))
      }));

      // 7. Alertas de Revisão Preventiva Solicitada em Campo
      const revisaoPreventivaSinalizada = chamadosConcluidos.filter(
        (c) => c.necessita_revisao_preventiva === 1
      ).length;

      return res.status(200).json({
        periodo_dias: diasNum,
        total_linhas_ativas: totalLinhas,
        resumo_geral: {
          total_os_concluidas: totalConcluidos,
          total_os_em_aberto: Number(chamadosEmAberto.total || 0),
          mttr_medio_minutos: mttrMedioMinutos,
          mttr_medio_horas: Number((mttrMedioMinutos / 60).toFixed(2)),
          mtta_medio_minutos: mttaMedioMinutos,
          mtbf_horas: mtbfHoras,
          disponibilidade_percentual: disponibilidadePercentual,
          downtime_total_horas: downtimeTotalHoras,
          horas_planejadas: horasPlanejadas,
          revisao_preventiva_sinalizada: revisaoPreventivaSinalizada
        },
        pareto_subsistemas: paretoSubsistemas,
        top_ofensores: topOfensores,
        metricas_linhas: metricasLinhas
      });
    } catch (error) {
      console.error('[Metricas] Erro ao consolidar indicadores de confiabilidade:', error);
      return res.status(500).json({ erro: 'Erro interno ao processar indicadores da fábrica.' });
    }
  }
};

module.exports = metricasController;