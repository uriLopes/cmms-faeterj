const { Router } = require('express');
const chamadoController = require('../controllers/chamadoController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = Router();

// 1. Abertura de chamado (Pública para o Operador Fricção Zero via QR Code)
router.post('/chamados', chamadoController.criar);

// 2. Listagem geral e consulta por ID
router.get('/chamados', chamadoController.listar);
router.get('/chamados/:id', chamadoController.buscarPorId);

// 3. Atribuição do Mantenedor (T1) - PCM, Team Leader ou o próprio técnico
router.patch(
  '/chamados/:id/atribuir',
  authenticateToken,
  authorizeRoles(['pcm_gestor', 'team_leader', 'manutentor', 'admin']),
  chamadoController.atribuir
);

// 4. Início de Reparo (T2) - Técnico no posto
router.patch(
  '/chamados/:id/iniciar-reparo',
  authenticateToken,
  authorizeRoles(['manutentor', 'admin']),
  chamadoController.iniciarReparo
);

// 5. Gestão de Pausas Operacionais (Aguardando peça, troca de turno, etc.)
router.post(
  '/chamados/:id/pausar',
  authenticateToken,
  authorizeRoles(['manutentor', 'admin']),
  chamadoController.pausar
);

router.patch(
  '/chamados/:id/retomar',
  authenticateToken,
  authorizeRoles(['manutentor', 'admin']),
  chamadoController.retomar
);

// 6. Conclusão Técnica e Liberação da Máquina (T3)
router.post(
  '/chamados/:id/concluir',
  authenticateToken,
  authorizeRoles(['manutentor', 'admin']),
  chamadoController.concluir
);

// 7. Sinalização de Chamado Inválido pelo Team Leader
router.patch(
  '/chamados/:id/sinalizar-invalido',
  authenticateToken,
  authorizeRoles(['team_leader', 'admin']),
  chamadoController.sinalizarInvalido
);

module.exports = router;
