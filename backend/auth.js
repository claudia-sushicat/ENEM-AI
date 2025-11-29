const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('./database');

const JWT_SECRET = 'sua_chave_secreta_jwt_aqui'; 

// Função para cadastrar um novo usuário
function cadastrarUsuario(nome, email, senha, callback) {
  // Verificar se o email já existe
  db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, row) => {
    if (err) {
      return callback(err, null);
    }
    
    if (row) {
      return callback(new Error('Email já cadastrado'), null);
    }
    
    // Criptografar a senha
    bcrypt.hash(senha, 10, (err, hash) => {
      if (err) {
        return callback(err, null);
      }
      
      // Inserir o usuário no banco
      db.run(
        'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
        [nome, email, hash],
        function(err) {
          if (err) {
            return callback(err, null);
          }
          
          // Gerar token JWT
          const token = jwt.sign(
            { id: this.lastID, email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          callback(null, {
            id: this.lastID,
            nome: nome,
            email: email,
            token: token
          });
        }
      );
    });
  });
}

// Função para fazer login
function fazerLogin(email, senha, callback) {
  // Buscar usuário pelo email
  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) {
      return callback(err, null);
    }
    
    if (!user) {
      return callback(new Error('Email ou senha incorretos'), null);
    }
    
    // Verificar a senha
    bcrypt.compare(senha, user.senha, (err, isMatch) => {
      if (err) {
        return callback(err, null);
      }
      
      if (!isMatch) {
        return callback(new Error('Email ou senha incorretos'), null);
      }
      
      // Gerar token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      callback(null, {
        id: user.id,
        nome: user.nome,
        email: user.email,
        token: token
      });
    });
  });
}

// Middleware para verificar token JWT
function verificarToken(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

// Função para buscar usuário por ID
function buscarUsuarioPorId(id, callback) {
  db.get('SELECT id, nome, email, data_criacao FROM usuarios WHERE id = ?', [id], (err, user) => {
    if (err) {
      return callback(err, null);
    }
    callback(null, user);
  });
}

module.exports = {
  cadastrarUsuario,
  fazerLogin,
  verificarToken,
  buscarUsuarioPorId
};
