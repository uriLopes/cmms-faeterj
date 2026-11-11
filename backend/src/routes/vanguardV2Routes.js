const { Router } = require('express');
const iotController = require('../controllers/iotController');
const syncController = require('../controllers/syncController');
const taxonomiaController = require('../controllers/taxonomiaController');
const pecaController = require('../controllers/pecaController');
const slaEscalationService = require('../services/slaEscalationService');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = Router();

// Eixo 1: Sincronizacao Local-First (Field IndexedDB Outbox)
router.post(
  '/sync/events',
  authenticateToken,
  authorizeRoles(['manutentor', 'team_leader', 'pcm_gestor', 'admin']),
  syncController.sincronizarEventos
);

// Eixo 3: Verificacao manual/sob-demanda de Escalonamento SLA (Central / Admin)
router.post(
  '/sla/verificar',
  authenticateToken,
  authorizeRoles(['pcm_gestor', 'team_leader', 'admin']),
  async (req, res) => {
    try {
      const io = req.app.get('io');
      const nowOverride =
        process.env.NODE_ENV !== 'production' && req.body?.now_override
          ? new Date(req.body.now_override)
          : undefined;

      const eventos = await slaEscalationService.verificarEscalonamentosSLA(io, {
        now: nowOverride
      });

      return res.status(200).json({
        verificado_em: (nowOverride || new Date()).toISOString(),
        total_escalonamentos: eventos.length,
        escalonamentos: eventos
      });
    } catch (error) {
      console.error('[SLA Route] Erro ao verificar SLA:', error);
      return res.status(500).json({ erro: 'Erro interno ao verificar escalonamentos SLA.' });
    }
  }
);

// Eixo 4: Ingestao IoT & Edge Gateways (HMAC-SHA256) + Consulta na Central
router.post('/iot/alarms', iotController.ingestAlarm);
router.post('/iot/heartbeat', iotController.heartbeat);
router.get(
  '/iot/dispositivos',
  authenticateToken,
  authorizeRoles(['pcm_gestor', 'team_leader', 'manutentor', 'admin']),
  iotController.listarDispositivosESinais
);

// Eixo 5: Taxonomia Estruturada ISO 14224
router.get('/taxonomia', taxonomiaController.listarCompleta);

// Eixo 6: BOM por Ativo & Baixa Direta Atomica
router.get('/ativos/:id/bom', authenticateToken, pecaController.listarBomPorAtivo);
router.post(
  '/chamados/:id/pecas/baixa-direta',
  authenticateToken,
  authorizeRoles(['manutentor', 'almoxarife', 'pcm_gestor', 'admin']),
  pecaController.registrarBaixaDiretaOS
);

module.exports = router;
