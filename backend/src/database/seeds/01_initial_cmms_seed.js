const bcrypt = require('bcryptjs');

/**
 * Seed Inicial de Dados Fabris Realistas (Ambiente Polo Automotivo / Paraman / Stellantis)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Desativa verificação de chaves estrangeiras para limpeza rápida
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  await knex('pecas_utilizadas_os').truncate();
  await knex('apontamentos_os').truncate();
  await knex('os_pausas').truncate();
  await knex('chamados_os').truncate();
  await knex('pecas').truncate();
  await knex('sintomas_falha').truncate();
  await knex('ativos_postos').truncate();
  await knex('linhas').truncate();
  await knex('usuarios').truncate();
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');

  const senhaPadraoHash = await bcrypt.hash('cmms123', 8);

  // 1. Inserir Usuários de Teste (Cobre os 6 perfis)
  await knex('usuarios').insert([
    {
      nome: 'Iury Lopes (Admin)',
      matricula: 'RE-0001',
      senha_hash: senhaPadraoHash,
      perfil: 'admin',
      ramal_telefone: '4001'
    },
    {
      nome: 'Carlos Eduardo (Gestor PCM)',
      matricula: 'RE-1042',
      senha_hash: senhaPadraoHash,
      perfil: 'pcm_gestor',
      ramal_telefone: '3201'
    },
    {
      nome: 'Marcos Vinicius (Team Leader Chaparia)',
      matricula: 'RE-2105',
      senha_hash: senhaPadraoHash,
      perfil: 'team_leader',
      ramal_telefone: '2510'
    },
    {
      nome: 'Rodrigo Silva (Mecatrônica)',
      matricula: 'RE-3088',
      senha_hash: senhaPadraoHash,
      perfil: 'manutentor',
      ramal_telefone: '3310'
    },
    {
      nome: 'Felipe Santos (Elétrica/Robótica)',
      matricula: 'RE-3092',
      senha_hash: senhaPadraoHash,
      perfil: 'manutentor',
      ramal_telefone: '3312'
    },
    {
      nome: 'Antônio Ferreira (Almoxarife)',
      matricula: 'RE-4015',
      senha_hash: senhaPadraoHash,
      perfil: 'almoxarife',
      ramal_telefone: '1802'
    },
    {
      nome: 'João Silva (Operador Solda)',
      matricula: 'RE-5001',
      senha_hash: null, // Sem senha: entra pelo QR Code com crachá
      perfil: 'operador'
    },
    {
      nome: 'Jhon Doe',
      matricula: '226244',
      senha_hash: null,
      perfil: 'operador'
    },
    {
      nome: 'Márcio Souza',
      matricula: '228190',
      senha_hash: null,
      perfil: 'operador'
    },
    {
      nome: 'Lucas Andrade',
      matricula: '231045',
      senha_hash: null,
      perfil: 'operador'
    }
  ]);

  // 2. Inserir Linhas de Produção
  const [linhaMV3] = await knex('linhas').insert({ nome: 'Chaparia - Linha MV3', setor: 'chaparia' });
  const [linhaHC1] = await knex('linhas').insert({ nome: 'Montagem Final - Linha HC1', setor: 'montagem' });
  const [linhaHC2] = await knex('linhas').insert({ nome: 'Montagem Final - Linha HC2', setor: 'montagem' });
  const [linhaPintura] = await knex('linhas').insert({ nome: 'Pintura - Cabine Primária', setor: 'pintura' });
  const [linhaBancos] = await knex('linhas').insert({ nome: 'Bancos e Tapeçaria - Linha 1', setor: 'montagem' });

  // 3. Inserir Ativos e Postos com QR Code Hash
  await knex('ativos_postos').insert([
    {
      linha_id: linhaMV3,
      tag_patrimonio: 'MV3-ROB-04',
      nome: 'Robô de Solda a Ponto KUKA KR210',
      posto_trabalho: 'Posto 40 - Geometria Lateral',
      criticidade: 'A',
      qr_code_token: 'qr_mv3_rob_04_token_hash_faeterj_2026',
      status_operacional: 'em_operacao'
    },
    {
      linha_id: linhaHC1,
      tag_patrimonio: 'HC1-APT-02',
      nome: 'Apertadeira Eletrônica Atlas Copco Tensor',
      posto_trabalho: 'Posto 12 - Fixação da Suspensão',
      criticidade: 'B',
      qr_code_token: 'qr_hc1_apt_02_token_hash_faeterj_2026',
      status_operacional: 'em_operacao'
    },
    {
      linha_id: linhaPintura,
      tag_patrimonio: 'PNT-CAB-01',
      nome: 'Atomizador Eletrostático de Tinta Dürr',
      posto_trabalho: 'Cabine de Verniz 01',
      criticidade: 'A',
      qr_code_token: 'qr_pnt_cab_01_token_hash_faeterj_2026',
      status_operacional: 'em_operacao'
    },
    {
      linha_id: linhaBancos,
      tag_patrimonio: 'BNC-CNV-01',
      nome: 'Transportador de Rolos Motorizado Interroll',
      posto_trabalho: 'Linha de Alimentação de Assentos',
      criticidade: 'C',
      qr_code_token: 'qr_bnc_cnv_01_token_hash_faeterj_2026',
      status_operacional: 'em_operacao'
    }
  ]);

  // 4. Inserir Sintomas de Falha (Fluxo 2 toques do operador)
  await knex('sintomas_falha').insert([
    { descricao: 'Falha de Alimentação / Travamento de Peça', categoria: 'mecanica' },
    { descricao: 'Vazamento Pneumático / Perda de Pressão de Ar', categoria: 'pneumatica' },
    { descricao: 'Erro de Comunicação / Sensor Óptico Apagado', categoria: 'eletrica' },
    { descricao: 'Superaquecimento ou Fumaça no Mancal/Motor', categoria: 'mecanica' },
    { descricao: 'Ruído Estranho / Vibração Anormal na Linha', categoria: 'mecanica' },
    { descricao: 'Botoeira de Emergência Bloqueada / LOTO', categoria: 'seguranca' },
    { descricao: 'Aperto Fora da Faixa de Torque (NOK)', categoria: 'qualidade' },
    { descricao: 'Outro Sintoma (Descrever no campo aberto)', categoria: 'geral' }
  ]);

  // 5. Inserir Peças Sobressalentes no Almoxarifado
  await knex('pecas').insert([
    {
      codigo_sap: 'SAP-109402',
      descricao: 'Válvula Solenóide Direcional 5/2 Vias 24V Festo',
      categoria: 'pneumatica',
      localizacao_almoxarifado: 'Rua C - Prateleira 2 - Gaveta 08',
      quantidade_estoque: 8,
      quantidade_minima: 3,
      unidade_medida: 'UN',
      custo_unitario: 380.00
    },
    {
      codigo_sap: 'SAP-204911',
      descricao: 'Sensor de Proximidade Indutivo M12 NPN Balluff',
      categoria: 'eletrica',
      localizacao_almoxarifado: 'Rua A - Prateleira 4 - Gaveta 15',
      quantidade_estoque: 12,
      quantidade_minima: 4,
      unidade_medida: 'UN',
      custo_unitario: 145.50
    },
    {
      codigo_sap: 'SAP-301140',
      descricao: 'Rolamento Fixo de Esferas SKF 6205-2RSH',
      categoria: 'mecanica',
      localizacao_almoxarifado: 'Rua D - Prateleira 1 - Gaveta 03',
      quantidade_estoque: 6,
      quantidade_minima: 2,
      unidade_medida: 'UN',
      custo_unitario: 89.90
    },
    {
      codigo_sap: 'SAP-400812',
      descricao: 'Mangueira de Poliuretano Azul 8mm (Rolo 50m)',
      categoria: 'pneumatica',
      localizacao_almoxarifado: 'Rua C - Prateleira 5 - Carretel 02',
      quantidade_estoque: 1, // Estoque crítico (abaixo do mínimo!)
      quantidade_minima: 2,
      unidade_medida: 'RL',
      custo_unitario: 210.00
    }
  ]);
};
