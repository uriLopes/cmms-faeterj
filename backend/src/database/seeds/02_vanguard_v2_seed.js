const crypto = require('crypto');

function getSeedHmacSecret(gatewayId) {
  if (process.env.IOT_GATEWAY_HMAC_SECRET) {
    return process.env.IOT_GATEWAY_HMAC_SECRET;
  }
  const seedSalt = process.env.IOT_SEED_SALT || 'vanguard-v2-dev-plc-gateway';
  return crypto
    .createHash('sha256')
    .update(`${seedSalt}:${gatewayId}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Seed V2: Taxonomia ISO 14224, Matriz Auto-Dispatch/SLA,
 * BOM Critica de Sobressalentes e Gateway IoT/CLP.
 */
exports.seed = async function (knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  await knex('movimentacoes_estoque').truncate();
  await knex('ativo_bom_pecas').truncate();
  await knex('iso_acoes_corretivas').truncate();
  await knex('iso_causas_raiz').truncate();
  await knex('iso_modos_falha').truncate();
  await knex('iot_sinais_ingestao').truncate();
  await knex('iot_dispositivos').truncate();
  await knex('escalonamento_sla_logs').truncate();
  await knex('regras_despacho_auto').truncate();
  await knex('outbox_eventos_sync').truncate();
  await knex('chamado_adendos').truncate();
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');

  // Consultas dinamicas dos registros base populados por 01_initial_cmms_seed.js
  const usuarios = await knex('usuarios').select('id', 'matricula', 'perfil');
  const findUser = (mat) => usuarios.find((u) => u.matricula === mat);

  const mantenedorMec = findUser('RE-3088') || usuarios.find((u) => u.perfil === 'manutentor');
  const mantenedorEle = findUser('RE-3092') || mantenedorMec;
  const supervisorPcm = findUser('RE-1042') || usuarios.find((u) => u.perfil === 'pcm_gestor');

  const ativos = await knex('ativos_postos').select('id', 'linha_id', 'tag_patrimonio');
  const findAtivo = (tag) => ativos.find((a) => a.tag_patrimonio === tag);

  const ativoMV3 = findAtivo('MV3-ROB-04');
  const ativoHC1 = findAtivo('HC1-APT-02');
  const ativoPNT = findAtivo('PNT-CAB-01');
  const ativoBNC = findAtivo('BNC-CNV-01');

  const pecas = await knex('pecas').select('id', 'codigo_sap');
  const findPeca = (sap) => pecas.find((p) => p.codigo_sap === sap);

  // 1. Taxonomia ISO 14224: Modos de Falha
  const modosData = [
    { codigo_iso: 'MF-MEC-01', subsistema: 'mecanico', nome: 'Travamento ou Gripagem Mecânica', descricao: 'Bloqueio físico de eixo, fuso, rolamento ou garra.' },
    { codigo_iso: 'MF-MEC-02', subsistema: 'mecanico', nome: 'Quebra ou Desalinhamento Estrutural', descricao: 'Fratura, empenamento ou perda de concentricidade.' },
    { codigo_iso: 'MF-MEC-03', subsistema: 'mecanico', nome: 'Vibração ou Ruído Anormal Excessivo', descricao: 'Anomalia dinâmica indicando folga ou fadiga.' },
    { codigo_iso: 'MF-ELE-01', subsistema: 'eletrico', nome: 'Sobrecarga, Curto ou Desarme Elétrico', descricao: 'Atuação de proteção térmica, inversor ou disjuntor.' },
    { codigo_iso: 'MF-ELE-02', subsistema: 'eletrico', nome: 'Falha de Sensor, Encoder ou Sinal CLP', descricao: 'Leitura ausente, intermitente ou fora de faixa.' },
    { codigo_iso: 'MF-ELE-03', subsistema: 'eletrico', nome: 'Perda de Comunicação Fieldbus / Rede', descricao: 'Timeout de comunicação PROFINET, EtherNet/IP ou IHM.' },
    { codigo_iso: 'MF-PNE-01', subsistema: 'pneumatico', nome: 'Perda de Pressão ou Vazamento Pneumático', descricao: 'Queda de pressão na linha ou escape em cilindro.' },
    { codigo_iso: 'MF-PNE-02', subsistema: 'pneumatico', nome: 'Válvula Solenoide ou Atuador Inoperante', descricao: 'Comutação travada ou bobina danificada.' },
    { codigo_iso: 'MF-HID-01', subsistema: 'hidraulico', nome: 'Vazamento ou Queda de Pressão Hidráulica', descricao: 'Ruptura de mangueira, retentor ou perda de vazão.' },
    { codigo_iso: 'MF-HID-02', subsistema: 'hidraulico', nome: 'Superaquecimento de Unidade Hidráulica', descricao: 'Temperatura de fluido acima do limite operacional.' },
    { codigo_iso: 'MF-OPE-01', subsistema: 'operacional', nome: 'Erro de Setup / Receita / Parâmetro', descricao: 'Divergência de programa ou ferramental no posto.' },
    { codigo_iso: 'MF-OPE-02', subsistema: 'operacional', nome: 'Obstrução / Peça Encravada no Dispositivo', descricao: 'Bloqueio no fluxo de alimentação da célula.' }
  ];

  const insertedModoIds = {};
  for (const modo of modosData) {
    const [id] = await knex('iso_modos_falha').insert(modo);
    insertedModoIds[modo.codigo_iso] = id;
  }

  // 2. Taxonomia ISO 14224: Causas Raiz vinculadas aos Modos de Falha
  const causasPorModo = [
    ['MF-MEC-01', 'CR-01', 'Desgaste Prematuro ou Fadiga de Rolamento/Guia', 'Desgaste Natural'],
    ['MF-MEC-01', 'CR-03', 'Lubrificação Deficiente ou Ressecada', 'Lubrificacao'],
    ['MF-MEC-02', 'CR-01', 'Fadiga Estrutural por Ciclo Elevado', 'Desgaste Natural'],
    ['MF-MEC-02', 'CR-02', 'Folga de Fixação / Falta de Torque', 'Montagem/Fixacao'],
    ['MF-MEC-03', 'CR-02', 'Desbalanceamento ou Folga em Acoplamento', 'Montagem/Fixacao'],
    ['MF-MEC-03', 'CR-03', 'Deficiência na Película Lubrificante', 'Lubrificacao'],
    ['MF-ELE-01', 'CR-04', 'Sobrecorrente / Pico de Tensão na Alimentação', 'Eletrica'],
    ['MF-ELE-01', 'CR-05', 'Mau Contato ou Aquecimento em Borne/Contator', 'Eletrica'],
    ['MF-ELE-02', 'CR-06', 'Cabo ou Conector Rompido por Flexão/Atrito', 'Cabeamento'],
    ['MF-ELE-02', 'CR-09', 'Descalibração ou Sujeira na Face Sensora', 'Instrumentacao'],
    ['MF-ELE-03', 'CR-05', 'Conector Industrial Oxidado ou Frouxo', 'Eletrica'],
    ['MF-ELE-03', 'CR-06', 'Blindagem de Cabo Rede Danificada', 'Cabeamento'],
    ['MF-PNE-01', 'CR-07', 'Vedação / O-Ring ou Engate Rápido Danificado', 'Vedacao'],
    ['MF-PNE-01', 'CR-06', 'Mangueira Pneumática Fissurada por Atrito', 'Cabeamento'],
    ['MF-PNE-02', 'CR-08', 'Umidade ou Particulado no Ar (Filtro FRL Saturado)', 'Contaminacao'],
    ['MF-PNE-02', 'CR-05', 'Bobina Solenoide Queimada / Conector Solto', 'Eletrica'],
    ['MF-HID-01', 'CR-07', 'Retentor ou Conexão Hidráulica com Vazamento', 'Vedacao'],
    ['MF-HID-01', 'CR-06', 'Trama de Mangueira Hidráulica Rompida', 'Cabeamento'],
    ['MF-HID-02', 'CR-08', 'Filtro de Retorno Saturado / Trocador Obstruído', 'Contaminacao'],
    ['MF-HID-02', 'CR-03', 'Degradação Térmica ou Baixo Nível de Óleo', 'Lubrificacao'],
    ['MF-OPE-01', 'CR-10', 'Ajuste Incorreto de Receita / Parâmetro LUP', 'Operacional'],
    ['MF-OPE-02', 'CR-10', 'Posicionamento Fora de Tolerância no Berço', 'Operacional']
  ];

  await knex('iso_causas_raiz').insert(
    causasPorModo.map(([modoCod, codigo_iso, nome, categoria]) => ({
      modo_falha_id: insertedModoIds[modoCod],
      codigo_iso,
      nome,
      categoria
    }))
  );

  // 3. Taxonomia ISO 14224: Acoes Corretivas Padronizadas
  await knex('iso_acoes_corretivas').insert([
    { codigo_iso: 'AC-01', nome: 'Substituição de Componente Defeituoso', requer_troca_peca: true, gera_pendencia_preventiva: false },
    { codigo_iso: 'AC-02', nome: 'Limpeza, Desobstrução e Recuperação Local', requer_troca_peca: false, gera_pendencia_preventiva: false },
    { codigo_iso: 'AC-03', nome: 'Reaperto, Alinhamento e Lubrificação Técnica', requer_troca_peca: false, gera_pendencia_preventiva: true },
    { codigo_iso: 'AC-04', nome: 'Reset Lógico, Recalibração e Validação em Ciclo', requer_troca_peca: false, gera_pendencia_preventiva: false },
    { codigo_iso: 'AC-05', nome: 'Troca de Vedação, Cabo ou Mangueira', requer_troca_peca: true, gera_pendencia_preventiva: true },
    { codigo_iso: 'AC-06', nome: 'Reparo Provisório (Agendar Preventiva Programada)', requer_troca_peca: false, gera_pendencia_preventiva: true }
  ]);

  // 4. BOM Critica de Sobressalentes por Ativo (Eixo 6)
  const bomItems = [];
  if (ativoMV3 && findPeca('SAP-109402')) {
    bomItems.push({ ativo_id: ativoMV3.id, peca_id: findPeca('SAP-109402').id, subsistema: 'eletrico', quantidade_instalada: 2, criticidade_reposicao: 'VITAL' });
  }
  if (ativoMV3 && findPeca('SAP-204911')) {
    bomItems.push({ ativo_id: ativoMV3.id, peca_id: findPeca('SAP-204911').id, subsistema: 'pneumatico', quantidade_instalada: 4, criticidade_reposicao: 'ESSENCIAL' });
  }
  if (ativoMV3 && findPeca('SAP-400812')) {
    bomItems.push({ ativo_id: ativoMV3.id, peca_id: findPeca('SAP-400812').id, subsistema: 'eletrico', quantidade_instalada: 1, criticidade_reposicao: 'VITAL' });
  }
  if (ativoHC1 && findPeca('SAP-204911')) {
    bomItems.push({ ativo_id: ativoHC1.id, peca_id: findPeca('SAP-204911').id, subsistema: 'pneumatico', quantidade_instalada: 2, criticidade_reposicao: 'ESSENCIAL' });
  }
  if (ativoPNT && findPeca('SAP-301140')) {
    bomItems.push({ ativo_id: ativoPNT.id, peca_id: findPeca('SAP-301140').id, subsistema: 'mecanico', quantidade_instalada: 2, criticidade_reposicao: 'VITAL' });
  }
  if (ativoBNC && findPeca('SAP-109402')) {
    bomItems.push({ ativo_id: ativoBNC.id, peca_id: findPeca('SAP-109402').id, subsistema: 'eletrico', quantidade_instalada: 3, criticidade_reposicao: 'ESSENCIAL' });
  }
  if (bomItems.length > 0) {
    await knex('ativo_bom_pecas').insert(bomItems);
  }

  // 5. Regras de Despacho Automatico e Escalonamento SLA (Eixo 3)
  if (mantenedorMec && supervisorPcm) {
    const regras = [
      ...(ativoMV3
        ? [
            {
              linha_id: ativoMV3.linha_id,
              subsistema: null,
              criticidade_ativo_minima: 'A',
              exige_linha_parada: true,
              mantenedor_primario_id: mantenedorMec.id,
              mantenedor_backup_id: mantenedorEle ? mantenedorEle.id : mantenedorMec.id,
              supervisor_pcm_id: supervisorPcm.id,
              sla_aceite_minutos: 5,
              sla_escalonamento_nivel2_minutos: 12,
              ativo: true
            }
          ]
        : []),
      {
        linha_id: null,
        subsistema: 'eletrico',
        criticidade_ativo_minima: 'B',
        exige_linha_parada: true,
        mantenedor_primario_id: mantenedorEle ? mantenedorEle.id : mantenedorMec.id,
        mantenedor_backup_id: mantenedorMec.id,
        supervisor_pcm_id: supervisorPcm.id,
        sla_aceite_minutos: 5,
        sla_escalonamento_nivel2_minutos: 15,
        ativo: true
      },
      {
        linha_id: null,
        subsistema: null,
        criticidade_ativo_minima: 'A',
        exige_linha_parada: true,
        mantenedor_primario_id: mantenedorMec.id,
        mantenedor_backup_id: mantenedorEle ? mantenedorEle.id : mantenedorMec.id,
        supervisor_pcm_id: supervisorPcm.id,
        sla_aceite_minutos: 5,
        sla_escalonamento_nivel2_minutos: 12,
        ativo: true
      }
    ];
    await knex('regras_despacho_auto').insert(regras);
  }

  // 6. Gateways Edge / PLC registrados (Eixo 4)
  await knex('iot_dispositivos').insert([
    {
      gateway_id: 'gw-chaparia-mv3-01',
      nome: 'Edge PLC Bridge - Chaparia MV3 & KUKA',
      protocolo: 'MQTT_BRIDGE_REST',
      plant_id: 'plant-faeterj-01',
      hmac_secret: getSeedHmacSecret('gw-chaparia-mv3-01'),
      status_saude: 'ONLINE',
      ultimo_heartbeat: new Date(),
      metadata_json: JSON.stringify({
        broker_topic: 'vanguard/telemetry/plant-faeterj-01/linha-mv3/+/alarm',
        firmware: 'vanguard-edge-2.1.0'
      }),
      ativo: true
    },
    {
      gateway_id: 'gw-pintura-cab-01',
      nome: 'Edge PLC Bridge - Cabine Pintura',
      protocolo: 'OPCUA_REST_BRIDGE',
      plant_id: 'plant-faeterj-01',
      hmac_secret: getSeedHmacSecret('gw-pintura-cab-01'),
      status_saude: 'ONLINE',
      ultimo_heartbeat: new Date(),
      metadata_json: JSON.stringify({
        broker_topic: 'vanguard/telemetry/plant-faeterj-01/pintura/+/alarm',
        firmware: 'vanguard-edge-2.1.0'
      }),
      ativo: true
    }
  ]);
};
