const db = require('../database/db');
const despachoService = require('./despachoService');

const slaEscalationService = {
  /**
   * Verifica chamados em status 'atribuido' sem T2 (inicio de reparo)
   * e executa escalonamento Nivel 1 (backup) e Nivel 2 (Supervisor PCM).
   */
  async verificarEscalonamentosSLA(io, options = {}) {
    const agora = options.now ? new Date(options.now) : new Date();
    const escalonamentos = [];

    const pendentes = await db('chamados_os as c')
      .join('ativos_postos as a', 'c.ativo_id', 'a.id')
      .select(
        'c.id',
        'c.numero_os',
        'c.ativo_id',
        'a.linha_id',
        'a.tag_patrimonio',
        'a.criticidade',
        'c.subsistema',
        'c.status_impacto',
        'c.prioridade',
        'c.mantenedor_atribuido_id',
        'c.t0_abertura',
        'c.t1_atribuicao',
        'c.sla_nivel_escalonado'
      )
      .where('c.status', 'atribuido')
      .whereNull('c.t2_inicio_reparo');

    for (const chamado of pendentes) {
      const refTempo = chamado.t1_atribuicao || chamado.t0_abertura;
      if (!refTempo) continue;

      const minutosEspera = (agora.getTime() - new Date(refTempo).getTime()) / (1000 * 60);

      const regra = await despachoService.encontrarRegraAplicavel(db, {
        linha_id: chamado.linha_id,
        subsistema: chamado.subsistema || null,
        criticidade: chamado.criticidade,
        status_impacto: chamado.status_impacto
      });

      const slaN1 = regra?.sla_aceite_minutos || (chamado.criticidade === 'A' ? 5 : 10);
      const slaN2 = regra?.sla_escalonamento_nivel2_minutos || (slaN1 * 2 + 2);

      // Nivel 1: sem aceite dentro de X min -> redireciona ao backup do turno
      if (chamado.sla_nivel_escalonado === 0 && minutosEspera >= slaN1) {
        let backupId = regra?.mantenedor_backup_id || null;
        if (!backupId || backupId === chamado.mantenedor_atribuido_id) {
          const outroTecnico = await db('usuarios')
            .where({ perfil: 'manutentor', ativo: true })
            .whereNot({ id: chamado.mantenedor_atribuido_id || 0 })
            .first();
          backupId = outroTecnico ? outroTecnico.id : chamado.mantenedor_atribuido_id;
        }

        const motivoN1 = `SLA Nivel 1 (${slaN1}m) excedido sem aceite no Field. Redirecionado para tecnico backup.`;

        await db.transaction(async (trx) => {
          await trx('chamados_os')
            .where({ id: chamado.id })
            .update({
              mantenedor_atribuido_id: backupId,
              sla_nivel_escalonado: 1,
              updated_at: agora
            });

          await trx('escalonamento_sla_logs').insert({
            chamado_id: chamado.id,
            nivel_escalonamento: 1,
            mantenedor_anterior_id: chamado.mantenedor_atribuido_id,
            destinatario_id: backupId,
            motivo: motivoN1,
            escalonado_em: agora
          });
        });

        const registro = {
          chamado_id: chamado.id,
          numero_os: chamado.numero_os,
          tag_patrimonio: chamado.tag_patrimonio,
          nivel: 1,
          destinatario_id: backupId,
          motivo: motivoN1,
          minutos_espera: Math.round(minutosEspera)
        };
        escalonamentos.push(registro);

        if (io) {
          io.emit('sla_escalonado', registro);
        }
      } else if (chamado.sla_nivel_escalonado === 1 && minutosEspera >= slaN2) {
        // Nivel 2: backup tambem nao iniciou -> alerta critico ao Supervisor PCM
        let supervisorId = regra?.supervisor_pcm_id || null;
        if (!supervisorId) {
          const supervisor = await db('usuarios')
            .whereIn('perfil', ['pcm_gestor', 'team_leader'])
            .andWhere({ ativo: true })
            .first();
          supervisorId = supervisor ? supervisor.id : null;
        }

        const motivoN2 = `SLA Nivel 2 (${slaN2}m) excedido: tecnico e backup sem deslocamento/inicio. Alerta critico ao Supervisor PCM.`;

        await db.transaction(async (trx) => {
          await trx('chamados_os')
            .where({ id: chamado.id })
            .update({
              sla_nivel_escalonado: 2,
              prioridade: 'critica',
              updated_at: agora
            });

          await trx('escalonamento_sla_logs').insert({
            chamado_id: chamado.id,
            nivel_escalonamento: 2,
            mantenedor_anterior_id: chamado.mantenedor_atribuido_id,
            destinatario_id: supervisorId,
            motivo: motivoN2,
            escalonado_em: agora
          });
        });

        const registro = {
          chamado_id: chamado.id,
          numero_os: chamado.numero_os,
          tag_patrimonio: chamado.tag_patrimonio,
          nivel: 2,
          destinatario_id: supervisorId,
          motivo: motivoN2,
          minutos_espera: Math.round(minutosEspera)
        };
        escalonamentos.push(registro);

        if (io) {
          io.emit('sla_escalonado_critico', registro);
        }
      }
    }

    return escalonamentos;
  },

  /**
   * Inicia worker periodico seguro em background (.unref evita bloquear encerramento de testes).
   */
  iniciarMonitoramentoSLA(app, intervalMs = 60000) {
    const timer = setInterval(async () => {
      try {
        const io = app.get('io');
        const eventos = await slaEscalationService.verificarEscalonamentosSLA(io);
        if (eventos.length > 0) {
          console.log(`[SLA Monitor] ${eventos.length} escalonamento(s) disparado(s).`);
        }
      } catch (error) {
        console.error('[SLA Monitor] Erro no ciclo de verificacao:', error.message);
      }
    }, intervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    return timer;
  }
};

module.exports = slaEscalationService;
