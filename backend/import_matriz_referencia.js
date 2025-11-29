const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('./database');
const path = require('path');

class MatrizReferenciaImporter {
  constructor() {
    this.competencias = new Map();
    this.habilidades = [];
  }

  async importar() {
    console.log('Iniciando importação da matriz de referência...');
    
    try {
      // Limpar dados existentes
      await this.limparDados();
      
      // Ler e processar o arquivo CSV
      await this.processarArquivo();
      
      // Inserir competências no banco
      await this.inserirCompetencias();
      
      // Inserir habilidades no banco
      await this.inserirHabilidades();
      
      console.log('Importação da matriz de referência concluída com sucesso!');
      
    } catch (error) {
      console.error('Erro durante a importação:', error);
      throw error;
    }
  }

  async limparDados() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Verificar se as tabelas existem antes de tentar limpar
        db.run('DELETE FROM progresso_habilidades WHERE 1=1', (err) => {
          // Ignorar erro se a tabela não existir
        });
        
        db.run('DELETE FROM habilidades WHERE 1=1', (err) => {
          // Ignorar erro se a tabela não existir
        });
        
        db.run('DELETE FROM competencias WHERE 1=1', (err) => {
          // Ignorar erro se a tabela não existir
          resolve();
        });
      });
    });
  }

  async processarArquivo() {
    return new Promise((resolve, reject) => {
      const csvPath = path.join(__dirname, 'matriz_referencia.csv');
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          this.processarLinha(row);
        })
        .on('end', () => {
          console.log(`Processadas ${this.habilidades.length} habilidades de ${this.competencias.size} competências`);
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  processarLinha(row) {
    const { MATERIA, COMPETENCIA, DESCRICAO_COMPETENCIA, HABILIDADE, DESCRICAO_HABILIDADE } = row;
    
    if (!MATERIA || !COMPETENCIA || !HABILIDADE) return;
    
    const chaveCompetencia = `${MATERIA}-${COMPETENCIA}`;
    
    // Armazenar competência se não existir
    if (!this.competencias.has(chaveCompetencia)) {
      this.competencias.set(chaveCompetencia, {
        materia: MATERIA,
        numero: parseInt(COMPETENCIA),
        descricao: DESCRICAO_COMPETENCIA
      });
    }
    
    // Armazenar habilidade
    this.habilidades.push({
      competenciaChave: chaveCompetencia,
      numero: parseInt(HABILIDADE),
      descricao: DESCRICAO_HABILIDADE
    });
  }

  async inserirCompetencias() {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO competencias (materia, numero, descricao) VALUES (?, ?, ?)';
      
      let inseridas = 0;
      const total = this.competencias.size;
      
      for (const competencia of this.competencias.values()) {
        db.run(sql, [competencia.materia, competencia.numero, competencia.descricao], (err) => {
          if (err) {
            console.error('Erro ao inserir competência:', err);
            reject(err);
            return;
          }
          
          inseridas++;
          if (inseridas === total) {
            console.log(`${inseridas} competências inseridas`);
            resolve();
          }
        });
      }
    });
  }

  async inserirHabilidades() {
    return new Promise((resolve, reject) => {
      // Primeiro, buscar IDs das competências
      const sqlCompetencias = 'SELECT id, materia, numero FROM competencias';
      
      db.all(sqlCompetencias, [], (err, competencias) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Criar mapa de competências por chave
        const mapaCompetencias = new Map();
        competencias.forEach(comp => {
          const chave = `${comp.materia}-${comp.numero}`;
          mapaCompetencias.set(chave, comp.id);
        });
        
        // Inserir habilidades
        const sqlHabilidades = 'INSERT INTO habilidades (competencia_id, numero, descricao) VALUES (?, ?, ?)';
        let inseridas = 0;
        const total = this.habilidades.length;
        
        if (total === 0) {
          resolve();
          return;
        }
        
        for (const habilidade of this.habilidades) {
          const competenciaId = mapaCompetencias.get(habilidade.competenciaChave);
          
          if (!competenciaId) {
            console.warn(`Competência não encontrada para habilidade: ${habilidade.competenciaChave}`);
            inseridas++;
            if (inseridas === total) resolve();
            continue;
          }
          
          db.run(sqlHabilidades, [competenciaId, habilidade.numero, habilidade.descricao], (err) => {
            if (err) {
              console.error('Erro ao inserir habilidade:', err);
              reject(err);
              return;
            }
            
            inseridas++;
            if (inseridas === total) {
              console.log(`${inseridas} habilidades inseridas`);
              resolve();
            }
          });
        }
      });
    });
  }

  // Método para obter estatísticas da importação
  async obterEstatisticas() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          c.materia,
          COUNT(DISTINCT c.id) as total_competencias,
          COUNT(h.id) as total_habilidades
        FROM competencias c
        LEFT JOIN habilidades h ON c.id = h.competencia_id
        GROUP BY c.materia
        ORDER BY c.materia
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

// Executar importação se o script for chamado diretamente
if (require.main === module) {
  const importer = new MatrizReferenciaImporter();
  
  importer.importar()
    .then(async () => {
      const stats = await importer.obterEstatisticas();
      console.log('\nEstatísticas da importação:');
      stats.forEach(stat => {
        console.log(`${stat.materia}: ${stat.total_competencias} competências, ${stat.total_habilidades} habilidades`);
      });
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na importação:', error);
      process.exit(1);
    });
}

module.exports = MatrizReferenciaImporter;
