/**
 * Migration: Vanguard V2 Industrial Architecture
 * Cobre os 6 eixos: Local-First Sync, Deduplicacao/Adendos, Auto-Dispatch/SLA,
 * Ingestao IoT (ISA-18.2 Anti-Chattering), Taxonomia ISO 14224 e BOM/Estoque Atomico.
 */

exports.up = async function (knex) {
  // 1. Evolucao de chamados_os com rastreabilidade V2
  await knex.schema.alterTable('chamados_os', (table) => {
    table
      .enu('origem_abertura', [
        'OPERADOR_QR',
        'OPERADOR_HIERARQUIA',
        'IOT_PLC',
        'PREVENTIVA',
        'CENTRAL'
      ])
      .notNullable()
      .defaultTo('OPERADOR_QR')
      .after('numero_os');

    table
      .enu('subsistema', [
        'mecanico',
        'eletrico',
        'pneumatico',
        'hidraulico',
        'operacional'
      ])
      .nullable()
      .after('sintoma_id');

    table
      .boolean('despacho_automatico')
      .notNullable()
      .defaultTo(false)
      .after('t1_atribuicao');

    table
      .integer('total_adendos')
      .unsigned()
      .notNullable()
      .defaultTo(0)
      .after('despacho_automatico');

    table
      .string('idempotency_key', 100)
      .nullable()
      .unique()
      .after('total_adendos');

    table
      .integer('sla_nivel_escalonado')
      .unsigned()
      .notNullable()
      .defaultTo(0)
      .after('idempotency_key');

    table
      .string('iot_evento_ref', 120)
      .nullable()
      .after('sla_nivel_escalonado');
  });

  // 2. Eixo 2: Adendos de contexto por deduplicacao ativa / corroboracao IoT
  await knex.schema.createTable('chamado_adendos', (table) => {
    table.increments('id').primary();
    table
      .integer('chamado_pai_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('chamados_os')
      .onDelete('CASCADE');
    table.string('origem', 40).notNullable().defaultTo('OPERADOR');
    table.string('operador_matricula', 50).nullable();
    table.string('operador_nome', 120).nullable();
    table.string('subsistema', 40).nullable();
    table.string('criticidade_reportada', 50).nullable();
    table.text('descricao').nullable();
    table.boolean('elevou_prioridade').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['chamado_pai_id', 'created_at']);
  });

  // 3. Eixo 1: Log de sincronizacao Local-First e deteccao de conflitos (Outbox)
  await knex.schema.createTable('outbox_eventos_sync', (table) => {
    table.increments('id').primary();
    table.string('event_id', 80).notNullable().unique();
    table.string('device_id', 80).notNullable();
    table
      .integer('usuario_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table
      .integer('chamado_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('chamados_os')
      .onDelete('SET NULL');
    table.string('event_type', 60).notNullable();
    table.dateTime('occurred_at_client_utc', { precision: 3 }).notNullable();
    table.dateTime('received_at_server_utc', { precision: 3 }).notNullable();
    table.json('payload_json').notNullable();
    table
      .enu('status_reconciliacao', [
        'APLICADO',
        'CONFLITO_REATRIBUICAO',
        'IGNORADO_DUPLICADO',
        'REJEITADO_VALIDACAO'
      ])
      .notNullable();
    table.string('motivo_reconciliacao', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['chamado_id', 'event_type']);
  });

  // 4. Eixo 3: Matriz de regras de Auto-Dispatch e thresholds SLA
  await knex.schema.createTable('regras_despacho_auto', (table) => {
    table.increments('id').primary();
    table
      .integer('linha_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('linhas')
      .onDelete('CASCADE');
    table
      .enu('subsistema', [
        'mecanico',
        'eletrico',
        'pneumatico',
        'hidraulico',
        'operacional'
      ])
      .nullable();
    table
      .enu('criticidade_ativo_minima', ['A', 'B', 'C'])
      .notNullable()
      .defaultTo('A');
    table.boolean('exige_linha_parada').notNullable().defaultTo(true);
    table
      .integer('mantenedor_primario_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('CASCADE');
    table
      .integer('mantenedor_backup_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table
      .integer('supervisor_pcm_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table.integer('sla_aceite_minutos').unsigned().notNullable().defaultTo(5);
    table
      .integer('sla_escalonamento_nivel2_minutos')
      .unsigned()
      .notNullable()
      .defaultTo(12);
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 5. Eixo 3: Auditoria de escalonamento SLA
  await knex.schema.createTable('escalonamento_sla_logs', (table) => {
    table.increments('id').primary();
    table
      .integer('chamado_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('chamados_os')
      .onDelete('CASCADE');
    table.integer('nivel_escalonamento').unsigned().notNullable();
    table
      .integer('mantenedor_anterior_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table
      .integer('destinatario_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table.string('motivo', 255).notNullable();
    table.dateTime('escalonado_em', { precision: 3 }).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['chamado_id', 'nivel_escalonamento']);
  });

  // 6. Eixo 4: Registro de Edge Gateways IoT / PLCs & Heartbeat
  await knex.schema.createTable('iot_dispositivos', (table) => {
    table.increments('id').primary();
    table.string('gateway_id', 80).notNullable().unique();
    table.string('nome', 120).notNullable();
    table.string('protocolo', 40).notNullable().defaultTo('MQTT_BRIDGE_REST');
    table.string('plant_id', 50).notNullable().defaultTo('plant-faeterj-01');
    table.string('hmac_secret', 128).notNullable();
    table
      .enu('status_saude', ['ONLINE', 'DEGRADADO', 'OFFLINE'])
      .notNullable()
      .defaultTo('ONLINE');
    table.dateTime('ultimo_heartbeat', { precision: 3 }).nullable();
    table.json('metadata_json').nullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 7. Eixo 4: Ingestao de sinais e gatekeeper Anti-Chattering (ISA-18.2)
  await knex.schema.createTable('iot_sinais_ingestao', (table) => {
    table.increments('id').primary();
    table.string('gateway_id', 80).notNullable();
    table
      .integer('ativo_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('ativos_postos')
      .onDelete('CASCADE');
    table.string('codigo_falha_clp', 60).notNullable();
    table.string('tag_clp', 120).notNullable();
    table.string('severidade_clp', 30).notNullable().defaultTo('CRITICAL');
    table
      .enu('subsistema_inferido', [
        'mecanico',
        'eletrico',
        'pneumatico',
        'hidraulico',
        'operacional'
      ])
      .notNullable()
      .defaultTo('eletrico');
    table
      .enu('estado_sinal', ['ACTIVE', 'CLEARED', 'SUPRESSED_CHATTERING'])
      .notNullable()
      .defaultTo('ACTIVE');
    table.integer('transicoes_janela_5m').unsigned().notNullable().defaultTo(1);
    table.dateTime('cooldown_ate', { precision: 3 }).nullable();
    table
      .integer('chamado_gerado_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('chamados_os')
      .onDelete('SET NULL');
    table.json('payload_bruto_json').nullable();
    table.dateTime('ocorrido_em', { precision: 3 }).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['ativo_id', 'codigo_falha_clp', 'ocorrido_em']);
  });

  // 8. Eixo 5: Taxonomia Estruturada ISO 14224 (3 niveis)
  await knex.schema.createTable('iso_modos_falha', (table) => {
    table.increments('id').primary();
    table.string('codigo_iso', 20).notNullable().unique();
    table
      .enu('subsistema', [
        'mecanico',
        'eletrico',
        'pneumatico',
        'hidraulico',
        'operacional'
      ])
      .notNullable();
    table.string('nome', 140).notNullable();
    table.string('descricao', 255).nullable();
    table.boolean('ativo').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('iso_causas_raiz', (table) => {
    table.increments('id').primary();
    table
      .integer('modo_falha_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('iso_modos_falha')
      .onDelete('CASCADE');
    table.string('codigo_iso', 20).notNullable();
    table.string('nome', 140).notNullable();
    table.string('categoria', 60).nullable();
    table.boolean('ativo').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('iso_acoes_corretivas', (table) => {
    table.increments('id').primary();
    table.string('codigo_iso', 20).notNullable().unique();
    table.string('nome', 140).notNullable();
    table.boolean('requer_troca_peca').notNullable().defaultTo(false);
    table.boolean('gera_pendencia_preventiva').notNullable().defaultTo(false);
    table.boolean('ativo').notNullable().defaultTo(true);
  });

  await knex.schema.alterTable('apontamentos_os', (table) => {
    table
      .integer('modo_falha_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('iso_modos_falha')
      .onDelete('SET NULL')
      .after('arvore_falha_sistema');

    table
      .integer('causa_raiz_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('iso_causas_raiz')
      .onDelete('SET NULL')
      .after('modo_falha_id');

    table
      .integer('acao_corretiva_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('iso_acoes_corretivas')
      .onDelete('SET NULL')
      .after('causa_raiz_id');
  });

  // 9. Eixo 6: BOM Critica por Ativo e Movimentacoes Atomicas de Estoque
  await knex.schema.createTable('ativo_bom_pecas', (table) => {
    table.increments('id').primary();
    table
      .integer('ativo_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('ativos_postos')
      .onDelete('CASCADE');
    table
      .integer('peca_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('pecas')
      .onDelete('CASCADE');
    table
      .enu('subsistema', [
        'mecanico',
        'eletrico',
        'pneumatico',
        'hidraulico',
        'operacional'
      ])
      .nullable();
    table.integer('quantidade_instalada').unsigned().notNullable().defaultTo(1);
    table
      .enu('criticidade_reposicao', ['VITAL', 'ESSENCIAL', 'NORMAL'])
      .notNullable()
      .defaultTo('ESSENCIAL');
    table.timestamps(true, true);

    table.unique(['ativo_id', 'peca_id']);
  });

  await knex.schema.createTable('movimentacoes_estoque', (table) => {
    table.increments('id').primary();
    table
      .integer('peca_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('pecas')
      .onDelete('CASCADE');
    table
      .integer('chamado_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('chamados_os')
      .onDelete('SET NULL');
    table
      .integer('usuario_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onDelete('SET NULL');
    table
      .enu('tipo_movimentacao', [
        'RESERVA',
        'BAIXA_DIRETA',
        'BAIXA_ENTREGA',
        'ESTORNO',
        'ENTRADA'
      ])
      .notNullable();
    table.integer('quantidade').unsigned().notNullable();
    table.integer('saldo_anterior').notNullable();
    table.integer('saldo_posterior').notNullable();
    table.string('observacao', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['peca_id', 'chamado_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('movimentacoes_estoque');
  await knex.schema.dropTableIfExists('ativo_bom_pecas');

  await knex.schema.alterTable('apontamentos_os', (table) => {
    table.dropForeign('acao_corretiva_id');
    table.dropForeign('causa_raiz_id');
    table.dropForeign('modo_falha_id');
    table.dropColumn('acao_corretiva_id');
    table.dropColumn('causa_raiz_id');
    table.dropColumn('modo_falha_id');
  });

  await knex.schema.dropTableIfExists('iso_acoes_corretivas');
  await knex.schema.dropTableIfExists('iso_causas_raiz');
  await knex.schema.dropTableIfExists('iso_modos_falha');
  await knex.schema.dropTableIfExists('iot_sinais_ingestao');
  await knex.schema.dropTableIfExists('iot_dispositivos');
  await knex.schema.dropTableIfExists('escalonamento_sla_logs');
  await knex.schema.dropTableIfExists('regras_despacho_auto');
  await knex.schema.dropTableIfExists('outbox_eventos_sync');
  await knex.schema.dropTableIfExists('chamado_adendos');

  await knex.schema.alterTable('chamados_os', (table) => {
    table.dropColumn('iot_evento_ref');
    table.dropColumn('sla_nivel_escalonado');
    table.dropColumn('idempotency_key');
    table.dropColumn('total_adendos');
    table.dropColumn('despacho_automatico');
    table.dropColumn('subsistema');
    table.dropColumn('origem_abertura');
  });
};
