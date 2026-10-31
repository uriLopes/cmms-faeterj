const { Router } = require('express');
const ativoController = require('../controllers/ativoController');

const router = Router();

// Consulta pública/aberta para o fluxo de 2 toques do operador no QR Code
router.get('/ativos/qr/:token', ativoController.buscarPorQrCode);
router.get('/sintomas', ativoController.listarSintomas);
router.post('/sintomas', ativoController.criarSintoma);
router.get('/linhas', ativoController.listarLinhas);
router.get('/ativos', ativoController.listarAtivos);
router.post('/ativos', ativoController.criarAtivo);
router.get('/ativos/:id/prontuario', ativoController.buscarProntuario);

module.exports = router;
