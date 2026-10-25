const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cmms_faeterj_dev_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const authController = {
  /**
   * POST /api/auth/login
   * Login corporativo para PCM, Team Leaders, Mantenedores e Almoxarifes
   */
  async login(req, res) {
    try {
      const { matricula, senha } = req.body;

      if (!matricula || !senha) {
        return res.status(400).json({
          erro: 'Matrícula e senha são obrigatórias para login no sistema.'
        });
      }

      const usuario = await db('usuarios')
        .where({ matricula: matricula.trim(), ativo: true })
        .first();

      if (!usuario) {
        return res.status(401).json({
          erro: 'Credenciais inválidas. Verifique a matrícula informada.'
        });
      }

      if (!usuario.senha_hash) {
        return res.status(403).json({
          erro: 'Este perfil (operador) não utiliza login por senha. Acesse via QR Code no posto.'
        });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({
          erro: 'Credenciais inválidas. Senha incorreta.'
        });
      }

      const token = jwt.sign(
        {
          id: usuario.id,
          nome: usuario.nome,
          matricula: usuario.matricula,
          perfil: usuario.perfil
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.status(200).json({
        mensagem: 'Login realizado com sucesso.',
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          matricula: usuario.matricula,
          perfil: usuario.perfil,
          ramal_telefone: usuario.ramal_telefone
        }
      });
    } catch (error) {
      console.error('[Auth] Erro no login:', error);
      return res.status(500).json({ erro: 'Erro interno ao autenticar usuário.' });
    }
  },

  /**
   * POST /api/auth/operador-check ou GET /api/auth/operador/:matricula
   * Identificação ágil e validação de matrícula/Identifiant do operador
   * Retorna os dados cadastrais oficiais para evitar digitação livre de nomes
   */
  async operadorCheck(req, res) {
    try {
      const matricula = req.params.matricula || req.body?.matricula;

      if (!matricula) {
        return res.status(400).json({
          valido: false,
          erro: 'A matrícula/Identifiant do operador é obrigatória.'
        });
      }

      const mat = String(matricula).trim();
      const semPrefixo = mat.replace(/^RE-?/i, '').trim();

      const usuario = await db('usuarios')
        .where({ ativo: true })
        .andWhere(function() {
          this.where('matricula', mat)
            .orWhere('matricula', `RE-${semPrefixo}`)
            .orWhere('matricula', semPrefixo);
        })
        .first();

      if (usuario) {
        return res.status(200).json({
          valido: true,
          cadastrado: true,
          operador: {
            id: usuario.id,
            nome: usuario.nome,
            matricula: usuario.matricula,
            perfil: usuario.perfil
          }
        });
      }

      // Se não estiver previamente cadastrado
      return res.status(404).json({
        valido: false,
        cadastrado: false,
        erro: `Identifiant "${mat}" não cadastrado no sistema fabril. Procure o Team Leader.`
      });
    } catch (error) {
      console.error('[Auth] Erro no check do operador:', error);
      return res.status(500).json({ erro: 'Erro ao validar matrícula do operador.' });
    }
  },

  /**
   * GET /api/auth/me
   * Retorna os dados do usuário autenticado via token
   */
  async me(req, res) {
    try {
      const usuario = await db('usuarios')
        .where({ id: req.user.id, ativo: true })
        .select('id', 'nome', 'matricula', 'perfil', 'ramal_telefone', 'created_at')
        .first();

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado ou inativo.' });
      }

      return res.status(200).json({ usuario });
    } catch (error) {
      console.error('[Auth] Erro ao buscar usuário autenticado:', error);
      return res.status(500).json({ erro: 'Erro ao consultar perfil do usuário.' });
    }
  },

  /**
   * GET /api/usuarios
   * Lista colaboradores (útil para filtro e atribuição de mantenedores)
   */
  async listarUsuarios(req, res) {
    try {
      const { perfil } = req.query;

      const query = db('usuarios')
        .where({ ativo: true })
        .select('id', 'nome', 'matricula', 'perfil', 'ramal_telefone');

      if (perfil) {
        query.where({ perfil });
      }

      const usuarios = await query.orderBy('nome', 'asc');
      return res.status(200).json(usuarios);
    } catch (error) {
      console.error('[Auth] Erro ao listar usuários:', error);
      return res.status(500).json({ erro: 'Erro ao listar colaboradores.' });
    }
  }
};

module.exports = authController;
