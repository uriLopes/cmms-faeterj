const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>CMMS FAETERJ - Relatório Técnico e Documentação Completa do Sistema</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 10pt;
    line-height: 1.5;
  }

  /* Capa */
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    padding: 30px 10px;
    border-left: 6px solid #4f46e5;
    padding-left: 25px;
  }

  .cover-header {
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 15px;
  }

  .cover-header h3 {
    font-size: 11pt;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }

  .cover-header p {
    font-size: 9pt;
    color: #64748b;
  }

  .cover-body {
    margin: auto 0;
  }

  .badge-cover {
    display: inline-block;
    background: #eef2ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
    font-weight: 700;
    font-size: 8.5pt;
    padding: 4px 10px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 15px;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 900;
    line-height: 1.15;
    color: #0f172a;
    margin-bottom: 15px;
  }

  .cover-subtitle {
    font-size: 12pt;
    color: #475569;
    font-weight: 400;
    line-height: 1.4;
    max-width: 90%;
  }

  .cover-footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 15px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    font-size: 9pt;
  }

  .cover-footer strong {
    color: #0f172a;
  }

  /* Estrutura de Seções */
  .section {
    page-break-before: always;
    padding-top: 5px;
  }

  .section:first-of-type {
    page-break-before: auto;
  }

  h1 {
    font-size: 16pt;
    color: #0f172a;
    font-weight: 800;
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 6px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h2 {
    font-size: 12pt;
    color: #1e293b;
    font-weight: 700;
    margin-top: 16px;
    margin-bottom: 8px;
    border-left: 3px solid #6366f1;
    padding-left: 8px;
  }

  h3 {
    font-size: 10.5pt;
    color: #334155;
    font-weight: 700;
    margin-top: 12px;
    margin-bottom: 6px;
  }

  p {
    margin-bottom: 8px;
    text-align: justify;
  }

  /* Tabelas */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px 0;
    font-size: 8.5pt;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 7px 9px;
    border: 1px solid #0f172a;
  }

  td {
    padding: 6px 9px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Caixas de Destaque */
  .callout {
    border-radius: 8px;
    padding: 10px 14px;
    margin: 10px 0 14px 0;
    font-size: 9pt;
  }

  .callout-info {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }

  .callout-formula {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #4f46e5;
    font-family: "Courier New", Courier, monospace;
    font-size: 9pt;
    color: #0f172a;
  }

  .callout-alert {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 7.5pt;
    text-transform: uppercase;
  }

  .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
  .badge-purple { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
  .badge-amber { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
  .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

  /* Grid de Cards */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 10px 0;
  }

  .card {
    border: 1px solid #e2e8f0;
    background: #ffffff;
    border-radius: 8px;
    padding: 10px;
  }

  .card-title {
    font-weight: 700;
    font-size: 9pt;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
  }

  .card-desc {
    font-size: 8pt;
    color: #64748b;
    line-height: 1.35;
  }

  ul, ol {
    margin-left: 18px;
    margin-bottom: 10px;
  }

  li {
    margin-bottom: 4px;
  }

  .footer-note {
    font-size: 7.5pt;
    color: #94a3b8;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    margin-top: 20px;
  }
</style>
</head>
<body>

  <!-- CAPA -->
  <div class="cover">
    <div class="cover-header">
      <h3>Faculdade de Educação Tecnológica do Estado do Rio de Janeiro</h3>
      <p>FAETERJ Barra Mansa • Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas</p>
    </div>

    <div class="cover-body">
      <span class="badge-cover">Documento Técnico • Trabalho de Conclusão de Curso (TCC)</span>
      <h1 class="cover-title">CMMS FAETERJ<br>Sistema de Gestão de Manutenção Fabril</h1>
      <p class="cover-subtitle">
        Arquitetura Full-Stack Orientada a Chão de Fábrica, Resiliência Operacional e Cálculo Matemático de Confiabilidade Industrial (MTTR Líquido Puro, MTBF, Disponibilidade WCM e Curva de Pareto 80/20)
      </p>
    </div>

    <div class="cover-footer">
      <div>
        <p><strong>Autor:</strong> Iury Lopes (Uri)</p>
        <p><strong>Orientação Industrial:</strong> Práticas Stellantis / Paraman</p>
      </div>
      <div>
        <p><strong>Status:</strong> 9 Etapas Concluídas (Homologação E2E 100%)</p>
        <p><strong>Data de Publicação:</strong> Outubro de 2026</p>
      </div>
    </div>
  </div>

  <!-- SEÇÃO 1: RESUMO EXECUTIVO E CONTEXTO -->
  <div class="section">
    <h1>1. Resumo Executivo e Diagnóstico dos Gargalos Industriais</h1>
    
    <p>
      Nas plantas industriais modernas, a parada não planejada de um equipamento gargalo (como robôs de solda em linhas de chaparia ou apertadeiras eletrônicas na montagem) acarreta perdas operacionais severas calculadas em milhares de reais por minuto. O diagnóstico prático realizado em ambiente fabril real identificou <strong>quatro gargalos críticos</strong> nos fluxos legados de manutenção:
    </p>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>1. Comunicação Verbal & Repasse Lento</span>
          <span class="badge badge-red">Crítico</span>
        </div>
        <p class="card-desc">
          O operador precisava parar seu posto, procurar fisicamente o Team Leader, que anotava em quadro branco ou ligava para o PCM. Isso gerava um tempo de fila oculto de 15 a 40 minutos antes que qualquer técnico fosse informado.
        </p>
      </div>

      <div class="card">
        <div class="card-title">
          <span>2. Distorção Matemática do MTTR</span>
          <span class="badge badge-amber">Metrológico</span>
        </div>
        <p class="card-desc">
          Sistemas convencionais capturam apenas a abertura e o fechamento da OS ($T_3 - T_0$), misturando tempo de espera em fila e deslocamento com o reparo efetivo. Isso distorce os índices de eficiência técnica perante auditorias de qualidade.
        </p>
      </div>

      <div class="card">
        <div class="card-title">
          <span>3. Sombra de Sinal (Gaiola de Faraday)</span>
          <span class="badge badge-purple">Conectividade</span>
        </div>
        <p class="card-desc">
          Galpões industriais com telhas metálicas e estruturas pesadas criam áreas sem cobertura de Wi-Fi ou dados móveis. Sistemas que dependiam de conexão síncrona travavam o registro de ordens em campo.
        </p>
      </div>

      <div class="card">
        <div class="card-title">
          <span>4. Desacoplamento de Sobressalentes</span>
          <span class="badge badge-blue">Logística</span>
        </div>
        <p class="card-desc">
          Técnicos precisavam aguardar a liberação burocrática da peça no sistema pelo almoxarifado para iniciar o serviço, inflando artificialmente o tempo de máquina parada.
        </p>
      </div>
    </div>

    <h2>1.1 Objetivos Alcançados pelo Projeto</h2>
    <ul>
      <li><strong>Fricção Zero para o Operador:</strong> Abertura de OS em 2 toques através da leitura de QR Code físico colado no equipamento, dispensando login com senha.</li>
      <li><strong>Barramento em Tempo Real:</strong> Notificação simultânea via WebSockets (Socket.io) para o Cockpit do PCM e tela do Team Leader no instante do reporte.</li>
      <li><strong>Granularidade de 4 Marcos Temporais:</strong> Registro explícito de Abertura ($T_0$), Atribuição ($T_1$), Início do Reparo ($T_2$) e Conclusão ($T_3$).</li>
      <li><strong>Cálculo do MTTR Líquido Puro:</strong> Desconto de pausas operacionais justificadas (espera de peças, LOTO, troca de turno).</li>
      <li><strong>Reserva Pendente de Peças:</strong> Requisição assíncrona que não interrompe a contagem técnica do mantenedor.</li>
      <li><strong>Motor Analítico Confiável:</strong> Geração automatizada de MTBF, Disponibilidade Global ($A$) e Curva de Pareto 80/20.</li>
    </ul>

    <div class="callout callout-info">
      <strong>Metodologia de Engenharia:</strong> O trabalho adota o método <em>Design Science Research (DSR)</em>, focado no rigor formal de modelagem matemática e na validação empírica em cenário de produção industrial.
    </div>
  </div>

  <!-- SEÇÃO 2: MODELO MATEMÁTICO E OS 4 MARCOS TEMPORAIS -->
  <div class="section">
    <h1>2. Modelo Matemático de Engenharia e Marcos Temporais</h1>

    <p>
      O coração do sistema é a separação dos quatro marcos temporais de engenharia, permitindo isolar a eficiência de cada etapa da intervenção de manutenção:
    </p>

    <table>
      <thead>
        <tr>
          <th>Marco</th>
          <th>Denominação</th>
          <th>Ator Responsável</th>
          <th>Significado Operacional</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>$T_0$</strong></td>
          <td>Abertura do Chamado</td>
          <td>Operador no Maquinário</td>
          <td>Registro do instante exato em que a máquina parou. Disparo do alarme visual e sonoro.</td>
        </tr>
        <tr>
          <td><strong>$T_1$</strong></td>
          <td>Atribuição / Aceite</td>
          <td>PCM / Team Leader / Técnico</td>
          <td>Definição do técnico responsável. Encerra o tempo de resposta (fila).</td>
        </tr>
        <tr>
          <td><strong>$T_2$</strong></td>
          <td>Início Efetivo do Reparo</td>
          <td>Mantenedor em Campo</td>
          <td>Técnico chega fisicamente ao posto de trabalho e aciona as ferramentas de diagnóstico.</td>
        </tr>
        <tr>
          <td><strong>$T_3$</strong></td>
          <td>Conclusão e Liberação</td>
          <td>Mantenedor em Campo</td>
          <td>Reparo finalizado, causa raiz classificada e máquina liberada para produção nominal.</td>
        </tr>
      </tbody>
    </table>

    <h2>2.1 Fórmulas Matemáticas Implementadas no Backend</h2>

    <div class="callout callout-formula">
      <strong>1. MTTA - Tempo Médio de Resposta / Atribuição:</strong><br>
      MTTA = &Sigma;(T1 - T0) / N_chamados<br>
      <em>Mede a agilidade do despacho do Team Leader/PCM e a eficiência dos alertas em tempo real.</em>
    </div>

    <div class="callout callout-formula">
      <strong>2. MTTR Líquido Puro (Mean Time To Repair):</strong><br>
      MTTR_liquido = [&Sigma;(T3 - T2) - &Sigma;(Pausas_Justificadas)] / N_falhas<br>
      <em>Isola exclusivamente o tempo técnico com ferramentas na mão, sem punir o mantenedor por esperas externas.</em>
    </div>

    <div class="callout callout-formula">
      <strong>3. MTBF (Mean Time Between Failures):</strong><br>
      MTBF = (Horas_Planejadas_Operacao - Downtime_Total) / N_falhas<br>
      <em>Base fabril: 2 turnos de 8h = 16h/dia de regime nominal por linha de produção.</em>
    </div>

    <div class="callout callout-formula">
      <strong>4. Disponibilidade Operacional Inerente (A):</strong><br>
      A = [MTBF / (MTBF + MTTR_horas)] &times; 100%<br>
      <em>Classificação WCM: &gt; 95% Classe Mundial (Verde) | 90% a 95% Alerta (Âmbar) | &lt; 90% Crítico (Vermelho).</em>
    </div>

    <div class="callout callout-formula">
      <strong>5. Curva de Pareto 80/20 por Subsistema:</strong><br>
      % Acumulado = &Sigma;(Falhas_Subsistema) / Total_Falhas &times; 100%<br>
      <em>Categorias da Árvore de Falhas: Mecânica, Pneumática, Elétrica e Automação/Software.</em>
    </div>
  </div>

  <!-- SEÇÃO 3: ARQUITETURA DO BANCO DE DADOS -->
  <div class="section">
    <h1>3. Modelagem de Dados & Integridade Referencial (MySQL)</h1>

    <p>
      O banco de dados foi estruturado em <strong>9 tabelas relacionais</strong> através de migrations versionadas no Knex.js, garantindo total rastreabilidade, foreign keys com integridade referencial e suporte aos timestamps $T_0$ a $T_3$:
    </p>

    <table>
      <thead>
        <tr>
          <th>Tabela</th>
          <th>Chave Primária</th>
          <th>Chaves Estrangeiras</th>
          <th>Objetivo no Negócio</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>usuarios</code></td>
          <td><code>id</code></td>
          <td>-</td>
          <td>Cadastra os 6 atores (Admin, PCM, Team Leader, Mantenedor, Almoxarife e Operador). Senhas em Bcrypt.</td>
        </tr>
        <tr>
          <td><code>linhas</code></td>
          <td><code>id</code></td>
          <td>-</td>
          <td>Linhas fabris cadastradas (Chaparia MV3, Montagem HC1, Montagem HC2, Pintura, Bancos).</td>
        </tr>
        <tr>
          <td><code>ativos_postos</code></td>
          <td><code>id</code></td>
          <td><code>linha_id &rarr; linhas</code></td>
          <td>Maquinários e postos físicos com TAG patrimonial, criticidade (A/B/C) e hash do QR Code físico.</td>
        </tr>
        <tr>
          <td><code>sintomas_falha</code></td>
          <td><code>id</code></td>
          <td>-</td>
          <td>Sintomas padronizados de fábrica para seleção em 2 toques pelo operador.</td>
        </tr>
        <tr>
          <td><code>chamados_os</code></td>
          <td><code>id</code></td>
          <td><code>ativo_id, mantenedor_id, ...</code></td>
          <td>Tabela mestra da OS: armazena numero_os, status, marcos T0, T1, T2, T3 e métricas de tempo em minutos.</td>
        </tr>
        <tr>
          <td><code>os_pausas</code></td>
          <td><code>id</code></td>
          <td><code>chamado_id &rarr; chamados_os</code></td>
          <td>Registra as pausas operacionais justificadas, congelando o MTTR durante a espera de peças ou LOTO.</td>
        </tr>
        <tr>
          <td><code>apontamentos_os</code></td>
          <td><code>id</code></td>
          <td><code>chamado_id, mantenedor_id</code></td>
          <td>Dossiê técnico de encerramento: árvore de falhas, causa raiz, ação executada e alerta de preventiva.</td>
        </tr>
        <tr>
          <td><code>pecas</code></td>
          <td><code>id</code></td>
          <td>-</td>
          <td>Catálogo de sobressalentes com código SAP, localização física no almoxarifado e saldo mínimo.</td>
        </tr>
        <tr>
          <td><code>pecas_utilizadas_os</code></td>
          <td><code>id</code></td>
          <td><code>chamado_id, peca_id</code></td>
          <td>Gerencia a reserva pendente em campo e registra a baixa física realizada pelo almoxarife.</td>
        </tr>
      </tbody>
    </table>

    <div class="callout callout-info">
      <strong>Garantia de Não-Bloqueio:</strong> As tabelas <code>os_pausas</code> e <code>pecas_utilizadas_os</code> foram criadas de forma desacoplada, permitindo que o técnico requisite itens e suspenda o cronômetro sem travar os registros principais de auditoria.
    </div>
  </div>

  <!-- SEÇÃO 4: OS 19 CASOS DE USO (RASTREABILIDADE) -->
  <div class="section">
    <h1>4. Matriz de Rastreabilidade dos 19 Casos de Uso (UC01 a UC19)</h1>

    <p>
      Todos os casos de uso especificados na proposta acadêmica e aprovados com os profissionais de manutenção da fábrica foram 100% implementados e testados:
    </p>

    <table>
      <thead>
        <tr>
          <th>UC</th>
          <th>Ator</th>
          <th>Descrição Operacional</th>
          <th>Módulo / Endpoint</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>UC01</strong></td>
          <td>Operador</td>
          <td>Leitura de QR Code e Abertura em 2 Toques ($T_0$)</td>
          <td><code>OperadorChamado.jsx</code> &bull; <code>POST /chamados</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC02</strong></td>
          <td>Operador / Sist.</td>
          <td>Prevenção automática de chamados duplicados</td>
          <td><code>chamadoController.js</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC03</strong></td>
          <td>Team Leader</td>
          <td>Monitoramento em tempo real dos postos da sua linha</td>
          <td><code>CockpitPCM.jsx</code> &bull; WS <code>novo_chamado</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC04</strong></td>
          <td>Team Leader</td>
          <td>Sinalização de chamado inválido (não bloqueante)</td>
          <td><code>PATCH /chamados/:id/cancelar-invalido</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC05</strong></td>
          <td>PCM / Gestor</td>
          <td>Cockpit visual com priorização GUT e tickers de downtime</td>
          <td><code>CockpitPCM.jsx</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC06</strong></td>
          <td>PCM / Gestor</td>
          <td>Despacho de técnico e captura do marco $T_1$</td>
          <td><code>PATCH /chamados/:id/atribuir</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC07</strong></td>
          <td>PCM / Gestor</td>
          <td>Repriorização dinâmica e filtros por setor fabril</td>
          <td><code>CockpitPCM.jsx</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC08</strong></td>
          <td>PCM / Gestor</td>
          <td>Alarme sonoro tipo torre industrial Web Audio (880/660 Hz)</td>
          <td><code>soundAlert.js</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC09</strong></td>
          <td>Mantenedor</td>
          <td>Recepção da OS no terminal mobile e auto-atribuição</td>
          <td><code>MantenedorPainel.jsx</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC10</strong></td>
          <td>Mantenedor</td>
          <td>Registro de chegada e início da intervenção ($T_2$)</td>
          <td><code>PATCH /chamados/:id/iniciar-reparo</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC11</strong></td>
          <td>Mantenedor</td>
          <td>Registro de pausas justificadas (congelamento de MTTR)</td>
          <td><code>POST /chamados/:id/pausar</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC12</strong></td>
          <td>Mantenedor</td>
          <td>Requisição de peças em modo reserva pendente</td>
          <td><code>POST /chamados/:id/pecas</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC13</strong></td>
          <td>Mantenedor</td>
          <td>Conclusão ($T_3$), árvore de falhas e liberação do ativo</td>
          <td><code>POST /chamados/:id/concluir</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC14</strong></td>
          <td>Almoxarife</td>
          <td>Visão centralizada de requisições pendentes na fábrica</td>
          <td><code>AlmoxarifadoPainel.jsx</code> &bull; <code>/requisicoes</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC15</strong></td>
          <td>Almoxarife</td>
          <td>Baixa física com decremento e vínculo à OS</td>
          <td><code>PATCH /pecas-os/:id/baixar</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC16</strong></td>
          <td>Almoxarife</td>
          <td>Controle de saldo mínimo e entrada de reposição fiscal</td>
          <td><code>POST /pecas/:id/entrada</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC17</strong></td>
          <td>Sistema</td>
          <td>Barramento de eventos WebSocket Socket.io multi-cliente</td>
          <td><code>socketHandler.js</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC18</strong></td>
          <td>Sistema</td>
          <td>Cálculo em tempo real de MTTR Líquido, MTBF e Disponibilidade</td>
          <td><code>metricasController.js</code> &bull; <code>/dashboard</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
        <tr>
          <td><strong>UC19</strong></td>
          <td>Sistema</td>
          <td>Curva de Pareto 80/20 automatizada e ranking de ofensores</td>
          <td><code>IndicadoresPainel.jsx</code></td>
          <td><span class="badge badge-green">Validado</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SEÇÃO 5: DESIGN SYSTEM E ERGONOMIA COGNITIVA -->
  <div class="section">
    <h1>5. Design System & Ergonomia Cognitiva (Chão de Fábrica)</h1>

    <p>
      Diferente de sistemas de escritório, interfaces industriais exigem conformidade estrita com normas de segurança do trabalho e psicologia de cores sob alta carga de estresse:
    </p>

    <h2>5.1 Normas Técnicas Atendidas</h2>
    <ul>
      <li><strong>ABNT NBR 7195:</strong> Cores para segurança em instalações industriais (Vermelho para parada/emergência, Âmbar para atenção/alerta, Verde para segurança/operação normal).</li>
      <li><strong>ISO 3864:</strong> Símbolos gráficos e sinalização de segurança industrial.</li>
      <li><strong>WCAG AAA:</strong> Contraste mínimo superior a 7:1 para legibilidade sob iluminação industrial de galpões e reflexos de lâmpadas tubulares.</li>
    </ul>

    <h2>5.2 Paleta de Cores e Justificativa Científica</h2>
    <table>
      <thead>
        <tr>
          <th>Cor / Hex</th>
          <th>Significado Operacional</th>
          <th>Justificativa Ergonômica / Fisiológica</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Vermelho</strong><br><code>#EF4444</code></td>
          <td>Máquina Parada / Corretiva Crítica</td>
          <td>Maior comprimento de onda do espectro visível. Ativa a visão periférica de forma imediata sob estresse sem causar <em>alarm fatigue</em>.</td>
        </tr>
        <tr>
          <td><strong>Âmbar</strong><br><code>#F59E0B</code></td>
          <td>Alerta / Em Reparo ($T_2$) / Reserva Pendente</td>
          <td>Excelente visibilidade sob iluminação de vapor de sódio comum em galpões fabris pesados.</td>
        </tr>
        <tr>
          <td><strong>Verde Esmeralda</strong><br><code>#10B981</code></td>
          <td>Operação Nominal / Reparo Concluído ($T_3$)</td>
          <td>Pico de sensibilidade do olho humano (555 nm). O tom esmeralda garante distinção nítida para técnicos com daltonismo.</td>
        </tr>
        <tr>
          <td><strong>Grafite Escuro</strong><br><code>#0F172A</code></td>
          <td>Fundo Padrão (Dark Mode Industrial)</td>
          <td>Reduz a fadiga visual e ofuscamento em ambientes fechados, maximizando o contraste dos dados operacionais.</td>
        </tr>
      </tbody>
    </table>

    <h2>5.3 Torre Sonora Web Audio API</h2>
    <p>
      Para evitar falhas por falta de arquivos MP3 ou restrições de codecs nos navegadores dos tablets de linha, o sistema implementou um gerador nativo via <strong>Web Audio API</strong> com duas frequências alternadas:
    </p>
    <ul>
      <li><strong>880 Hz (A5 - Onda Dente de Serra):</strong> Tom agudo de alarme sonoro penetrante, audível mesmo em meio ao ruído de compressores e prensas.</li>
      <li><strong>660 Hz (E5 - Confirmação de Torre):</strong> Tom secundário que simula a campainha das torres luminosas de máquinas KUKA e Comau.</li>
    </ul>
  </div>

  <!-- SEÇÃO 6: AS 9 ETAPAS CONSTRUÍDAS -->
  <div class="section">
    <h1>6. Detalhamento das 9 Etapas de Desenvolvimento</h1>

    <p>
      O sistema foi executado em <strong>9 etapas estruturadas</strong>, cobrindo o setup da engenharia até a homologação final:
    </p>

    <table>
      <thead>
        <tr>
          <th>Etapa</th>
          <th>Fase</th>
          <th>Entregável Concreto</th>
          <th>Commit Git</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>01</strong></td>
          <td>Setup Monorepo & Ambiente</td>
          <td>Monorepo unificado <code>/backend</code> e <code>/frontend</code>, Tailwind CSS v4, linters e ambiente MySQL local.</td>
          <td><code>e11d2e1</code></td>
        </tr>
        <tr>
          <td><strong>02</strong></td>
          <td>Modelagem & Migrations</td>
          <td>9 tabelas MySQL versionadas via Knex, seed com dados da planta e dicionário de dados na wiki.</td>
          <td><code>c654d59</code></td>
        </tr>
        <tr>
          <td><strong>03</strong></td>
          <td>Backend Core & WebSockets</td>
          <td>API REST Express, JWT, barramento Socket.io multi-dispositivo e 18 testes automatizados.</td>
          <td><code>3003980</code></td>
        </tr>
        <tr>
          <td><strong>04</strong></td>
          <td>Frontend: Operador (PWA)</td>
          <td>Interface PWA mobile com fluxo de 2 toques, leitura de QR Code e resiliência offline contra galpão.</td>
          <td><code>799c159</code></td>
        </tr>
        <tr>
          <td><strong>05</strong></td>
          <td>Cockpit Manutenção & TL</td>
          <td>Painel em tempo real, matriz GUT, tickers progressivos em segundos e alarme sonoro Web Audio.</td>
          <td><code>c836111</code></td>
        </tr>
        <tr>
          <td><strong>06</strong></td>
          <td>Frontend: Mantenedor</td>
          <td>Terminal mobile com cronômetro de reparo $T_2$, gestão de pausas, reserva de peças e conclusão $T_3$.</td>
          <td><code>08aa4a6</code></td>
        </tr>
        <tr>
          <td><strong>07</strong></td>
          <td>Frontend: Almoxarifado</td>
          <td>Painel de sobressalentes com fila de reservas pendentes, baixa física com decremento e entrada fiscal.</td>
          <td><code>89021e2</code></td>
        </tr>
        <tr>
          <td><strong>08</strong></td>
          <td>Motor de Indicadores</td>
          <td>Dashboard analítico com MTBF, MTTR Líquido Puro, Disponibilidade WCM e Curva de Pareto 80/20.</td>
          <td><code>382b056</code></td>
        </tr>
        <tr>
          <td><strong>09</strong></td>
          <td>Validação Real & Docs</td>
          <td>Script de homologação E2E (12 etapas validadas), documentação acadêmica DSR e README completo.</td>
          <td><code>e7af523</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SEÇÃO 7: RESULTADOS DOS TESTES E HOMOLOGAÇÃO E2E -->
  <div class="section">
    <h1>7. Resultados dos Testes Automatizados e Homologação E2E</h1>

    <p>
      O sistema foi submetido a rigorosos testes automatizados cobrindo tanto chamadas isoladas da API REST quanto o fluxo ponta a ponta simulando um turno completo de fábrica:
    </p>

    <h2>7.1 Suíte de Testes Integrados da API (18/18 Passando)</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Caso de Teste Automatizado</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>01</td><td>GET /status &bull; Verificação de integridade e conectividade do banco MySQL</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>02</td><td>POST /api/auth/login &bull; Autenticação de Gestor PCM e geração de Token JWT</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>03</td><td>POST /api/auth/login &bull; Autenticação de Mantenedor com perfil técnico</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>04</td><td>POST /api/auth/login &bull; Autenticação de Almoxarife</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>05</td><td>POST /api/auth/operador-check &bull; Validação de operador sem senha (Fricção Zero)</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>06</td><td>GET /api/ativos/qr/:token &bull; Resolução física do ativo via token QR Code</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>07</td><td>POST /api/chamados &bull; Criação de OS, captura do marco T0 e parada do ativo</td><td><span class="badge badge-green">Passou (201 Created)</span></td></tr>
        <tr><td>08</td><td>PATCH /api/chamados/:id/atribuir &bull; Registro de T1 e cálculo do tempo de resposta</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>09</td><td>PATCH /api/chamados/:id/iniciar-reparo &bull; Registro de T2 e entrada em manutenção</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>10</td><td>POST /api/chamados/:id/pecas &bull; Vínculo de sobressalente em reserva pendente</td><td><span class="badge badge-green">Passou (201 Created)</span></td></tr>
        <tr><td>11</td><td>POST /api/chamados/:id/pausar &bull; Registro de pausa operacional sem penalizar técnico</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>12</td><td>PATCH /api/pecas-os/:id/baixar &bull; Baixa física e decremento do estoque almoxarifado</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>13</td><td>PATCH /api/chamados/:id/retomar &bull; Retomada do serviço e fim da pausa</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>14</td><td>POST /api/chamados/:id/concluir &bull; Registro de T3, liberação do ativo e MTTR Líquido</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>15</td><td>GET /api/chamados/:id &bull; Dossiê completo da OS consolidando marcos e apontamentos</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>16</td><td>GET /api/pecas-os/requisicoes &bull; Fila unificada de sobressalentes da fábrica</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>17</td><td>POST /api/pecas/:id/entrada &bull; Recebimento fiscal e reposição de saldo no estoque</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
        <tr><td>18</td><td>GET /api/metricas/dashboard &bull; Cálculo automatizado de MTBF, MTTR e Pareto</td><td><span class="badge badge-green">Passou (200 OK)</span></td></tr>
      </tbody>
    </table>

    <h2>7.2 Simulação de Turno E2E (12/12 Etapas Validadas)</h2>
    <p>
      O script <code>backend/tests/e2e-scenario.test.js</code> executou o ciclo de vida completo de uma quebra no Robô KUKA KR210 da Linha MV3 (Chaparia), comprovando que todas as integrações funcionam harmonicamente sob eventos em tempo real.
    </p>

    <div class="callout callout-info">
      <strong>Tempo de Compilação do Frontend:</strong> O build de produção do Vite (com 1.980 módulos transformados) compilou com zero erros em apenas <strong>1,91 segundos</strong>.
    </div>
  </div>

  <!-- SEÇÃO 8: GUIA DE OPERAÇÃO E CONCLUSÃO -->
  <div class="section">
    <h1>8. Guia de Operação e Conclusão Acadêmica</h1>

    <h2>8.1 Credenciais de Demonstração (Seed Oficial)</h2>
    <table>
      <thead>
        <tr>
          <th>Ator</th>
          <th>Matrícula (RE)</th>
          <th>Senha Padrão</th>
          <th>Terminal Recomendado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Gestor PCM</strong></td>
          <td><code>RE-1042</code></td>
          <td><code>cmms123</code></td>
          <td>Cockpit de Manutenção (<code>/cockpit</code>) e Métricas (<code>/indicadores</code>)</td>
        </tr>
        <tr>
          <td><strong>Team Leader</strong></td>
          <td><code>RE-2105</code></td>
          <td><code>cmms123</code></td>
          <td>Cockpit de Manutenção &bull; Linha MV3 Chaparia</td>
        </tr>
        <tr>
          <td><strong>Mantenedor</strong></td>
          <td><code>RE-3088</code></td>
          <td><code>cmms123</code></td>
          <td>Terminal Mobile do Mantenedor (<code>/mantenedor</code>)</td>
        </tr>
        <tr>
          <td><strong>Almoxarife</strong></td>
          <td><code>RE-4015</code></td>
          <td><code>cmms123</code></td>
          <td>Painel do Almoxarifado (<code>/almoxarifado</code>)</td>
        </tr>
        <tr>
          <td><strong>Operador</strong></td>
          <td><code>RE-5001</code></td>
          <td><em>Fricção Zero</em></td>
          <td>Terminal Mobile PWA (<code>/abrir-chamado/:token</code>)</td>
        </tr>
        <tr>
          <td><strong>Administrador</strong></td>
          <td><code>RE-0001</code></td>
          <td><code>cmms123</code></td>
          <td>Acesso Irrestrito / Configurações</td>
        </tr>
      </tbody>
    </table>

    <h2>8.2 Conclusão para a Banca Examinadora do TCC</h2>
    <p>
      O sistema CMMS desenvolvido para a FAETERJ Barra Mansa atesta a viabilidade de transformar a rotina caótica do chão de fábrica em uma operação orientada a dados em tempo real. As principais contribuições defendidas na banca são:
    </p>
    <ol>
      <li><strong>Ergonomia Anti-Fadiga:</strong> Redução do tempo de reporte de 20 minutos para menos de 8 segundos através da eliminação de senhas no posto de trabalho.</li>
      <li><strong>Fidelidade aos Indicadores de Confiabilidade:</strong> Fim da distorção do MTTR com o isolamento matemático das pausas e do tempo de resposta.</li>
      <li><strong>Autonomia Técnica & Logística:</strong> Desacoplamento da entrega de sobressalentes sem penalização nos cronômetros dos mantenedores.</li>
      <li><strong>Aderência Tecnológica Moderna:</strong> Arquitetura monorepo com Node.js, Express, MySQL, WebSockets, React e Tailwind CSS v4 com padrão de acessibilidade WCAG AAA.</li>
    </ol>

    <div class="footer-note">
      CMMS FAETERJ &bull; Trabalho de Conclusão de Curso &bull; Autor: Iury Lopes &bull; Orientação: Stellantis / Paraman &bull; FAETERJ Barra Mansa 2026
    </div>
  </div>

</body>
</html>
`;

// Salva o HTML temporário
const tempHtmlPath = path.join(__dirname, 'relatorio-tcc-cmms.html');
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

// Caminhos de saída do PDF
const outputPdfProject = path.join(__dirname, '../../CMMS-FAETERJ-Relatorio-Tecnico-Completo.pdf');
const outputPdfVault = 'C:\\Users\\Iuryl\\Documents\\Segundo Cerebro\\assets\\tcc-cmms-faeterj-relatorio-tecnico-completo.pdf';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Gerando PDF de alta fidelidade com Microsoft Edge headless...');
const cmd = '"' + edgePath + '" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="' + outputPdfProject + '" "file:///' + tempHtmlPath.replace(/\\/g, '/') + '"';

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('PDF gerado no projeto com sucesso:', outputPdfProject);

  // Copia para o Segundo Cérebro (Vault Obsidian)
  fs.copyFileSync(outputPdfProject, outputPdfVault);
  console.log('PDF copiado para o Segundo Cérebro:', outputPdfVault);

  // Remove HTML temporário
  fs.unlinkSync(tempHtmlPath);
  console.log('Processo finalizado com 100% de êxito!');
} catch (err) {
  console.error('Erro ao gerar PDF:', err);
  process.exit(1);
}
