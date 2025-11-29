const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { db } = require('./database');

function importQuestionsFromCSV() {
  const csvPath = path.join(__dirname, '../dados/prova_enem_2023_completa_com_textos.csv');
  let questionsImported = 0;
  let questionsSkipped = 0;

  console.log('Iniciando importação das questões...');
  
  // Aguardar um pouco para garantir que as tabelas foram criadas
  setTimeout(() => {
    processarImportacao();
  }, 2000);
  
  function processarImportacao() {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Preparar os dados da questão
        const questionData = {
          materia: row.MATERIA,
          posicao: parseInt(row.POSICAO),
          cod_questao: row.COD_QUESTAO,
          habilidade: parseInt(row.HABILIDADE),
          lingua: row.LINGUA,
          resposta: row.RESPOSTA,
          dificuldade: parseFloat(row.DIFICULDADE),
          enunciado: row.ENUNCIADO,
          alt_a: row.ALT_A,
          alt_b: row.ALT_B,
          alt_c: row.ALT_C,
          alt_d: row.ALT_D,
          alt_e: row.ALT_E
        };

        // Inserir questão no banco de dados
        const sql = `
          INSERT OR IGNORE INTO questoes 
          (materia, posicao, cod_questao, habilidade, lingua, resposta, dificuldade, 
           enunciado, alt_a, alt_b, alt_c, alt_d, alt_e)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          questionData.materia,
          questionData.posicao,
          questionData.cod_questao,
          questionData.habilidade,
          questionData.lingua,
          questionData.resposta,
          questionData.dificuldade,
          questionData.enunciado,
          questionData.alt_a,
          questionData.alt_b,
          questionData.alt_c,
          questionData.alt_d,
          questionData.alt_e
        ], function(err) {
          if (err) {
            console.error('Erro ao inserir questão:', err.message);
            questionsSkipped++;
          } else if (this.changes > 0) {
            questionsImported++;
          } else {
            questionsSkipped++;
          }
        });
      })
      .on('end', () => {
        console.log('Importação concluída!');
        console.log(`Questões importadas: ${questionsImported}`);
        console.log(`Questões já existentes (ignoradas): ${questionsSkipped}`);
        
        // Fechar conexão com o banco
        setTimeout(() => {
          db.close();
          process.exit(0);
        }, 1000);
      })
      .on('error', (err) => {
        console.error('Erro ao ler o arquivo CSV:', err);
        process.exit(1);
      });
  }
}

// Executar importação se o arquivo for chamado diretamente
if (require.main === module) {
  importQuestionsFromCSV();
}

module.exports = { importQuestionsFromCSV };
