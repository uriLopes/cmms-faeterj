const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

const router = Router();

// Rota pública de login corporativo
router.post('/login', authController.login);

// Rota pública para validação de matrícula do operador (Fricção Zero)
router.post('/operador-check', authController.operadorCheck);
router.get('/operador/:matricula', authController.operadorCheck);

// Rota autenticada do usuário corrente
router.get('/me', authenticateToken, authController.me);

// Rota autenticada para listagem de colaboradores (para atribuição)
router.get('/usuarios', authenticateToken, authController.listarUsuarios);

module.exports = router;
