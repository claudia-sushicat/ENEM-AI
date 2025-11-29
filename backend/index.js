const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const { cadastrarUsuario, fazerLogin, verificarToken, buscarUsuarioPorId } = require('./auth');
const { db } = require('./database');
const aiService = require('./ai-service');
const emailService = require('./email-service');
const config = require('./config');

const client = new OpenAI({
  apiKey: config.openaiApiKey
});

const app = express();
const port = config.port;


// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rota de teste
app.get('/', (req, res) => {
  res.json({ mensagem: 'API do sistema funcionando!' });
});

// Rota de cadastro
app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  
  // Validações básicas
  if (!nome || !email || !senha) {
    return res.status(400).json({ 
      erro: 'Nome, email e senha são obrigatórios' 
    });
  }
  
  if (senha.length < 6) {
    return res.status(400).json({ 
      erro: 'A senha deve ter pelo menos 6 caracteres' 
    });
  }
  
  cadastrarUsuario(nome, email, senha, (err, usuario) => {
    if (err) {
      return res.status(400).json({ erro: err.message });
    }
    
    res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      token: usuario.token
    });
  });
});

// Rota de login
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  
  // Validações básicas
  if (!email || !senha) {
    return res.status(400).json({ 
      erro: 'Email e senha são obrigatórios' 
    });
  }
  
  fazerLogin(email, senha, (err, usuario) => {
    if (err) {
      return res.status(401).json({ erro: err.message });
    }
    
    res.json({
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      token: usuario.token
    });
  });
});

// Rota protegida para obter dados do usuário
app.get('/api/usuario', verificarToken, (req, res) => {
  buscarUsuarioPorId(req.user.id, (err, usuario) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    
    res.json({ usuario });
  });
});

// Rota para verificar se o token é válido
app.get('/api/verificar-token', verificarToken, (req, res) => {
  res.json({ 
    valido: true, 
    usuario: { id: req.user.id, email: req.user.email } 
  });
});

// Rota para obter matérias disponíveis
app.get('/api/materias', (req, res) => {
  const sql = `
    SELECT DISTINCT materia, COUNT(*) as total_questoes 
    FROM questoes 
    GROUP BY materia 
    ORDER BY materia
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar matérias:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ materias: rows });
  });
});

// Rota para obter questões por matéria
app.get('/api/questoes/:materia', verificarToken, (req, res) => {
  const { materia } = req.params;
  const { limit = 10, offset = 0, dificuldade } = req.query;
  
  let sql = `
    SELECT q.id, q.materia, q.posicao, q.cod_questao, q.habilidade, q.lingua, 
           q.dificuldade, q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e,
           h.descricao as habilidade_descricao, c.numero as competencia_numero, c.descricao as competencia_descricao
    FROM questoes q
    LEFT JOIN habilidades h ON q.habilidade_id = h.id
    LEFT JOIN competencias c ON h.competencia_id = c.id
    WHERE q.materia = ?
  `;
  
  const params = [materia];
  
  // Filtrar por dificuldade se especificado
  if (dificuldade) {
    const dificuldadeNum = parseFloat(dificuldade);
    sql += ` AND dificuldade BETWEEN ? AND ?`;
    params.push(dificuldadeNum - 1, dificuldadeNum + 1);
  }
  
  sql += ` ORDER BY RANDOM() LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar questões:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    // Remover a resposta correta das questões enviadas
    const questoesSemResposta = rows.map(questao => {
      const { ...questaoSemResposta } = questao;
      return questaoSemResposta;
    });
    
    res.json({ 
      questoes: questoesSemResposta,
      total: rows.length
    });
  });
});

// Rota para obter uma questão específica
app.get('/api/questao/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT id, materia, posicao, cod_questao, habilidade, lingua, 
           dificuldade, enunciado, alt_a, alt_b, alt_c, alt_d, alt_e
    FROM questoes 
    WHERE id = ?
  `;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error('Erro ao buscar questão:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!row) {
      return res.status(404).json({ erro: 'Questão não encontrada' });
    }
    
    res.json({ questao: row });
  });
});

// Rota para submeter resposta
app.post('/api/resposta', verificarToken, async (req, res) => {
  const { questao_id, resposta_escolhida, tempo_resposta } = req.body;
  
  if (!questao_id || !resposta_escolhida) {
    return res.status(400).json({ 
      erro: 'ID da questão e resposta são obrigatórios' 
    });
  }
  
  // Buscar a questão completa para verificar a resposta correta
  const sqlQuestao = `
    SELECT id, materia, posicao, cod_questao, habilidade, habilidade_id, lingua, 
           dificuldade, enunciado, alt_a, alt_b, alt_c, alt_d, alt_e, resposta
    FROM questoes WHERE id = ?
  `;
  
  db.get(sqlQuestao, [questao_id], async (err, questao) => {
    if (err) {
      console.error('Erro ao buscar questão:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!questao) {
      return res.status(404).json({ erro: 'Questão não encontrada' });
    }
    
    const correta = resposta_escolhida === questao.resposta;
    
    // Salvar resposta do usuário
    const sqlResposta = `
      INSERT INTO respostas_usuarios 
      (usuario_id, questao_id, resposta_escolhida, correta, tempo_resposta)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(sqlResposta, [
      req.user.id,
      questao_id,
      resposta_escolhida,
      correta,
      tempo_resposta || null
    ], async function(err) {
      if (err) {
        console.error('Erro ao salvar resposta:', err.message);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
      }
      
      const respostaId = this.lastID;
      let feedbackIA = null;
      
      // Atualizar progresso por habilidade
      try {
        await aiService.atualizarProgressoHabilidade(
          req.user.id,
          questao.habilidade_id,
          correta
        );
      } catch (error) {
        console.error('Erro ao atualizar progresso por habilidade:', error);
      }

      // Gerar feedback de IA se a resposta estiver incorreta
      if (!correta) {
        try {
          feedbackIA = await aiService.gerarFeedbackResposta(
            req.user.id,
            questao_id,
            respostaId,
            questao,
            resposta_escolhida,
            questao.resposta
          );
        } catch (error) {
          console.error('Erro ao gerar feedback de IA:', error);
        }
      }
      
      res.json({
        correta,
        resposta_correta: questao.resposta,
        mensagem: correta ? 'Resposta correta!' : 'Resposta incorreta.',
        feedback_ia: feedbackIA
      });
    });
  });
});

// Rota para iniciar sessão de estudo
app.post('/api/sessao/iniciar', verificarToken, (req, res) => {
  const { materia } = req.body;
  
  if (!materia) {
    return res.status(400).json({ erro: 'Matéria é obrigatória' });
  }
  
  const sql = `
    INSERT INTO sessoes_estudo (usuario_id, materia)
    VALUES (?, ?)
  `;
  
  db.run(sql, [req.user.id, materia], function(err) {
    if (err) {
      console.error('Erro ao criar sessão:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({
      sessao_id: this.lastID,
      mensagem: 'Sessão de estudo iniciada com sucesso!'
    });
  });
});

// Rota para finalizar sessão de estudo
app.put('/api/sessao/:id/finalizar', verificarToken, (req, res) => {
  const { id } = req.params;
  const { tempo_total } = req.body;
  
  // Calcular estatísticas da sessão - conta apenas questões respondidas durante esta sessão
  const sqlEstatisticas = `
    SELECT 
      COUNT(*) as total_questoes,
      SUM(CASE WHEN correta = 1 THEN 1 ELSE 0 END) as questoes_corretas,
      SUM(CASE WHEN correta = 0 THEN 1 ELSE 0 END) as questoes_incorretas
    FROM respostas_usuarios ru
    JOIN sessoes_estudo se ON ru.usuario_id = se.usuario_id
    WHERE se.id = ? 
      AND ru.usuario_id = ?
      AND ru.data_resposta >= se.data_inicio
      AND ru.data_resposta <= COALESCE(se.data_fim, CURRENT_TIMESTAMP)
  `;
  
  db.get(sqlEstatisticas, [id, req.user.id], (err, stats) => {
    if (err) {
      console.error('Erro ao calcular estatísticas:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    const sql = `
      UPDATE sessoes_estudo 
      SET total_questoes = ?, 
          questoes_corretas = ?, 
          questoes_incorretas = ?,
          tempo_total = ?,
          data_fim = CURRENT_TIMESTAMP,
          concluida = TRUE
      WHERE id = ? AND usuario_id = ?
    `;
    
    db.run(sql, [
      stats.total_questoes || 0,
      stats.questoes_corretas || 0,
      stats.questoes_incorretas || 0,
      tempo_total || 0,
      id,
      req.user.id
    ], function(err) {
      if (err) {
        console.error('Erro ao finalizar sessão:', err.message);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ erro: 'Sessão não encontrada' });
      }
      
      res.json({
        mensagem: 'Sessão finalizada com sucesso!',
        estatisticas: {
          total_questoes: stats.total_questoes || 0,
          questoes_corretas: stats.questoes_corretas || 0,
          questoes_incorretas: stats.questoes_incorretas || 0,
          percentual_acerto: stats.total_questoes > 0 
            ? ((stats.questoes_corretas || 0) / stats.total_questoes * 100).toFixed(1)
            : 0
        }
      });
    });
  });
});

// Rota para obter histórico de sessões
app.get('/api/sessoes', verificarToken, (req, res) => {
  const { limite = 10, offset = 0 } = req.query;
  
  const sql = `
    SELECT id, materia, total_questoes, questoes_corretas, questoes_incorretas,
           tempo_total, data_inicio, data_fim, concluida
    FROM sessoes_estudo 
    WHERE usuario_id = ?
    ORDER BY data_inicio DESC
    LIMIT ? OFFSET ?
  `;
  
  db.all(sql, [req.user.id, parseInt(limite), parseInt(offset)], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar sessões:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    // Calcular percentual de acerto para cada sessão
    const sessoes = rows.map(sessao => ({
      ...sessao,
      percentual_acerto: sessao.total_questoes > 0 
        ? (sessao.questoes_corretas / sessao.total_questoes * 100).toFixed(1)
        : 0
    }));
    
    res.json({ sessoes });
  });
});

// Rota para análise de progresso com IA
app.get('/api/analise-progresso/:materia', verificarToken, async (req, res) => {
  const { materia } = req.params;
  
  try {
    const analise = await aiService.analisarProgresso(req.user.id, materia);
    res.json(analise);
  } catch (error) {
    console.error('Erro ao analisar progresso:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// Rota para obter recomendações de estudo
app.get('/api/recomendacoes', verificarToken, (req, res) => {
  const { limite = 5, visualizadas = false } = req.query;
  
  let sql = `
    SELECT id, tipo_recomendacao, conteudo, prioridade, visualizada, data_criacao
    FROM recomendacoes_estudo 
    WHERE usuario_id = ?
  `;
  
  const params = [req.user.id];
  
  if (visualizadas === 'false') {
    sql += ' AND visualizada = 0';
  }
  
  sql += ' ORDER BY prioridade DESC, data_criacao DESC LIMIT ?';
  params.push(parseInt(limite));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar recomendações:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ recomendacoes: rows });
  });
});

// Rota para marcar recomendação como visualizada
app.put('/api/recomendacoes/:id/visualizar', verificarToken, (req, res) => {
  const { id } = req.params;
  
  const sql = `
    UPDATE recomendacoes_estudo 
    SET visualizada = 1 
    WHERE id = ? AND usuario_id = ?
  `;
  
  db.run(sql, [id, req.user.id], function(err) {
    if (err) {
      console.error('Erro ao marcar recomendação como visualizada:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ erro: 'Recomendação não encontrada' });
    }
    
    res.json({ mensagem: 'Recomendação marcada como visualizada' });
  });
});

// Rota para obter mensagem motivacional
app.get('/api/mensagem-motivacional', verificarToken, async (req, res) => {
  const { contexto = 'geral' } = req.query;
  
  try {
    const mensagem = await aiService.gerarMensagemMotivacional(req.user.id, contexto);
    res.json(mensagem);
  } catch (error) {
    console.error('Erro ao gerar mensagem motivacional:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ==================== REDAÇÃO ENEM ====================

// Rota para gerar temas inéditos de redação
app.get('/api/redacao/temas', verificarToken, async (_req, res) => {
  try {
    const temas = await aiService.gerarTemasRedacao();
    res.json({ temas });
  } catch (error) {
    console.error('Erro ao gerar temas de redação:', error);
    res.status(500).json({ erro: error.message || 'Não foi possível gerar os temas agora.' });
  }
});

// Rota para corrigir redação
app.post('/api/redacao/corrigir', verificarToken, async (req, res) => {
  const { tema, texto } = req.body;

  if (!tema || typeof tema !== 'string' || !tema.trim()) {
    return res.status(400).json({ erro: 'Tema da redação é obrigatório.' });
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return res.status(400).json({ erro: 'O texto da redação é obrigatório.' });
  }

  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  if (palavras < 80) {
    return res.status(400).json({ erro: 'A redação precisa ter pelo menos 80 palavras.' });
  }

  if (palavras > 1200) {
    return res.status(400).json({ erro: 'A redação deve ter no máximo 1200 palavras para correção automática.' });
  }

  try {
    const avaliacao = await aiService.corrigirRedacao(req.user.id, tema.trim(), texto.trim());
    res.json(avaliacao);
  } catch (error) {
    console.error('Erro na correção da redação:', error);
    res.status(500).json({ erro: error.message || 'Não foi possível corrigir a redação no momento.' });
  }
});

// Rota para histórico de correções
app.get('/api/redacao/historico', verificarToken, (req, res) => {
  const limiteParam = parseInt(req.query.limite, 10);
  const limite = Math.max(1, Math.min(Number.isNaN(limiteParam) ? 5 : limiteParam, 20));
  const sql = `
    SELECT 
      id,
      tema,
      nota_total,
      total_palavras,
      comentarios_gerais,
      sugestoes_json,
      competencias_json,
      created_at
    FROM redacoes
    WHERE usuario_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  db.all(sql, [req.user.id, limite], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar histórico de redações:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }

    const historico = rows.map((row) => {
      let competencias = [];
      let sugestoes = [];

      try {
        competencias = row.competencias_json ? JSON.parse(row.competencias_json) : [];
      } catch (parseError) {
        console.error('Erro ao parsear competências da redação:', parseError);
      }

      try {
        sugestoes = row.sugestoes_json ? JSON.parse(row.sugestoes_json) : [];
      } catch (parseError) {
        console.error('Erro ao parsear sugestões da redação:', parseError);
      }

      return {
        id: row.id,
        tema: row.tema,
        nota_total: row.nota_total,
        total_palavras: row.total_palavras,
        comentarios_gerais: row.comentarios_gerais,
        sugestoes,
        competencias,
        created_at: row.created_at
      };
    });

    res.json({ historico });
  });
});

// Rota para obter perfil de aprendizado
app.get('/api/perfil-aprendizado/:materia', verificarToken, (req, res) => {
  const { materia } = req.params;
  
  const sql = `
    SELECT nivel_atual, pontos_fortes, pontos_fracos, estilo_aprendizado, ultima_atualizacao
    FROM perfil_aprendizado 
    WHERE usuario_id = ? AND materia = ?
  `;
  
  db.get(sql, [req.user.id, materia], (err, row) => {
    if (err) {
      console.error('Erro ao buscar perfil de aprendizado:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!row) {
      return res.json({
        nivel_atual: 0.5,
        pontos_fortes: 'Ainda sendo identificados',
        pontos_fracos: 'Ainda sendo identificados',
        estilo_aprendizado: 'adaptativo',
        ultima_atualizacao: null
      });
    }
    
    res.json(row);
  });
});

// Rota para obter competências de uma matéria
app.get('/api/competencias/:materia', (req, res) => {
  const { materia } = req.params;
  
  const sql = `
    SELECT id, numero, descricao
    FROM competencias 
    WHERE materia = ?
    ORDER BY numero
  `;
  
  db.all(sql, [materia], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar competências:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ competencias: rows });
  });
});

// Rota para obter questões por competência específica
app.get('/api/questoes/:materia/competencia/:competenciaId', verificarToken, (req, res) => {
  const { materia, competenciaId } = req.params;
  const { limit = 10, offset = 0, dificuldade } = req.query;
  
  let sql = `
    SELECT q.id, q.materia, q.posicao, q.cod_questao, q.habilidade, q.lingua, 
           q.dificuldade, q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e,
           h.descricao as habilidade_descricao, c.numero as competencia_numero, c.descricao as competencia_descricao
    FROM questoes q
    JOIN habilidades h ON q.habilidade_id = h.id
    JOIN competencias c ON h.competencia_id = c.id
    WHERE q.materia = ? AND c.id = ?
  `;
  
  const params = [materia, competenciaId];
  
  // Filtrar por dificuldade se especificado
  if (dificuldade) {
    const dificuldadeNum = parseFloat(dificuldade);
    sql += ` AND q.dificuldade BETWEEN ? AND ?`;
    params.push(dificuldadeNum - 1, dificuldadeNum + 1);
  }
  
  sql += ` ORDER BY RANDOM() LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar questões por competência:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ 
      questoes: rows,
      total: rows.length
    });
  });
});

// Rota para obter progresso por competências de um usuário
app.get('/api/progresso-competencias/:materia', verificarToken, (req, res) => {
  const { materia } = req.params;
  
  const sql = `
    SELECT 
      c.id,
      c.numero,
      c.descricao,
      COUNT(DISTINCT q.id) as total_questoes_disponiveis,
      COALESCE(SUM(ph.total_questoes), 0) as total_questoes,
      COALESCE(SUM(ph.questoes_corretas), 0) as questoes_corretas,
      CASE 
        WHEN COALESCE(SUM(ph.total_questoes), 0) > 0 
        THEN ROUND((SUM(ph.questoes_corretas) * 100.0 / SUM(ph.total_questoes)), 1)
        ELSE 0 
      END as taxa_acerto
    FROM competencias c
    LEFT JOIN habilidades h ON c.id = h.competencia_id
    LEFT JOIN questoes q ON h.id = q.habilidade_id AND q.materia = ?
    LEFT JOIN progresso_habilidades ph ON h.id = ph.habilidade_id AND ph.usuario_id = ?
    WHERE c.materia = ?
    GROUP BY c.id, c.numero, c.descricao
    ORDER BY c.numero
  `;
  
  db.all(sql, [materia, req.user.id, materia], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar progresso por competências:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ progresso_competencias: rows });
  });
});

// Rota para obter habilidades de uma matéria
app.get('/api/habilidades/:materia', (req, res) => {
  const { materia } = req.params;
  
  const sql = `
    SELECT h.id, h.numero, h.descricao, c.numero as competencia_numero, c.descricao as competencia_descricao
    FROM habilidades h
    JOIN competencias c ON h.competencia_id = c.id
    WHERE c.materia = ?
    ORDER BY h.numero
  `;
  
  db.all(sql, [materia], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar habilidades:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ habilidades: rows });
  });
});

// Rota para obter progresso por habilidades de um usuário
app.get('/api/progresso-habilidades/:materia', verificarToken, (req, res) => {
  const { materia } = req.params;
  
  const sql = `
    SELECT 
      h.id,
      h.numero,
      h.descricao,
      c.numero as competencia_numero,
      c.descricao as competencia_descricao,
      COALESCE(ph.total_questoes, 0) as total_questoes,
      COALESCE(ph.questoes_corretas, 0) as questoes_corretas,
      CASE 
        WHEN COALESCE(ph.total_questoes, 0) > 0 
        THEN ROUND((ph.questoes_corretas * 100.0 / ph.total_questoes), 1)
        ELSE 0 
      END as taxa_acerto
    FROM habilidades h
    JOIN competencias c ON h.competencia_id = c.id
    LEFT JOIN progresso_habilidades ph ON h.id = ph.habilidade_id AND ph.usuario_id = ?
    WHERE c.materia = ?
    ORDER BY h.numero
  `;
  
  db.all(sql, [req.user.id, materia], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar progresso por habilidades:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ progresso_habilidades: rows });
  });
});

// Rota para obter questões por habilidade específica
app.get('/api/questoes/:materia/habilidade/:habilidadeId', verificarToken, (req, res) => {
  const { materia, habilidadeId } = req.params;
  const { limit = 10, offset = 0, dificuldade } = req.query;
  
  let sql = `
    SELECT q.id, q.materia, q.posicao, q.cod_questao, q.habilidade, q.lingua, 
           q.dificuldade, q.enunciado, q.alt_a, q.alt_b, q.alt_c, q.alt_d, q.alt_e,
           h.descricao as habilidade_descricao, c.numero as competencia_numero, c.descricao as competencia_descricao
    FROM questoes q
    JOIN habilidades h ON q.habilidade_id = h.id
    JOIN competencias c ON h.competencia_id = c.id
    WHERE q.materia = ? AND q.habilidade_id = ?
  `;
  
  const params = [materia, habilidadeId];
  
  // Filtrar por dificuldade se especificado
  if (dificuldade) {
    const dificuldadeNum = parseFloat(dificuldade);
    sql += ` AND q.dificuldade BETWEEN ? AND ?`;
    params.push(dificuldadeNum - 1, dificuldadeNum + 1);
  }
  
  sql += ` ORDER BY RANDOM() LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar questões por habilidade:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    res.json({ 
      questoes: rows,
      total: rows.length
    });
  });
});

// ==================== RESET DE SENHA ====================

// Rota para solicitar reset de senha
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ erro: 'Email é obrigatório' });
  }
  
  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ erro: 'Formato de email inválido' });
  }
  
  try {
    // Verificar se o usuário existe
    const sql = 'SELECT id, nome, email FROM usuarios WHERE email = ?';
    db.get(sql, [email], async (err, usuario) => {
      if (err) {
        console.error('Erro ao buscar usuário:', err.message);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
      }
      
      if (!usuario) {
        // Por segurança, retornar sucesso mesmo se o email não existir
        return res.json({ 
          mensagem: 'Se o email existir em nosso sistema, você receberá um link para redefinir sua senha.',
          sucesso: true
        });
      }
      
      // Gerar token único
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora
      
      // Invalidar tokens anteriores do usuário
      db.run('UPDATE reset_tokens SET used = TRUE WHERE usuario_id = ?', [usuario.id], (err) => {
        if (err) {
          console.error('Erro ao invalidar tokens anteriores:', err.message);
        }
      });
      
      // Salvar novo token
      const insertSql = `
        INSERT INTO reset_tokens (usuario_id, token, expires_at) 
        VALUES (?, ?, ?)
      `;
      
      db.run(insertSql, [usuario.id, token, expiresAt.toISOString()], async (err) => {
        if (err) {
          console.error('Erro ao salvar token de reset:', err.message);
          return res.status(500).json({ erro: 'Erro interno do servidor' });
        }
        
        // Enviar email com o token
        const emailResult = await emailService.enviarEmailResetSenha(usuario.email, usuario.nome, token);
        
        if (!emailResult.sucesso) {
          console.error('Erro ao enviar email:', emailResult.erro);
          return res.status(500).json({ 
            erro: 'Erro ao enviar email. Tente novamente mais tarde.',
            sucesso: false
          });
        }
        
        res.json({ 
          mensagem: 'Se o email existir em nosso sistema, você receberá um link para redefinir sua senha.',
          sucesso: true
        });
      });
    });
  } catch (error) {
    console.error('Erro no processo de reset:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// Rota para verificar se o token é válido
app.get('/api/verify-reset-token/:token', (req, res) => {
  const { token } = req.params;
  
  if (!token) {
    return res.status(400).json({ 
      erro: 'Token é obrigatório',
      valido: false 
    });
  }
  
  const sql = `
    SELECT rt.*, u.nome, u.email 
    FROM reset_tokens rt
    JOIN usuarios u ON rt.usuario_id = u.id
    WHERE rt.token = ? AND rt.used = FALSE AND rt.expires_at > datetime('now')
  `;
  
  db.get(sql, [token], (err, row) => {
    if (err) {
      console.error('Erro ao verificar token:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!row) {
      return res.status(400).json({ 
        erro: 'Token inválido ou expirado',
        valido: false 
      });
    }
    
    res.json({ 
      valido: true,
      usuario: {
        nome: row.nome,
        email: row.email
      }
    });
  });
});

// Rota para resetar a senha
app.post('/api/reset-password', (req, res) => {
  const { token, novaSenha, confirmarSenha } = req.body;
  
  if (!token || !novaSenha || !confirmarSenha) {
    return res.status(400).json({ erro: 'Token, nova senha e confirmação são obrigatórios' });
  }
  
  if (novaSenha !== confirmarSenha) {
    return res.status(400).json({ erro: 'As senhas não coincidem' });
  }
  
  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
  }
  
  // Verificar se o token é válido
  const sql = `
    SELECT rt.*, u.id as usuario_id
    FROM reset_tokens rt
    JOIN usuarios u ON rt.usuario_id = u.id
    WHERE rt.token = ? AND rt.used = FALSE AND rt.expires_at > datetime('now')
  `;
  
  db.get(sql, [token], (err, row) => {
    if (err) {
      console.error('Erro ao verificar token:', err.message);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!row) {
      return res.status(400).json({ 
        erro: 'Token inválido ou expirado' 
      });
    }
    
    // Hash da nova senha
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    
    bcrypt.hash(novaSenha, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.error('Erro ao hash da senha:', err.message);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
      }
      
      // Atualizar senha do usuário
      const updateSql = 'UPDATE usuarios SET senha = ? WHERE id = ?';
      db.run(updateSql, [hashedPassword, row.usuario_id], (err) => {
        if (err) {
          console.error('Erro ao atualizar senha:', err.message);
          return res.status(500).json({ erro: 'Erro interno do servidor' });
        }
        
        // Marcar token como usado
        db.run('UPDATE reset_tokens SET used = TRUE WHERE id = ?', [row.id], (err) => {
          if (err) {
            console.error('Erro ao marcar token como usado:', err.message);
          }
        });
        
        res.json({ 
          mensagem: 'Senha redefinida com sucesso!',
          sucesso: true
        });
      });
    });
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  console.log(`API disponível em: http://localhost:${port}`);
});