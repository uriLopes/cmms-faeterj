/**
 * Migration Principal do Schema CMMS FAETERJ
 * Cobre os 19 Casos de Uso (UC01 a UC19), 4 Timestamps (T0 a T3),
 * Pausas não-bloqueantes, Estoque com Reserva Pendente e Rastreabilidade Fabril.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Tabela: usuarios
  await knex.schema.createTable('usuarios', (table) => {
    table.increments('id').primary();
    table.string('nome', 120).notNullable();
    table.string('matricula', 30).unique().notNullable(); // RE de crachá
    table.string('senha_hash', 255).nullable(); // Nulo para operadores puros (fricção zero)
    table.enum('perfil', [
      'operador',
      'team_leader',
      'manutentor',
      'pcm_gestor',
      'almoxarife',
      'admin'
    ]).notNullable().defaultTo('operador');
    table.string('ramal_telefone', 20).nullable();
    table.boolean('ativo').defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. Tabela: linhas (Linhas de produção fabris)
  await knex.schema.createTable('linhas', (table) => {
    table.increments('id').primary();
    table.string('nome', 80).notNullable(); // ex: 'Chaparia - Linha MV3'
    table.string('setor', 50).notNullable(); // ex: 'chaparia', 'pintura', 'montagem'
    table.boolean('ativo').defaultTo(true);
    table.timestamps(true, true);
  });

  // 3. Tabela: ativos_postos (Máquinas e postos com QR Code físico)
  await knex.schema.createTable('ativos_postos', (table) => {
    table.increments('id').primary();
    table.integer('linha_id').unsigned().notNullable()
      .references('id').inTable('linhas').onDelete('RESTRICT');
    table.string('tag_patrimonio', 50).unique().notNullable(); // ex: 'MV3-ROB-04'
    table.string('nome', 120).notNullable(); // ex: 'Robô de Solda a Ponto KUKA 04'
    table.string('posto_trabalho', 50).notNullable(); // ex: 'Posto 40 - Encaixe Lateral'
    table.enum('criticidade', ['A', 'B', 'C']).notNullable().defaultTo('B'); // Criticidade fabril
    table.string('qr_code_token', 64).unique().notNullable(); // Token de identificação rápida
    table.enum('status_operacional', [
      'em_operacao',
      'parado_quebra',
      'alerta_preditivo',
      'em_manutencao'
    ]).notNullable().defaultTo('em_operacao');
    table.boolean('ativo').defaultTo(true);
    table.timestamps(true, true);
  });

  // 4. Tabela: sintomas_falha (Catálogo para abertura rápida em 2 toques)
  await knex.schema.createTable('sintomas_falha', (table) => {
    table.increments('id').primary();
    table.string('descricao', 100).notNullable(); // ex: 'Falha de Alimentação de Peça'
    table.string('categoria', 50).notNullable().defaultTo('geral'); // mecanica, eletrica, pneumatica
    table.boolean('ativo').defaultTo(true);
  });

  // 5. Tabela: chamados_os (Ordens de Serviço com granularidade temporal T0-T3)
  await knex.schema.createTable('chamados_os', (table) => {
    table.increments('id').primary();
    table.string('numero_os', 25).unique().notNullable(); // ex: 'OS-2026-0001'
    table.integer('ativo_id').unsigned().notNullable()
      .references('id').inTable('ativos_postos').onDelete('RESTRICT');
    table.enum('tipo_manutencao', [
      'corretiva_emergencial',
      'corretiva_programada',
      'preventiva',
      'rota_lubrificacao'
    ]).notNullable().defaultTo('corretiva_emergencial');
    table.enum('prioridade', ['baixa', 'media', 'alta', 'critica']).notNullable().defaultTo('alta');
    table.enum('status', [
      'aberto',
      'atribuido',
      'em_deslocamento',
      'em_reparo',
      'pausado_peca',
      'concluido',
      'cancelado_invalido'
    ]).notNullable().defaultTo('aberto');

    // Identificação do operador (Fricção Zero)
    table.string('operador_matricula', 30).notNullable();
    table.string('operador_nome', 120).nullable();
    table.integer('sintoma_id').unsigned().nullable()
      .references('id').inTable('sintomas_falha').onDelete('SET NULL');
    table.text('descricao_sintoma').nullable();

    // Rastreabilidade de atribuição
    table.integer('mantenedor_atribuido_id').unsigned().nullable()
      .references('id').inTable('usuarios').onDelete('SET NULL');
    table.integer('team_leader_id').unsigned().nullable()
      .references('id').inTable('usuarios').onDelete('SET NULL');
    table.boolean('chamado_invalido').defaultTo(false);
    table.string('motivo_invalido', 255).nullable();

    // Os 4 Marcos Temporais de Engenharia (T0 a T3)
    table.timestamp('t0_abertura').notNullable().defaultTo(knex.fn.now());
    table.timestamp('t1_atribuicao').nullable();
    table.timestamp('t2_inicio_reparo').nullable();
    table.timestamp('t3_conclusao_reparo').nullable();

    // Métricas calculadas para performance analítica de MTTR e Confiabilidade
    table.integer('tempo_resposta_minutos').nullable(); // T1 - T0
    table.integer('tempo_deslocamento_minutos').nullable(); // T2 - T1
    table.integer('tempo_reparo_liquido_minutos').nullable(); // (T3 - T2) - Pausas (MTTR Puro)
    table.integer('tempo_downtime_total_minutos').nullable(); // T3 - T0 (Parada total)

    table.timestamps(true, true);
  });

  // 6. Tabela: os_pausas (Pausas sem inflar o MTTR do mantenedor)
  await knex.schema.createTable('os_pausas', (table) => {
    table.increments('id').primary();
    table.integer('chamado_id').unsigned().notNullable()
      .references('id').inTable('chamados_os').onDelete('CASCADE');
    table.enum('motivo', [
      'aguardando_peca',
      'apoio_especialista',
      'troca_turno',
      'seguranca_loto',
      'teste_operacional'
    ]).notNullable();
    table.string('justificativa', 255).nullable();
    table.timestamp('t_inicio_pausa').notNullable().defaultTo(knex.fn.now());
    table.timestamp('t_fim_pausa').nullable();
    table.integer('duracao_minutos').nullable();
    table.integer('registrado_por_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('RESTRICT');
  });

  // 7. Tabela: apontamentos_os (Fechamento técnico com árvore de falhas)
  await knex.schema.createTable('apontamentos_os', (table) => {
    table.increments('id').primary();
    table.integer('chamado_id').unsigned().notNullable()
      .references('id').inTable('chamados_os').onDelete('CASCADE');
    table.integer('mantenedor_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('RESTRICT');
    table.text('causa_raiz').notNullable();
    table.text('acao_executada').notNullable();
    table.string('arvore_falha_sistema', 50).notNullable(); // mecanica, eletrica, pneumatica, automacao
    table.boolean('necessita_revisao_preventiva').defaultTo(false);
    table.text('observacoes_tecnicas').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // 8. Tabela: pecas (Inventário do almoxarifado fabril)
  await knex.schema.createTable('pecas', (table) => {
    table.increments('id').primary();
    table.string('codigo_sap', 50).unique().notNullable(); // Código de almoxarifado
    table.string('descricao', 150).notNullable();
    table.string('categoria', 50).notNullable(); // pneumatica, eletrica, mecanica, fixacao
    table.string('localizacao_almoxarifado', 60).nullable(); // Prateleira / Gaveta
    table.integer('quantidade_estoque').notNullable().defaultTo(0);
    table.integer('quantidade_minima').notNullable().defaultTo(2); // Alerta de reposição
    table.string('unidade_medida', 10).notNullable().defaultTo('UN');
    table.decimal('custo_unitario', 10, 2).defaultTo(0.00);
    table.boolean('ativo').defaultTo(true);
    table.timestamps(true, true);
  });

  // 9. Tabela: pecas_utilizadas_os (Modo Reserva Pendente vs Baixa Efetiva)
  await knex.schema.createTable('pecas_utilizadas_os', (table) => {
    table.increments('id').primary();
    table.integer('chamado_id').unsigned().notNullable()
      .references('id').inTable('chamados_os').onDelete('CASCADE');
    table.integer('peca_id').unsigned().notNullable()
      .references('id').inTable('pecas').onDelete('RESTRICT');
    table.integer('quantidade').notNullable().defaultTo(1);
    table.enum('status_movimentacao', [
      'reserva_pendente',
      'baixado_almoxarifado',
      'devolvido'
    ]).notNullable().defaultTo('reserva_pendente');
    table.integer('solicitado_por_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('RESTRICT');
    table.integer('atendido_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onDelete('SET NULL');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('data_baixa').nullable();
  });
};

/**
 * Rollback das tabelas em ordem inversa de dependência
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('pecas_utilizadas_os');
  await knex.schema.dropTableIfExists('pecas');
  await knex.schema.dropTableIfExists('apontamentos_os');
  await knex.schema.dropTableIfExists('os_pausas');
  await knex.schema.dropTableIfExists('chamados_os');
  await knex.schema.dropTableIfExists('sintomas_falha');
  await knex.schema.dropTableIfExists('ativos_postos');
  await knex.schema.dropTableIfExists('linhas');
  await knex.schema.dropTableIfExists('usuarios');
};
