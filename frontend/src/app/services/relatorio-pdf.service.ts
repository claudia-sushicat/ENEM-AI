import { Injectable } from '@angular/core';

export interface HabilidadeRelatorio {
  codigo: string;
  competencia: string;
  descricao: string;
  taxaAcerto: number;
  totalQuestoes: number;
}

export interface RecomendacaoRelatorio {
  tipo: string;
  prioridade: string;
  conteudo: string;
  data: string;
}

export interface RelatorioProfessorPayload {
  aluno: {
    nome: string;
    email?: string;
  };
  geradoEm: Date;
  estatisticasGerais: {
    totalQuestoes: number;
    taxaAcerto: number;
  };
  materia?: {
    codigo: string;
    nome: string;
  };
  analise?: {
    descricao: string;
    metaSemanal: string;
    areasFoco: string[];
    nivelIdeal: number;
    nivelIdealTexto: string;
    mensagemMotivacional?: string;
  };
  perfil?: {
    nivelAtual: number;
    nivelAtualTexto: string;
    pontosFortes: string;
    pontosFracos: string;
  };
  habilidadesPrioritarias: HabilidadeRelatorio[];
  habilidadesFortes: HabilidadeRelatorio[];
  recomendacoes: RecomendacaoRelatorio[];
}

@Injectable({
  providedIn: 'root'
})
export class RelatorioPdfService {
  async gerarRelatorioProfessor(payload: RelatorioProfessorPayload): Promise<void> {
    const { default: JsPDF } = await import('jspdf');
    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const marginTop = 25;
    const marginBottom = 20;
    const contentWidth = pageWidth - marginX * 2;
    let cursorY = marginTop;
    let pageNumber = 1;

    // Cores
    const primaryColor = [41, 128, 185]; // Azul
    const secondaryColor = [52, 152, 219]; // Azul claro
    const successColor = [39, 174, 96]; // Verde
    const warningColor = [243, 156, 18]; // Laranja
    const dangerColor = [231, 76, 60]; // Vermelho
    const grayColor = [149, 165, 166]; // Cinza
    const lightGrayColor = [236, 240, 241]; // Cinza claro

    const addPageNumber = () => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Linha decorativa no rodapé
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
        
        doc.setFontSize(9);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }
    };

    const addSectionDivider = () => {
      ensureSpace(5);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 4;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (cursorY + requiredHeight > pageHeight - marginBottom) {
        addPageNumber();
        doc.addPage();
        cursorY = marginTop;
        pageNumber++;
      }
    };

    const addHeader = () => {
      // Barra superior colorida
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 15, 'F');
      
      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Relatório de Progresso do Estudante', pageWidth / 2, 10, {
        align: 'center'
      });

      cursorY = 25;
    };

    const addSectionTitle = (title: string, color: number[] = primaryColor) => {
      ensureSpace(12);
      
      // Fundo colorido para o título
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.roundedRect(marginX - 2, cursorY - 6, contentWidth + 4, 8, 2, 2, 'F');
      
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, marginX + 2, cursorY);
      
      cursorY += 8;
      doc.setTextColor(0, 0, 0);
    };

    const addInfoBox = (label: string, value: string, color: number[] = primaryColor, xPosition?: number) => {
      ensureSpace(14);
      
      const boxHeight = 14;
      const boxWidth = contentWidth / 2 - 3;
      const x = xPosition !== undefined ? xPosition : marginX;
      
      // Box
      doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, cursorY - 6, boxWidth, boxHeight, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(label, x + 3, cursorY - 1);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(value, x + 3, cursorY + 5);
      
      if (xPosition === undefined) {
        cursorY += boxHeight + 3;
      }
      doc.setTextColor(0, 0, 0);
    };

    const addParagraph = (text?: string, fontSize: number = 10) => {
      if (!text) {
        return;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * (fontSize * 0.4) + 2);
      
      lines.forEach((line: string) => {
        doc.text(line, marginX, cursorY);
        cursorY += fontSize * 0.4;
      });
      
      cursorY += 3;
    };

    const addKeyValue = (label: string, value: string, indent: number = 0) => {
      ensureSpace(6);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${label}:`, marginX + indent, cursorY);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const valueLines = doc.splitTextToSize(value || '-', contentWidth - 45 - indent);
      valueLines.forEach((line: string, index: number) => {
        doc.text(line, marginX + 45 + indent, cursorY + (index * 5));
      });
      
      cursorY += Math.max(6, valueLines.length * 5);
    };

    const addTable = (headers: string[], rows: string[][], columnWidths: number[]) => {
      ensureSpace(20);
      
      const rowHeight = 7;
      const headerHeight = 8;
      const tableY = cursorY;
      
      // Cabeçalho da tabela
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(marginX, tableY, contentWidth, headerHeight, 'FD');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      let xPos = marginX + 2;
      headers.forEach((header, index) => {
        doc.text(header, xPos, tableY + 5.5);
        xPos += columnWidths[index];
      });
      
      // Linhas da tabela
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      rows.forEach((row, rowIndex) => {
        const yPos = tableY + headerHeight + (rowIndex * rowHeight);
        ensureSpace(headerHeight + ((rowIndex + 1) * rowHeight) - (cursorY - tableY));
        
        // Alternar cor de fundo
        if (rowIndex % 2 === 0) {
          doc.setFillColor(lightGrayColor[0], lightGrayColor[1], lightGrayColor[2]);
          doc.rect(marginX, yPos, contentWidth, rowHeight, 'F');
        }
        
        // Borda da linha
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(marginX, yPos + rowHeight, marginX + contentWidth, yPos + rowHeight);
        
        // Conteúdo
        xPos = marginX + 2;
        row.forEach((cell, colIndex) => {
          const cellLines = doc.splitTextToSize(cell, columnWidths[colIndex] - 4);
          cellLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, xPos, yPos + 4 + (lineIndex * 3.5));
          });
          xPos += columnWidths[colIndex];
        });
      });
      
      cursorY = tableY + headerHeight + (rows.length * rowHeight) + 5;
    };

    const addHighlightBox = (text: string, color: number[] = secondaryColor) => {
      ensureSpace(12);
      
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      const lines = doc.splitTextToSize(text, contentWidth - 8);
      const boxHeight = (lines.length * 5) + 6;
      
      doc.roundedRect(marginX, cursorY - 5, contentWidth, boxHeight, 3, 3, 'FD');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      lines.forEach((line: string, index: number) => {
        doc.text(line, marginX + 4, cursorY + (index * 5));
      });
      
      cursorY += boxHeight + 4;
      doc.setTextColor(0, 0, 0);
    };

    const formatPercent = (value: number) => `${Math.round(value)}%`;
    const formatDateTime = payload.geradoEm.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const nomeAluno = payload.aluno.nome || 'Estudante';

    // Cabeçalho
    addHeader();

    // Subtítulo
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Relatório automático gerado para compartilhamento com professores e responsáveis',
      pageWidth / 2,
      cursorY,
      { align: 'center' }
    );
    cursorY += 10;

    // Identificação
    addSectionTitle('Identificação do Estudante');
    addKeyValue('Nome', nomeAluno);
    if (payload.aluno.email) {
      addKeyValue('E-mail', payload.aluno.email);
    }
    addKeyValue('Data de geração', formatDateTime);
    if (payload.materia) {
      addKeyValue('Matéria analisada', `${payload.materia.nome} (${payload.materia.codigo})`);
    }
    cursorY += 3;

    // Estatísticas gerais em boxes
    addSectionTitle('Estatísticas Gerais', successColor);
    cursorY += 2;
    
    const boxWidth = contentWidth / 2 - 3;
    const boxHeight = 12;
    const startY = cursorY;
    
    // Box esquerdo - Total de Questões
    addInfoBox('Total de Questões', String(payload.estatisticasGerais.totalQuestoes), successColor, marginX);
    
    // Box direito - Taxa de Acerto
    addInfoBox('Taxa de Acerto', formatPercent(payload.estatisticasGerais.taxaAcerto), successColor, marginX + boxWidth + 6);
    
    cursorY = startY + boxHeight + 4;
    addSectionDivider();

    // Análise de Progresso
    if (payload.analise) {
      addSectionTitle('Análise de Progresso', secondaryColor);
      
      addParagraph(payload.analise.descricao, 10);
      cursorY += 2;
      
      addKeyValue('Meta semanal sugerida', payload.analise.metaSemanal);
      addKeyValue('Nível ideal recomendado', `${payload.analise.nivelIdealTexto} (${formatPercent(payload.analise.nivelIdeal * 100)})`);
      
      if (payload.analise.areasFoco.length) {
        cursorY += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Áreas prioritárias:', marginX, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        payload.analise.areasFoco.forEach((area, index) => {
          // Bullet point colorido
          doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          doc.circle(marginX + 2, cursorY - 1.5, 1, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(area, marginX + 6, cursorY);
          cursorY += 5;
        });
        cursorY += 2;
      }
    }
    addSectionDivider();

    // Perfil de Aprendizado
    if (payload.perfil) {
      addSectionTitle('Perfil de Aprendizado', primaryColor);
      
      addKeyValue('Nível atual', `${payload.perfil.nivelAtualTexto} (${formatPercent(payload.perfil.nivelAtual * 100)})`);
      cursorY += 2;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(successColor[0], successColor[1], successColor[2]);
      doc.text('Pontos Fortes:', marginX, cursorY);
      cursorY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      addParagraph(payload.perfil.pontosFortes, 10);
      
      cursorY += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(warningColor[0], warningColor[1], warningColor[2]);
      doc.text('Áreas de Melhoria:', marginX, cursorY);
      cursorY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      addParagraph(payload.perfil.pontosFracos, 10);
    }
    addSectionDivider();

    // Habilidades Prioritárias em tabela
    if (payload.habilidadesPrioritarias.length) {
      addSectionTitle('Habilidades que Precisam de Atenção', dangerColor);
      
      const headers = ['Código', 'Taxa Acerto', 'Questões', 'Descrição'];
      const columnWidths = [25, 30, 25, contentWidth - 80];
      const rows = payload.habilidadesPrioritarias.map(h => [
        `${h.codigo}/${h.competencia}`,
        formatPercent(h.taxaAcerto),
        String(h.totalQuestoes),
        h.descricao.length > 40 ? h.descricao.substring(0, 40) + '...' : h.descricao
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    addSectionDivider();

    // Habilidades Fortes em tabela
    if (payload.habilidadesFortes.length) {
      addSectionTitle('Habilidades Consolidadas', successColor);
      
      const headers = ['Código', 'Taxa Acerto', 'Questões', 'Descrição'];
      const columnWidths = [25, 30, 25, contentWidth - 80];
      const rows = payload.habilidadesFortes.map(h => [
        `${h.codigo}/${h.competencia}`,
        formatPercent(h.taxaAcerto),
        String(h.totalQuestoes),
        h.descricao.length > 40 ? h.descricao.substring(0, 40) + '...' : h.descricao
      ]);
      
      addTable(headers, rows, columnWidths);
    }
    addSectionDivider();

    // Recomendações
    addSectionTitle('Recomendações Recentes', warningColor);
    if (payload.recomendacoes.length) {
      payload.recomendacoes.forEach((recomendacao, index) => {
        ensureSpace(15);
        
        const contentLines = doc.splitTextToSize(recomendacao.conteudo, contentWidth - 12);
        const boxHeight = 10 + (contentLines.length * 4);
        
        // Barra lateral colorida
        doc.setFillColor(warningColor[0], warningColor[1], warningColor[2]);
        doc.rect(marginX, cursorY - 5, 3, boxHeight, 'F');
        
        // Box para cada recomendação
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(warningColor[0], warningColor[1], warningColor[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(marginX + 3, cursorY - 5, contentWidth - 3, boxHeight, 2, 2, 'FD');
        
        // Cabeçalho da recomendação
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(warningColor[0], warningColor[1], warningColor[2]);
        doc.text(
          `${recomendacao.tipo} • ${recomendacao.prioridade} • ${recomendacao.data}`,
          marginX + 6,
          cursorY
        );
        
        // Conteúdo
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        contentLines.forEach((line: string, lineIndex: number) => {
          doc.text(line, marginX + 6, cursorY + 5 + (lineIndex * 4));
        });
        
        cursorY += boxHeight + 4;
      });
    } else {
      addParagraph('Todas as recomendações atuais já foram concluídas ou não há sugestões pendentes.', 10);
    }

    // Adicionar numeração de páginas
    addPageNumber();

    const fileName = `relatorio-${nomeAluno.toLowerCase().replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }
}


