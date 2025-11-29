const { OpenAI } = require('openai');
const { db } = require('./database');
const config = require('./config');
const { getObjetosPorMateria } = require('./objetos-conhecimento');

// Configuração do cliente OpenAI
const client = new OpenAI({
  apiKey: config.openaiApiKey
});

class AIService {
  
  /**
   * Gera feedback personalizado para uma resposta incorreta
   */
  async gerarFeedbackResposta(usuarioId, questaoId, respostaId, questao, respostaEscolhida, respostaCorreta) {
    try {
      // Buscar histórico do usuário na matéria
      const historico = await this.buscarHistoricoUsuario(usuarioId, questao.materia);
      
      // Buscar informações da habilidade específica
      const habilidadeInfo = await this.buscarHabilidadeInfo(questao.habilidade_id);
      
      // Buscar progresso do usuário na habilidade específica
      const progressoHabilidade = await this.buscarProgressoHabilidade(usuarioId, questao.habilidade_id);
      
      const objetosContexto = this.obterContextoObjetosConhecimento(questao.materia);
      const instrucoes = [
        '1. Forneça um feedback construtivo e motivador',
        '2. Explique por que a resposta está incorreta',
        '3. Explique a resposta correta de forma didática',
        '4. Sugira estratégias de estudo específicas para esta habilidade',
        '5. Mantenha um tom encorajador e positivo',
        '6. Seja específico sobre conceitos que precisam ser revisados',
        '7. Considere o desempenho específico do estudante nesta habilidade'
      ];

      let proximaInstrucao = instrucoes.length + 1;
      const adicionarInstrucao = (texto) => {
        instrucoes.push(`${proximaInstrucao}. ${texto}`);
        proximaInstrucao++;
      };

      if (objetosContexto.possuiObjetos) {
        adicionarInstrucao('Utilize somente os objetos listados acima para preencher "conceitos_revisar", devolvendo cada item no formato "CODIGO - descrição literal".');
      }

      adicionarInstrucao('Diagnostique o motivo do erro do estudante, mencionando trechos do enunciado ou características da alternativa escolhida.');
      adicionarInstrucao('Indique o principal ponto de confusão ou armadilha conceitual que pode ter levado ao erro e como identificá-lo.');
      adicionarInstrucao('Proponha até 3 passos práticos e objetivos para evitar repetir o erro, em linguagem direta.');
      adicionarInstrucao('Limite a resposta a no máximo 200 palavras.');

      const prompt = `
Você é um tutor especializado em preparação para o ENEM. Analise a questão e a resposta do estudante para fornecer um feedback construtivo e personalizado.

CONTEXTO DA QUESTÃO:
Matéria: ${questao.materia}
Habilidade: ${questao.habilidade}
${habilidadeInfo ? `Descrição da Habilidade: ${habilidadeInfo.descricao}` : ''}
Dificuldade: ${questao.dificuldade}
Enunciado: ${questao.enunciado}

ALTERNATIVAS:
A) ${questao.alt_a}
B) ${questao.alt_b}
C) ${questao.alt_c}
D) ${questao.alt_d}
E) ${questao.alt_e}

${objetosContexto.texto}

RESPOSTA DO ESTUDANTE: ${respostaEscolhida}
RESPOSTA CORRETA: ${respostaCorreta}

HISTÓRICO DO ESTUDANTE:
- Total de questões respondidas: ${historico.totalQuestoes}
- Taxa de acerto geral: ${historico.taxaAcerto}%
- Taxa de acerto nesta habilidade: ${progressoHabilidade.taxaAcerto}%
- Questões respondidas nesta habilidade: ${progressoHabilidade.totalQuestoes}
- Pontos fortes: ${historico.pontosFortes || 'Ainda sendo identificados'}
- Áreas de melhoria: ${historico.areasMelhoria || 'Ainda sendo identificadas'}

INSTRUÇÕES:
${instrucoes.join('\n')}

FORMATO DE RESPOSTA:
{
  "feedback": "texto do feedback personalizado",
  "explicacao_correta": "explicação da resposta correta",
  "motivo_erro": "explicação objetiva do que levou ao erro",
  "ponto_confusao": "armadilha conceitual ou trecho que pode confundir",
  "passos_revisao": ["Passo 1", "Passo 2"],
  "conceitos_revisar": ["conceito1", "conceito2"],
  "estrategia_estudo": "sugestão específica de estudo para esta habilidade",
  "nivel_dificuldade_sugerido": 0.5,
  "areas_melhoria": "áreas específicas para focar nesta habilidade"
}
`;

      const response = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: "system",
            content: "Você é um tutor especializado em preparação para o ENEM, focado em fornecer feedback construtivo e personalizado para estudantes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: config.ai.temperature,
        max_tokens: config.ai.maxTokens
      });

      const feedbackData = JSON.parse(response.choices[0].message.content);
      feedbackData.conceitos_revisar = this.normalizarConceitosBNCC(
        feedbackData.conceitos_revisar,
        questao.materia
      );
      feedbackData.passos_revisao = this.normalizarLista(feedbackData.passos_revisao)
        .slice(0, 3);
      feedbackData.motivo_erro = feedbackData.motivo_erro || '';
      feedbackData.ponto_confusao = feedbackData.ponto_confusao || '';
      
      // Salvar feedback no banco
      await this.salvarFeedback(usuarioId, questaoId, respostaId, feedbackData);
      
      return feedbackData;
      
    } catch (error) {
      console.error('Erro ao gerar feedback:', error);
      return {
        feedback: "Ótimo esforço! Continue estudando e você verá melhorias.",
        explicacao_correta: "A resposta correta é " + respostaCorreta + ". Continue praticando!",
        conceitos_revisar: this.normalizarConceitosBNCC([], questao?.materia),
        estrategia_estudo: "Continue praticando questões similares",
        nivel_dificuldade_sugerido: questao.dificuldade,
        areas_melhoria: "Continue praticando",
        motivo_erro: "O enunciado destacava pistas que não foram associadas à alternativa correta; revise como cada alternativa dialoga com o trecho citado.",
        ponto_confusao: "Termos semelhantes presentes nas alternativas podem sugerir uma relação incorreta com o texto-base, gerando escolha precipitada.",
        passos_revisao: this.normalizarLista([
          "Grife no enunciado as pistas que conectam cada alternativa antes de decidir.",
          "Compare a alternativa escolhida com a correta identificando palavras-chave divergentes.",
          "Refaça uma questão parecida explicando em voz alta por que descartou cada opção."
        ])
      };
    }
  }

  /**
   * Analisa o progresso do usuário e gera recomendações
   */
  async analisarProgresso(usuarioId, materia) {
    try {
      const historico = await this.buscarHistoricoUsuario(usuarioId, materia);
      const ultimasSessoes = await this.buscarUltimasSessoes(usuarioId, materia, 5);
      const progressoHabilidades = await this.buscarProgressoHabilidades(usuarioId, materia);
      
      const habilidadesComHistorico = progressoHabilidades
        .filter(habilidade => (habilidade.total_questoes || 0) > 0)
        .map(habilidade => ({
          ...habilidade,
          total_questoes: Number(habilidade.total_questoes || 0),
          questoes_corretas: Number(habilidade.questoes_corretas || 0),
          taxa_acerto: Number(habilidade.taxa_acerto || 0),
          codigo: `H${habilidade.numero}`,
          competencia_codigo: `C${habilidade.competencia_numero}`
        }));

      const competenciasAgrupadas = this.agruparCompetenciasPorHabilidade(habilidadesComHistorico);

      const habilidadesPrioritarias = [...habilidadesComHistorico]
        .filter(h => h.taxa_acerto < 60)
        .sort((a, b) => a.taxa_acerto - b.taxa_acerto)
        .slice(0, 5);

      const habilidadesFortes = [...habilidadesComHistorico]
        .filter(h => h.taxa_acerto >= 80)
        .sort((a, b) => b.taxa_acerto - a.taxa_acerto)
        .slice(0, 5);

      const resumoHabilidadesTexto = habilidadesComHistorico.length
        ? habilidadesComHistorico
            .slice(0, 20)
            .map(h => `- ${h.competencia_codigo}/${h.codigo}: ${h.taxa_acerto}% (${h.questoes_corretas}/${h.total_questoes}) – ${this.truncarTexto(h.descricao, 120)}`)
            .join('\n')
        : '- Nenhuma habilidade da BNCC respondida até agora.';

      const habilidadesPrioritariasTexto = habilidadesPrioritarias.length
        ? habilidadesPrioritarias
            .map(h => `- ${h.competencia_codigo}/${h.codigo}: ${h.taxa_acerto}% (${h.questoes_corretas}/${h.total_questoes}) – ${this.truncarTexto(h.descricao, 120)}`)
            .join('\n')
        : '- Ainda não há habilidades críticas mapeadas.';

      const habilidadesFortesTexto = habilidadesFortes.length
        ? habilidadesFortes
            .map(h => `- ${h.competencia_codigo}/${h.codigo}: ${h.taxa_acerto}% (${h.questoes_corretas}/${h.total_questoes}) – ${this.truncarTexto(h.descricao, 120)}`)
            .join('\n')
        : '- Nenhuma habilidade consolidada foi identificada por enquanto.';

      const competenciasResumoTexto = competenciasAgrupadas.length
        ? competenciasAgrupadas
            .map(c => `- C${c.numero}: ${c.taxaAcerto}% (${c.questoesCorretas}/${c.totalQuestoes}) – ${this.truncarTexto(c.descricao, 140)}`)
            .join('\n')
        : '- Sem competências com respostas registradas nesta matéria.';

      const sessoesTexto = ultimasSessoes.length
        ? ultimasSessoes
            .map(sessao => {
              const dataInicio = sessao.data_inicio
                ? new Date(sessao.data_inicio).toLocaleDateString('pt-BR')
                : 'Sem data';
              const percentual = Number(sessao.percentual_acerto || 0).toFixed(1);
              return `- ${dataInicio}: ${percentual}% de acerto em ${sessao.total_questoes} questões`;
            })
            .join('\n')
        : '- Nenhuma sessão concluída recentemente.';

      const nomeMateria = this.getNomeMateria(materia);

      const prompt = `
Analise o progresso do estudante em ${nomeMateria} (código ${materia}) e gere um plano de estudo alinhado à BNCC.

RESUMO GERAL:
- Total de questões respondidas: ${historico.totalQuestoes}
- Taxa de acerto geral: ${historico.taxaAcerto}%
- Taxa de acerto (últimos 7 dias): ${historico.taxaAcertoRecente}%
- Tempo médio por questão: ${historico.tempoMedio}s

ÚLTIMAS SESSÕES:
${sessoesTexto}

HABILIDADES BNCC COM HISTÓRICO:
${resumoHabilidadesTexto}

HABILIDADES PRIORITÁRIAS:
${habilidadesPrioritariasTexto}

HABILIDADES CONSOLIDADAS:
${habilidadesFortesTexto}

COMPETÊNCIAS RELACIONADAS:
${competenciasResumoTexto}

INSTRUÇÕES:
1. Utilize apenas as competências (C) e habilidades (H) listadas acima; nunca invente códigos.
2. Descreva tendências e lacunas citando explicitamente os códigos BNCC/ENEM.
3. Monte um plano de estudo semanal relacionando cada recomendação às habilidades prioritárias e competências em foco.
4. Sugira um nível de dificuldade ideal entre 0 e 1 coerente com o desempenho observado.
5. Forneça pelo menos 2 recomendações com tipo ("estudo", "pratica" ou "revisao"), prioridade (1-5) e habilidades_foco.
6. Inclua uma mensagem motivacional contextualizada e uma meta semanal verificável.
${habilidadesComHistorico.length === 0 ? '7. Como não há histórico registrado, explique como iniciar os estudos e estabeleça metas iniciais realistas.\n' : ''}
FORMATO DE RESPOSTA:
{
  "analise_progresso": "análise do progresso atual incluindo habilidades",
  "recomendacoes": [
    {
      "tipo": "estudo" | "pratica" | "revisao",
      "conteudo": "descrição da recomendação específica para habilidades",
      "prioridade": 1-5,
      "habilidades_foco": ["H1", "H5"]
    }
  ],
  "nivel_dificuldade_ideal": 0.5,
  "areas_foco": ["área1", "área2"],
  "habilidades_prioritarias": ["H1", "H5", "H10"],
  "mensagem_motivacional": "mensagem de encorajamento",
  "meta_semanal": "meta específica para a semana focada em habilidades"
}
`;

      const response = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: "system",
            content: "Você é um coach educacional especializado em análise de progresso e recomendações de estudo para o ENEM."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: config.ai.temperature,
        max_tokens: 1200
      });

      const analiseData = JSON.parse(response.choices[0].message.content);
      
      // Salvar recomendações no banco
      await this.salvarRecomendacoes(usuarioId, analiseData.recomendacoes);
      
      // Atualizar perfil de aprendizado
      await this.atualizarPerfilAprendizado(usuarioId, materia, analiseData);
      
      return analiseData;
      
    } catch (error) {
      console.error('Erro ao analisar progresso:', error);
      return {
        analise_progresso: "Continue praticando regularmente para melhorar seu desempenho.",
        recomendacoes: [
          {
            tipo: "pratica",
            conteudo: "Continue praticando questões da matéria",
            prioridade: 3
          }
        ],
        nivel_dificuldade_ideal: 0.5,
        areas_foco: [],
        mensagem_motivacional: "Você está no caminho certo! Continue estudando!",
        meta_semanal: "Pratique pelo menos 20 questões esta semana"
      };
    }
  }

  /**
   * Gera mensagem motivacional personalizada
   */
  async gerarMensagemMotivacional(usuarioId, contexto = 'geral') {
    try {
      const perfil = await this.buscarPerfilUsuario(usuarioId);
      const progresso = await this.buscarProgressoGeral(usuarioId);
      
      const prompt = `
Gere uma mensagem motivacional personalizada para um estudante do ENEM.

CONTEXTO: ${contexto}
NOME: ${perfil.nome}
PROGRESSO GERAL: ${progresso.taxaAcertoGeral}% de acerto
TOTAL DE QUESTÕES: ${progresso.totalQuestoes}
ESTRELA: ${progresso.estrelas || 0} estrelas

INSTRUÇÕES:
1. Seja genuinamente motivador e positivo
2. Reconheça o esforço do estudante
3. Use linguagem adequada para ensino médio
4. Inclua dicas práticas se relevante
5. Mantenha o foco no objetivo do ENEM
6. Seja específico sobre conquistas
7. Limite a 100 palavras

FORMATO DE RESPOSTA:
{
  "mensagem": "mensagem motivacional personalizada",
  "tipo": "parabens" | "encorajamento" | "dica" | "meta",
  "icone": "emoji ou símbolo apropriado"
}
`;

      const response = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: "system",
            content: "Você é um coach motivacional especializado em estudantes do ENEM, focado em encorajamento positivo e construtivo."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.error('Erro ao gerar mensagem motivacional:', error);
      return {
        mensagem: "Você está fazendo um excelente trabalho! Continue assim e você alcançará seus objetivos! 🎯",
        tipo: "encorajamento",
        icone: "🌟"
      };
    }
  }

  /**
   * Busca histórico do usuário em uma matéria específica
   */
  async buscarHistoricoUsuario(usuarioId, materia) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_questoes,
          SUM(CASE WHEN correta = 1 THEN 1 ELSE 0 END) as corretas,
          AVG(tempo_resposta) as tempo_medio,
          COUNT(CASE WHEN DATE(data_resposta) >= DATE('now', '-7 days') THEN 1 END) as questoes_recentes,
          SUM(CASE WHEN DATE(data_resposta) >= DATE('now', '-7 days') AND correta = 1 THEN 1 ELSE 0 END) as corretas_recentes
        FROM respostas_usuarios ru
        JOIN questoes q ON ru.questao_id = q.id
        WHERE ru.usuario_id = ? AND q.materia = ?
      `;
      
      db.get(sql, [usuarioId, materia], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const taxaAcerto = row.total_questoes > 0 ? (row.corretas / row.total_questoes * 100).toFixed(1) : 0;
          const taxaAcertoRecente = row.questoes_recentes > 0 ? (row.corretas_recentes / row.questoes_recentes * 100).toFixed(1) : 0;
          
          resolve({
            totalQuestoes: row.total_questoes || 0,
            corretas: row.corretas || 0,
            taxaAcerto: taxaAcerto,
            taxaAcertoRecente: taxaAcertoRecente,
            tempoMedio: Math.round(row.tempo_medio || 0),
            pontosFortes: null, // Será preenchido pelo perfil
            areasMelhoria: null // Será preenchido pelo perfil
          });
        }
      });
    });
  }

  /**
   * Busca as últimas sessões do usuário
   */
  async buscarUltimasSessoes(usuarioId, materia, limite = 5) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          data_inicio,
          total_questoes,
          questoes_corretas,
          questoes_incorretas,
          CASE 
            WHEN total_questoes > 0 THEN (questoes_corretas * 100.0 / total_questoes)
            ELSE 0 
          END as percentual_acerto
        FROM sessoes_estudo
        WHERE usuario_id = ? AND materia = ? AND concluida = 1
        ORDER BY data_inicio DESC
        LIMIT ?
      `;
      
      db.all(sql, [usuarioId, materia, limite], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Salva feedback no banco de dados
   */
  async salvarFeedback(usuarioId, questaoId, respostaId, feedbackData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO feedback_ia 
        (usuario_id, questao_id, resposta_id, tipo_feedback, conteudo_feedback, 
         nivel_dificuldade_sugerido, areas_melhoria)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [
        usuarioId,
        questaoId,
        respostaId,
        'resposta_incorreta',
        feedbackData.feedback,
        feedbackData.nivel_dificuldade_sugerido,
        feedbackData.areas_melhoria
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Salva recomendações no banco de dados
   */
  async salvarRecomendacoes(usuarioId, recomendacoes) {
    for (const rec of recomendacoes) {
      await new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO recomendacoes_estudo 
          (usuario_id, tipo_recomendacao, conteudo, prioridade)
          VALUES (?, ?, ?, ?)
        `;
        
        db.run(sql, [usuarioId, rec.tipo, rec.conteudo, rec.prioridade], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      });
    }
  }

  /**
   * Atualiza perfil de aprendizado
   */
  async atualizarPerfilAprendizado(usuarioId, materia, analiseData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO perfil_aprendizado 
        (usuario_id, materia, nivel_atual, pontos_fortes, pontos_fracos, 
         estilo_aprendizado, ultima_atualizacao)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      db.run(sql, [
        usuarioId,
        materia,
        analiseData.nivel_dificuldade_ideal,
        analiseData.areas_foco.join(', '),
        analiseData.areas_foco.join(', '),
        'adaptativo'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Busca perfil do usuário
   */
  async buscarPerfilUsuario(usuarioId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT nome, email FROM usuarios WHERE id = ?';
      
      db.get(sql, [usuarioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { nome: 'Estudante', email: '' });
        }
      });
    });
  }

  /**
   * Busca progresso geral do usuário
   */
  async buscarProgressoGeral(usuarioId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_questoes,
          SUM(CASE WHEN correta = 1 THEN 1 ELSE 0 END) as corretas
        FROM respostas_usuarios
        WHERE usuario_id = ?
      `;
      
      db.get(sql, [usuarioId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const taxaAcertoGeral = row.total_questoes > 0 ? (row.corretas / row.total_questoes * 100).toFixed(1) : 0;
          
          resolve({
            totalQuestoes: row.total_questoes || 0,
            corretas: row.corretas || 0,
            taxaAcertoGeral: taxaAcertoGeral,
            estrelas: Math.floor(row.corretas / 10) // 1 estrela a cada 10 acertos
          });
        }
      });
    });
  }

  /**
   * Busca informações de uma habilidade específica
   */
  async buscarHabilidadeInfo(habilidadeId) {
    if (!habilidadeId) return null;
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT h.id, h.numero, h.descricao, c.materia, c.numero as competencia_numero, c.descricao as competencia_descricao
        FROM habilidades h
        JOIN competencias c ON h.competencia_id = c.id
        WHERE h.id = ?
      `;
      
      db.get(sql, [habilidadeId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Busca progresso do usuário em uma habilidade específica
   */
  async buscarProgressoHabilidade(usuarioId, habilidadeId) {
    if (!habilidadeId) {
      return { totalQuestoes: 0, questoesCorretas: 0, taxaAcerto: 0 };
    }
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_questoes,
          SUM(CASE WHEN ru.correta = 1 THEN 1 ELSE 0 END) as questoes_corretas
        FROM respostas_usuarios ru
        JOIN questoes q ON ru.questao_id = q.id
        WHERE ru.usuario_id = ? AND q.habilidade_id = ?
      `;
      
      db.get(sql, [usuarioId, habilidadeId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const taxaAcerto = row.total_questoes > 0 ? (row.questoes_corretas / row.total_questoes * 100).toFixed(1) : 0;
          
          resolve({
            totalQuestoes: row.total_questoes || 0,
            questoesCorretas: row.questoes_corretas || 0,
            taxaAcerto: taxaAcerto
          });
        }
      });
    });
  }

  /**
   * Atualiza progresso do usuário em uma habilidade específica
   */
  async atualizarProgressoHabilidade(usuarioId, habilidadeId, correta) {
    if (!habilidadeId) return;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO progresso_habilidades 
        (usuario_id, habilidade_id, total_questoes, questoes_corretas, ultima_atualizacao)
        VALUES (
          ?,
          ?,
          COALESCE((SELECT total_questoes FROM progresso_habilidades WHERE usuario_id = ? AND habilidade_id = ?), 0) + 1,
          COALESCE((SELECT questoes_corretas FROM progresso_habilidades WHERE usuario_id = ? AND habilidade_id = ?), 0) + ?,
          CURRENT_TIMESTAMP
        )
      `;
      
      db.run(sql, [usuarioId, habilidadeId, usuarioId, habilidadeId, usuarioId, habilidadeId, correta ? 1 : 0], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Busca progresso do usuário por habilidades em uma matéria
   */
  async buscarProgressoHabilidades(usuarioId, materia) {
    return new Promise((resolve, reject) => {
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
      
      db.all(sql, [usuarioId, materia], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Gera lista de temas inéditos de redação alinhados às diretrizes do ENEM
   */
  async gerarTemasRedacao() {
    const prompt = `
Você é um professor especialista em linguagem e integrante da Comissão Especializada do INEP responsável por selecionar o tema oficial da redação do ENEM.

Diretrizes obrigatórias:
- Siga rigorosamente a Matriz de Referência do ENEM, o Guia do Participante e os editais oficiais.
- Os temas devem possuir pertinência social, atualidade, alcance nacional e pluralidade regional.
- Todos precisam possibilitar múltiplas perspectivas e exigir proposta de intervenção viável e humanizada.
- Evite temas já utilizados anteriormente (lista recente 2014-2023).
- Sempre inclua pelo menos dois textos de apoio curtos por tema (dados, citações, reportagens ou legislações com fontes).

Formato de resposta em JSON:
{
  "temas": [
    {
      "id": "tema-01",
      "titulo": "Título do tema",
      "descricao": "Explicação objetiva",
      "problematica": "Problema central a ser discutido",
      "diretrizes_intervencao": "Aspectos mínimos da intervenção esperada",
      "textos_apoio": [
        {
          "titulo": "Identificação do texto",
          "tipo": "dado | reportagem | legislação | opinião técnica",
          "conteudo": "Resumo do texto de apoio (máx. 280 caracteres)",
          "fonte": "Fonte ou órgão, ano"
        }
      ]
    }
  ]
}
Gere exatamente 6 temas inéditos.`;

    try {
      const response = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content: 'Você escreve em português do Brasil e somente responde em JSON válido.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.45,
        max_tokens: 4000
      });

      console.log(response.choices[0].message.content);

      const temasData = JSON.parse(response.choices[0].message.content);
      if (!temasData?.temas || !Array.isArray(temasData.temas)) {
        throw new Error('Resposta sem lista de temas');
      }

      return temasData.temas.slice(0, 10).map((tema, index) => ({
        id: tema.id || `tema-${index + 1}`,
        titulo: tema.titulo || tema.nome || `Tema ${index + 1}`,
        descricao: tema.descricao || tema.resumo || '',
        problematica: tema.problematica || tema.problema || '',
        diretrizes_intervencao: tema.diretrizes_intervencao || tema.diretrizes || '',
        textos_apoio: Array.isArray(tema.textos_apoio)
          ? tema.textos_apoio.map((texto, textoIndex) => ({
              titulo: texto.titulo || `Texto de apoio ${textoIndex + 1}`,
              tipo: texto.tipo || 'referencia',
              conteudo: texto.conteudo || '',
              fonte: texto.fonte || texto.origem || ''
            }))
          : []
      }));
    } catch (error) {
      console.error('Erro ao gerar temas de redação:', error);
      throw new Error('Não foi possível gerar os temas de redação no momento.');
    }
  }

  /**
   * Corrige uma redação seguindo as cinco competências do ENEM
   */
  async corrigirRedacao(usuarioId, tema, texto) {
    const totalPalavras = this.contarPalavras(texto);
    const prompt = `
Você é avaliador oficial do ENEM. Utilize o Guia do Participante e as "Regras de Correção" para avaliar a redação informada.

Tema oficial proposto: ${tema}

TEXTO DO PARTICIPANTE:
<<<
${texto}
>>>

Instruções obrigatórias:
1. Avalie detalhadamente cada competência (1 a 5) com nota entre 0 e 200.
2. Cite trechos exatos da redação em cada justificativa.
3. Liste todos os erros relevantes (ortografia, coesão, fuga ao tema, proposta incompleta etc.).
4. Exija proposta de intervenção completa e alinhada aos direitos humanos.
5. Seja preciso, objetivo e coerente com o desempenho apresentado.
6. Calcule a nota final como soma das cinco competências (máximo 1000).
7. As notas de cada competência devem ser múltiplos de 20 (0, 20, 40, ..., 200).

Retorne APENAS o JSON no formato:
{
  "tema": "Tema reafirmado",
  "competencias": [
    {
      "numero": 1,
      "titulo": "Competência 1 – Domínio da norma padrão",
      "nota": 0-200,
      "justificativa": "Texto com referência a trechos",
      "erros": ["lista de erros"],
      "trechos_citados": ["Trecho em aspas"],
      "observacoes": "Recomendação breve"
    }
  ],
  "comentarios_gerais": "Síntese global",
  "sugestoes": ["Sugestão 1", "Sugestão 2"]
}`;

    try {
      const response = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content: 'Você corrige redações do ENEM, responde em português e apenas com JSON válido.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2200
      });

      const avaliacao = JSON.parse(response.choices[0].message.content);
      const competencias = this.normalizarCompetencias(avaliacao?.competencias);
      const sugestoes = this.normalizarLista(avaliacao?.sugestoes);
      const comentariosGerais = avaliacao?.comentarios_gerais || '';
      const notaFinal = competencias.reduce((total, comp) => total + comp.nota, 0);
      const criadoEm = new Date().toISOString();

      const avaliacaoId = await this.salvarCorrecaoRedacao(
        usuarioId,
        avaliacao?.tema || tema,
        texto,
        totalPalavras,
        competencias,
        notaFinal,
        comentariosGerais,
        sugestoes
      );

      return {
        avaliacao_id: avaliacaoId,
        tema: avaliacao?.tema || tema,
        total_palavras: totalPalavras,
        competencias,
        nota_final: notaFinal,
        comentarios_gerais: comentariosGerais,
        sugestoes,
        criado_em: criadoEm
      };
    } catch (error) {
      console.error('Erro ao corrigir redação:', error);
      throw new Error('Não foi possível corrigir a redação no momento.');
    }
  }

  /**
   * Conta palavras de um texto
   */
  contarPalavras(texto) {
    if (!texto) return 0;
    return texto
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  /**
   * Garante que as cinco competências estejam presentes e normalizadas
   */
  normalizarCompetencias(lista = []) {
    const referencias = [
      { numero: 1, titulo: 'Competência 1 – Domínio da norma padrão' },
      { numero: 2, titulo: 'Competência 2 – Compreensão da proposta' },
      { numero: 3, titulo: 'Competência 3 – Seleção e organização de argumentos' },
      { numero: 4, titulo: 'Competência 4 – Coesão e coerência' },
      { numero: 5, titulo: 'Competência 5 – Proposta de intervenção' }
    ];

    return referencias.map((ref, index) => {
      const item =
        lista.find((comp) => comp.numero === ref.numero) ||
        lista[index] ||
        {};

      return {
        numero: ref.numero,
        titulo: item.titulo || ref.titulo,
        nota: this.clampNota(item.nota),
        justificativa: item.justificativa || 'Avaliação não fornecida.',
        erros: this.normalizarLista(item.erros),
        observacoes: item.observacoes || '',
        trechos_citados: this.normalizarLista(item.trechos_citados)
      };
    });
  }

  /**
   * Ajusta lista textual para array de strings
   */
  normalizarLista(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) {
      return valor.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
    }
    if (typeof valor === 'string') {
      return valor
        .split(/[\n;•\-]+/)
        .map((parte) => parte.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Restringe nota entre 0 e 200
   */
  clampNota(valor) {
    const numero = Number(valor);
    if (Number.isNaN(numero)) {
      return 0;
    }
    const limitado = Math.min(200, Math.max(0, Math.round(numero)));
    return Math.round(limitado / 20) * 20;
  }

  /**
   * Persiste a correção da redação
   */
  async salvarCorrecaoRedacao(usuarioId, tema, texto, totalPalavras, competencias, notaFinal, comentariosGerais, sugestoes) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO redacoes (
          usuario_id,
          tema,
          texto,
          total_palavras,
          nota_total,
          competencias_json,
          comentarios_gerais,
          sugestoes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(
        sql,
        [
          usuarioId,
          tema,
          texto,
          totalPalavras,
          notaFinal,
          JSON.stringify(competencias),
          comentariosGerais,
          JSON.stringify(sugestoes)
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  getNomeMateria(codigo) {
    const mapa = {
      LC: 'Linguagens e Códigos',
      MT: 'Matemática',
      CN: 'Ciências da Natureza',
      CH: 'Ciências Humanas'
    };
    return mapa[codigo] || (codigo ? codigo.toUpperCase() : 'Matéria');
  }

  agruparCompetenciasPorHabilidade(habilidades = []) {
    const mapa = new Map();

    habilidades.forEach(habilidade => {
      const codigo = habilidade.competencia_codigo || `C${habilidade.competencia_numero}`;
      if (!mapa.has(codigo)) {
        mapa.set(codigo, {
          codigo,
          numero: habilidade.competencia_numero,
          descricao: habilidade.competencia_descricao,
          totalQuestoes: 0,
          questoesCorretas: 0
        });
      }

      const atual = mapa.get(codigo);
      atual.totalQuestoes += habilidade.total_questoes;
      atual.questoesCorretas += habilidade.questoes_corretas;
    });

    return Array.from(mapa.values())
      .map(item => ({
        ...item,
        taxaAcerto: item.totalQuestoes > 0
          ? Number(((item.questoesCorretas * 100) / item.totalQuestoes).toFixed(1))
          : 0
      }))
      .sort((a, b) => a.numero - b.numero);
  }

  truncarTexto(texto = '', limite = 120) {
    if (!texto) return '';
    if (texto.length <= limite) return texto;
    return `${texto.slice(0, limite).trim()}...`;
  }

  obterContextoObjetosConhecimento(materia) {
    const objetos = getObjetosPorMateria(materia);
    if (!objetos.length) {
      return { texto: '', possuiObjetos: false };
    }

    const nomeMateria = this.getNomeMateria(materia);
    const lista = objetos
      .map((obj) => `- ${obj.codigo}: ${obj.descricao}`)
      .join('\n');

    return {
      texto: `OBJETOS DE CONHECIMENTO (BNCC/ENEM) PARA ${nomeMateria}:
${lista}

>> Use exclusivamente esses itens ao gerar "conceitos_revisar" e devolva-os no formato "CODIGO - descrição literal".`,
      possuiObjetos: true
    };
  }

  normalizarConceitosBNCC(conceitos = [], materia) {
    const objetos = getObjetosPorMateria(materia);
    if (!objetos.length) {
      return Array.isArray(conceitos) ? conceitos : [];
    }

    const mapaCodigo = new Map(
      objetos.map((obj) => [obj.codigo.toUpperCase(), obj])
    );

    const listaNormalizada = (Array.isArray(conceitos) ? conceitos : [])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .map((item) => {
        const [codigoBruto] = item.split('-');
        const codigo = codigoBruto ? codigoBruto.trim().toUpperCase() : '';
        if (codigo && mapaCodigo.has(codigo)) {
          const alvo = mapaCodigo.get(codigo);
          return `${alvo.codigo} - ${alvo.descricao}`;
        }

        const conceitoNormalizado = this.normalizarTexto(item);
        const alvoDescricao = objetos.find((obj) => {
          const descricaoNormalizada = this.normalizarTexto(obj.descricao).slice(0, 80);
          return descricaoNormalizada && conceitoNormalizado.includes(descricaoNormalizada);
        });

        if (alvoDescricao) {
          return `${alvoDescricao.codigo} - ${alvoDescricao.descricao}`;
        }

        return null;
      })
      .filter(Boolean);

    if (listaNormalizada.length) {
      return listaNormalizada;
    }

    return objetos.slice(0, 3).map((obj) => `${obj.codigo} - ${obj.descricao}`);
  }

  normalizarTexto(texto = '') {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}

module.exports = new AIService();
