const { Router } = require('express');
const metricasController = require('../controllers/metricasController');
const { authenticateToken } = require('../middlewares/auth');

const router = Router();

// Dashboard de indicadores de manutenção e confiabilidade (MTBF, MTTR, Disponibilidade, Pareto)
router.get('/metricas/dashboard', authenticateToken, metricasController.getDashboardAnalytics);

module.exports = router;