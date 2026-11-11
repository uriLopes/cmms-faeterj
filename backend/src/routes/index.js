const { Router } = require('express');
const authRoutes = require('./authRoutes');
const ativoRoutes = require('./ativoRoutes');
const chamadoRoutes = require('./chamadoRoutes');
const pecaRoutes = require('./pecaRoutes');
const metricasRoutes = require('./metricasRoutes');
const vanguardV2Routes = require('./vanguardV2Routes');

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/', ativoRoutes);
routes.use('/', chamadoRoutes);
routes.use('/', pecaRoutes);
routes.use('/', metricasRoutes);
routes.use('/v2', vanguardV2Routes);

module.exports = routes;
