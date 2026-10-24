const { Router } = require('express');
const pecaController = require('../controllers/pecaController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = Router();

// Listagem de peças e saldo (acesso liberado a técnicos, almoxarife e PCM)
router.get('/pecas', authenticateToken, pecaController.listarPecas);

// Fila geral de requisições de peças em campo (para o Almoxarifado)
router.get('/pecas-os/requisicoes', authenticateToken, pecaController.listarRequisicoes);

// Peças de uma OS
router.get('/chamados/:id/pecas', authenticateToken, pecaController.listarPecasPorOS);

// Técnico solicita peça para a OS (Modo Reserva Pendente)
router.post(
  '/chamados/:id/pecas',
  authenticateToken,
  authorizeRoles(['manutentor', 'pcm_gestor', 'admin']),
  pecaController.solicitarPecaOS
);

// Almoxarife confirma baixa física no estoque
router.patch(
  '/pecas-os/:id/baixar',
  authenticateToken,
  authorizeRoles(['almoxarife', 'admin']),
  pecaController.baixarPecaAlmoxarifado
);

// Almoxarife registra entrada de estoque / reposição
router.post(
  '/pecas/:id/entrada',
  authenticateToken,
  authorizeRoles(['almoxarife', 'admin']),
  pecaController.entradaEstoque
);

module.exports = router;
