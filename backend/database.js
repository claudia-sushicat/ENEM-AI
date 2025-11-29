const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para o arquivo do banco de dados
const dbPath = path.join(__dirname, 'database.sqlite');

// Criar conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    initDatabase();
  }
});

// Inicializar o banco de dados criando as tabelas necessárias
function initDatabase() {
  db.serialize(() => {
    // Criar tabela de usuários
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela usuarios:', err.message);
      } else {
        console.log('Tabela usuarios criada/verificada com sucesso.');
      }
    });

    // Criar tabela de questões
    db.run(`
      CREATE TABLE IF NOT EXISTS questoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        materia TEXT NOT NULL,
        posicao INTEGER NOT NULL,
        cod_questao TEXT UNIQUE NOT NULL,
        habilidade INTEGER NOT NULL,
        habilidade_id INTEGER,
        lingua TEXT NOT NULL,
        resposta TEXT NOT NULL,
        dificuldade REAL NOT NULL,
        enunciado TEXT NOT NULL,
        alt_a TEXT NOT NULL,
        alt_b TEXT NOT NULL,
        alt_c TEXT NOT NULL,
        alt_d TEXT NOT NULL,
        alt_e TEXT NOT NULL,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (habilidade_id) REFERENCES habilidades (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela questoes:', err.message);
      } else {
        console.log('Tabela questoes criada/verificada com sucesso.');
      }
    });

    // Criar tabela de respostas dos usuários
    db.run(`
      CREATE TABLE IF NOT EXISTS respostas_usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        questao_id INTEGER NOT NULL,
        resposta_escolhida TEXT NOT NULL,
        correta BOOLEAN NOT NULL,
        tempo_resposta INTEGER,
        data_resposta DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
        FOREIGN KEY (questao_id) REFERENCES questoes (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela respostas_usuarios:', err.message);
      } else {
        console.log('Tabela respostas_usuarios criada/verificada com sucesso.');
      }
    });

    // Criar tabela de sessões de estudo
    db.run(`
      CREATE TABLE IF NOT EXISTS sessoes_estudo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        materia TEXT NOT NULL,
        total_questoes INTEGER DEFAULT 0,
        questoes_corretas INTEGER DEFAULT 0,
        questoes_incorretas INTEGER DEFAULT 0,
        tempo_total INTEGER DEFAULT 0,
        data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_fim DATETIME,
        concluida BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela sessoes_estudo:', err.message);
      } else {
        console.log('Tabela sessoes_estudo criada/verificada com sucesso.');
      }
    });

    // Criar tabela de feedback de IA
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback_ia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        questao_id INTEGER NOT NULL,
        resposta_id INTEGER NOT NULL,
        tipo_feedback TEXT NOT NULL,
        conteudo_feedback TEXT NOT NULL,
        nivel_dificuldade_sugerido REAL,
        areas_melhoria TEXT,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
        FOREIGN KEY (questao_id) REFERENCES questoes (id),
        FOREIGN KEY (resposta_id) REFERENCES respostas_usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela feedback_ia:', err.message);
      } else {
        console.log('Tabela feedback_ia criada/verificada com sucesso.');
      }
    });

    // Criar tabela de perfil de aprendizado
    db.run(`
      CREATE TABLE IF NOT EXISTS perfil_aprendizado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        materia TEXT NOT NULL,
        nivel_atual REAL DEFAULT 0.5,
        pontos_fortes TEXT,
        pontos_fracos TEXT,
        estilo_aprendizado TEXT,
        ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela perfil_aprendizado:', err.message);
      } else {
        console.log('Tabela perfil_aprendizado criada/verificada com sucesso.');
      }
    });

    // Criar tabela de competências
    db.run(`
      CREATE TABLE IF NOT EXISTS competencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        materia TEXT NOT NULL,
        numero INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        UNIQUE(materia, numero)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela competencias:', err.message);
      } else {
        console.log('Tabela competencias criada/verificada com sucesso.');
      }
    });

    // Criar tabela de habilidades
    db.run(`
      CREATE TABLE IF NOT EXISTS habilidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competencia_id INTEGER NOT NULL,
        numero INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        FOREIGN KEY (competencia_id) REFERENCES competencias (id),
        UNIQUE(competencia_id, numero)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela habilidades:', err.message);
      } else {
        console.log('Tabela habilidades criada/verificada com sucesso.');
      }
    });

    // Criar tabela de progresso por habilidade
    db.run(`
      CREATE TABLE IF NOT EXISTS progresso_habilidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        habilidade_id INTEGER NOT NULL,
        total_questoes INTEGER DEFAULT 0,
        questoes_corretas INTEGER DEFAULT 0,
        ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
        FOREIGN KEY (habilidade_id) REFERENCES habilidades (id),
        UNIQUE(usuario_id, habilidade_id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela progresso_habilidades:', err.message);
      } else {
        console.log('Tabela progresso_habilidades criada/verificada com sucesso.');
      }
    });

    // Criar tabela de tokens de reset de senha
    db.run(`
      CREATE TABLE IF NOT EXISTS reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela reset_tokens:', err.message);
      } else {
        console.log('Tabela reset_tokens criada/verificada com sucesso.');
      }
    });

    // Criar tabela de recomendações de estudo
    db.run(`
      CREATE TABLE IF NOT EXISTS recomendacoes_estudo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        tipo_recomendacao TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        prioridade INTEGER DEFAULT 1,
        visualizada BOOLEAN DEFAULT FALSE,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela recomendacoes_estudo:', err.message);
      } else {
        console.log('Tabela recomendacoes_estudo criada/verificada com sucesso.');
      }
    });

    // Criar tabela de redações corrigidas
    db.run(`
      CREATE TABLE IF NOT EXISTS redacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        tema TEXT NOT NULL,
        texto TEXT NOT NULL,
        total_palavras INTEGER DEFAULT 0,
        nota_total INTEGER NOT NULL,
        competencias_json TEXT NOT NULL,
        comentarios_gerais TEXT,
        sugestoes_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `, (err) => {
      if (err) {
        console.error('Erro ao criar tabela redacoes:', err.message);
      } else {
        console.log('Tabela redacoes criada/verificada com sucesso.');
      }
    });
  });
}

// Função para fechar a conexão com o banco
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar o banco de dados:', err.message);
    } else {
      console.log('Conexão com o banco de dados fechada.');
    }
  });
}

module.exports = { db, closeDatabase };
