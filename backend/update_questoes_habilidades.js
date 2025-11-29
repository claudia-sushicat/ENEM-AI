const { db } = require('./database');

class QuestoesHabilidadesUpdater {
  constructor() {
    this.habilidadesMap = new Map();
  }

  async atualizar() {
    console.log('Iniciando atualização das questões com referências às habilidades...');
    
    try {
      // Carregar mapeamento de habilidades
      await this.carregarHabilidades();
      
      // Atualizar questões
      await this.atualizarQuestoes();
      
      console.log('Atualização das questões concluída com sucesso!');
      
    } catch (error) {
      console.error('Erro durante a atualização:', error);
      throw error;
    }
  }

  async carregarHabilidades() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT h.id, h.numero, c.materia 
        FROM habilidades h
        JOIN competencias c ON h.competencia_id = c.id
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Criar mapa: materia-numero -> habilidade_id
        rows.forEach(row => {
          const chave = `${row.materia}-${row.numero}`;
          this.habilidadesMap.set(chave, row.id);
        });
        
        console.log(`Carregadas ${rows.length} habilidades`);
        resolve();
      });
    });
  }

  async atualizarQuestoes() {
    return new Promise((resolve, reject) => {
      // Buscar todas as questões que não têm habilidade_id
      const sqlSelect = `
        SELECT id, materia, habilidade 
        FROM questoes 
        WHERE habilidade_id IS NULL
      `;
      
      db.all(sqlSelect, [], (err, questoes) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (questoes.length === 0) {
          console.log('Nenhuma questão precisa ser atualizada');
          resolve();
          return;
        }
        
        console.log(`Atualizando ${questoes.length} questões...`);
        
        let atualizadas = 0;
        let naoEncontradas = 0;
        
        const sqlUpdate = 'UPDATE questoes SET habilidade_id = ? WHERE id = ?';
        
        questoes.forEach(questao => {
          const chave = `${questao.materia}-${questao.habilidade}`;
          const habilidadeId = this.habilidadesMap.get(chave);
          
          if (habilidadeId) {
            db.run(sqlUpdate, [habilidadeId, questao.id], (err) => {
              if (err) {
                console.error(`Erro ao atualizar questão ${questao.id}:`, err);
              } else {
                atualizadas++;
              }
              
              if (atualizadas + naoEncontradas === questoes.length) {
                console.log(`Atualizadas: ${atualizadas}, Não encontradas: ${naoEncontradas}`);
                resolve();
              }
            });
          } else {
            naoEncontradas++;
            console.warn(`Habilidade não encontrada para questão ${questao.id}: ${chave}`);
            
            if (atualizadas + naoEncontradas === questoes.length) {
              console.log(`Atualizadas: ${atualizadas}, Não encontradas: ${naoEncontradas}`);
              resolve();
            }
          }
        });
      });
    });
  }

  // Método para obter estatísticas da atualização
  async obterEstatisticas() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          materia,
          COUNT(*) as total_questoes,
          COUNT(habilidade_id) as questoes_com_habilidade,
          COUNT(*) - COUNT(habilidade_id) as questoes_sem_habilidade
        FROM questoes 
        GROUP BY materia
        ORDER BY materia
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

// Executar atualização se o script for chamado diretamente
if (require.main === module) {
  const updater = new QuestoesHabilidadesUpdater();
  
  updater.atualizar()
    .then(async () => {
      const stats = await updater.obterEstatisticas();
      console.log('\nEstatísticas da atualização:');
      stats.forEach(stat => {
        console.log(`${stat.materia}: ${stat.questoes_com_habilidade}/${stat.total_questoes} questões com habilidade`);
      });
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na atualização:', error);
      process.exit(1);
    });
}

module.exports = QuestoesHabilidadesUpdater;
