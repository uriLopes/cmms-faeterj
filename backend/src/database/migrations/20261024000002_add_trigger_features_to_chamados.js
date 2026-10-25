/**
 * Migration para suporte aos recursos avançados do Vanguard Trigger:
 * - status_impacto (Impacto operacional imediato: Máquina Parada, Com Restrição, Melhoria)
 * - foto_anexo (Registro visual fotográfico do posto ou anomalia)
 * - audio_anexo (Registro sonoro de ruído mecânico anormal)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasStatus = await knex.schema.hasColumn('chamados_os', 'status_impacto');
  if (!hasStatus) {
    await knex.schema.alterTable('chamados_os', (table) => {
      table.string('status_impacto', 50).defaultTo('maquina_parada');
    });
  }

  const hasFoto = await knex.schema.hasColumn('chamados_os', 'foto_anexo');
  if (!hasFoto) {
    await knex.schema.alterTable('chamados_os', (table) => {
      table.text('foto_anexo', 'longtext').nullable();
    });
  }

  const hasAudio = await knex.schema.hasColumn('chamados_os', 'audio_anexo');
  if (!hasAudio) {
    await knex.schema.alterTable('chamados_os', (table) => {
      table.text('audio_anexo', 'longtext').nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('chamados_os', (table) => {
    table.dropColumn('status_impacto');
    table.dropColumn('foto_anexo');
    table.dropColumn('audio_anexo');
  });
};
