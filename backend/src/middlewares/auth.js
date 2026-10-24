const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cmms_faeterj_dev_secret_2026';

/**
 * Middleware para validar token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({
      erro: 'Acesso negado. Token de autenticação não fornecido.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        erro: 'Token inválido ou expirado. Faça login novamente.'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Middleware de autorização baseada em perfil (RBAC)
 * @param {Array<string>} perfisPermitidos - Lista de perfis autorizados
 */
function authorizeRoles(perfisPermitidos = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ erro: 'Usuário não autenticado.' });
    }

    // Administrador tem acesso irrestrito
    if (req.user.perfil === 'admin') {
      return next();
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({
        erro: `Acesso negado para o perfil '${req.user.perfil}'. Perfis permitidos: ${perfisPermitidos.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
