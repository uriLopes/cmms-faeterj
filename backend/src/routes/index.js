const { Router } = require('express');
const authRoutes = require('./authRoutes');
const ativoRoutes = require('./ativoRoutes');
const chamadoRoutes = require('./chamadoRoutes');
const pecaRoutes = require('./pecaRoutes');

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/', ativoRoutes);
routes.use('/', chamadoRoutes);
routes.use('/', pecaRoutes);

module.exports = routes;
