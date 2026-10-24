const { Router } = require('express');
const authRoutes = require('./authRoutes');
const ativoRoutes = require('./ativoRoutes');
const chamadoRoutes = require('./chamadoRoutes');
const pecaRoutes = require('./pecaRoutes');
const metricasRoutes = require('./metricasRoutes');

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/', ativoRoutes);
routes.use('/', chamadoRoutes);
routes.use('/', pecaRoutes);
routes.use('/', metricasRoutes);

module.exports = routes;
