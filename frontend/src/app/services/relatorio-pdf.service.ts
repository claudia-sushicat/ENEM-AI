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
    estilo?: string;
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
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    let cursorY = 20;

    const ensureSpace = (lines = 1, lineHeight = 6) => {
      const required = lines * lineHeight + 4;
      if (cursorY + required > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
    };

    const addSectionTitle = (title: string) => {
      ensureSpace(2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, marginX, cursorY);
      cursorY += 5;
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    };

    const addParagraph = (text?: string) => {
      if (!text) {
        return;
      }

      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length);
      doc.text(lines, marginX, cursorY);
      cursorY += lines.length * 5 + 2;
    };

    const addKeyValue = (label: string, value: string) => {
      ensureSpace(1);
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '-', marginX + 35, cursorY);
      cursorY += 6;
    };

    const addList = (items: string[]) => {
      items.forEach(item => {
        const lines = doc.splitTextToSize(`• ${item}`, contentWidth);
        ensureSpace(lines.length);
        doc.text(lines, marginX, cursorY);
        cursorY += lines.length * 5;
      });
      cursorY += 2;
    };

    const formatPercent = (value: number) => `${Math.round(value)}%`;
    const formatDateTime = payload.geradoEm.toLocaleString('pt-BR');
    const nomeAluno = payload.aluno.nome || 'Estudante';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Progresso do Estudante', pageWidth / 2, cursorY, {
      align: 'center'
    });
    cursorY += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    addParagraph('Resumo automático gerado para compartilhamento com professores e responsáveis.');

    addSectionTitle('Identificação');
    addKeyValue('Aluno', `${nomeAluno}`);
    if (payload.aluno.email) {
      addKeyValue('E-mail', payload.aluno.email);
    }
    addKeyValue('Data de geração', formatDateTime);
    if (payload.materia) {
      addKeyValue('Foco da análise', `${payload.materia.nome} (${payload.materia.codigo})`);
    }

    addSectionTitle('Visão Geral');
    addKeyValue('Questões respondidas', String(payload.estatisticasGerais.totalQuestoes));
    addKeyValue('Taxa de acerto média', formatPercent(payload.estatisticasGerais.taxaAcerto));

    if (payload.analise) {
      addSectionTitle('Análise de Progresso');
      addParagraph(payload.analise.descricao);
      addKeyValue('Meta semanal sugerida', payload.analise.metaSemanal);
      addKeyValue('Nível ideal recomendado', `${payload.analise.nivelIdealTexto} (${formatPercent(payload.analise.nivelIdeal * 100)})`);
      if (payload.analise.areasFoco.length) {
        addParagraph(`Áreas prioritárias: ${payload.analise.areasFoco.join(', ')}`);
      }
      if (payload.analise.mensagemMotivacional) {
        addParagraph(`Mensagem motivacional: ${payload.analise.mensagemMotivacional}`);
      }
    }

    if (payload.perfil) {
      addSectionTitle('Perfil de Aprendizado');
      addKeyValue('Nível atual', `${payload.perfil.nivelAtualTexto} (${formatPercent(payload.perfil.nivelAtual * 100)})`);
      addParagraph(`Pontos fortes: ${payload.perfil.pontosFortes}`);
      addParagraph(`Áreas de melhoria: ${payload.perfil.pontosFracos}`);
      if (payload.perfil.estilo) {
        addParagraph(`Estilo de aprendizado predominante: ${payload.perfil.estilo}`);
      }
    }

    if (payload.habilidadesPrioritarias.length) {
      addSectionTitle('Habilidades que precisam de atenção');
      const itens = payload.habilidadesPrioritarias.map(habilidade =>
        `${habilidade.codigo} / ${habilidade.competencia} · ${habilidade.taxaAcerto}% de acerto em ${habilidade.totalQuestoes} questões · ${habilidade.descricao}`
      );
      addList(itens);
    }

    if (payload.habilidadesFortes.length) {
      addSectionTitle('Habilidades consolidadas');
      const itens = payload.habilidadesFortes.map(habilidade =>
        `${habilidade.codigo} / ${habilidade.competencia} · ${habilidade.taxaAcerto}% de acerto em ${habilidade.totalQuestoes} questões · ${habilidade.descricao}`
      );
      addList(itens);
    }

    addSectionTitle('Recomendações recentes');
    if (payload.recomendacoes.length) {
      payload.recomendacoes.forEach(recomendacao => {
        addParagraph(
          `[${recomendacao.tipo} | ${recomendacao.prioridade} | ${recomendacao.data}] ${recomendacao.conteudo}`
        );
      });
    } else {
      addParagraph('Todas as recomendações atuais já foram concluídas ou não há sugestões pendentes.');
    }

    const fileName = `relatorio-${nomeAluno.toLowerCase().replace(/\\s+/g, '-')}.pdf`;
    doc.save(fileName);
  }
}


