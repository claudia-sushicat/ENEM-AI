import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService, Usuario } from '../services/auth.service';
import { HabilidadesService, ProgressoCompetencia, ProgressoHabilidade } from '../services/habilidades.service';
import { RelatorioPdfService, RelatorioProfessorPayload } from '../services/relatorio-pdf.service';

interface Recomendacao {
  id: number;
  tipo_recomendacao: string;
  conteudo: string;
  prioridade: number;
  visualizada: boolean;
  data_criacao: string;
}

interface AnaliseProgresso {
  analise_progresso: string;
  recomendacoes: Array<{
    tipo: string;
    conteudo: string;
    prioridade: number;
    habilidades_foco?: string[];
  }>;
  nivel_dificuldade_ideal: number;
  areas_foco: string[];
  habilidades_prioritarias?: string[];
  mensagem_motivacional: string;
  meta_semanal: string;
}

interface MensagemMotivacional {
  mensagem: string;
  tipo: string;
  icone: string;
}

interface PerfilAprendizado {
  nivel_atual: number;
  pontos_fortes: string;
  pontos_fracos: string;
  ultima_atualizacao: string;
}

interface ResumoMateria {
  codigo: string;
  nome: string;
  totalRespondidas: number;
  totalCorretas: number;
  taxaAcerto: number;
  competenciasMonitoradas: number;
}

interface ProgressoGeral {
  totalQuestoes: number;
  questoesDistintas: number;
  corretas: number;
  taxaAcertoGeral: number;
}

@Component({
  selector: 'app-dashboard-ia',
  imports: [CommonModule, FormsModule, ButtonModule, ProgressSpinnerModule],
  templateUrl: './dashboard-ia.html'
})
export class DashboardIAComponent implements OnInit {
  recomendacoes: Recomendacao[] = [];
  analiseProgresso: AnaliseProgresso | null = null;
  mensagemMotivacional: MensagemMotivacional | null = null;
  perfilAprendizado: PerfilAprendizado | null = null;
  progressoHabilidades: ProgressoHabilidade[] = [];
  progressoCompetencias: ProgressoCompetencia[] = [];
  resumoMaterias: ResumoMateria[] = [];
  usuario: Usuario | null = null;
  totalQuestoesMateriaSelecionada = 0;
  readonly minimoQuestoesNivelIdeal = 10;
  
  // Estados da interface
  carregando: boolean = false;
  materiaSelecionada: string = '';
  materias: string[] = ['LC', 'MT', 'CN', 'CH'];
  exportandoPdf = false;
  resumoMateriasCarregando = false;
  
  // Estatísticas gerais
  totalQuestoes: number = 0;
  totalQuestoesDistintas: number = 0;
  taxaAcertoGeral: number = 0;

  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private habilidadesService = inject(HabilidadesService);
  private relatorioPdfService = inject(RelatorioPdfService);

  constructor() {
    this.usuario = this.authService.getUsuarioAtual();
    this.authService.usuario$
      .pipe(takeUntilDestroyed())
      .subscribe(usuario => {
        this.usuario = usuario;
        this.cdr.markForCheck();
      });
  }

  ngOnInit() {
    this.carregarDadosIniciais();
  }

  carregarDadosIniciais() {
    this.carregarRecomendacoes();
    this.carregarMensagemMotivacional();
    this.carregarEstatisticasGerais();
    this.carregarResumoMaterias();
  }

  carregarRecomendacoes() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<{recomendacoes: Recomendacao[]}>('http://localhost:3000/api/recomendacoes?limite=5&visualizadas=false', {
      headers
    })
    .subscribe({
      next: (data) => {
        this.recomendacoes = data.recomendacoes;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar recomendações:', error);
      }
    });
  }

  carregarMensagemMotivacional() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<MensagemMotivacional>('http://localhost:3000/api/mensagem-motivacional?contexto=dashboard', {
      headers
    })
    .subscribe({
      next: (data) => {
        this.mensagemMotivacional = data;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar mensagem motivacional:', error);
      }
    });
  }

  carregarEstatisticasGerais() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<ProgressoGeral>('http://localhost:3000/api/progresso-geral', {
      headers
    })
    .subscribe({
      next: (progresso) => {
        this.totalQuestoes = progresso.totalQuestoes ?? 0;
        this.totalQuestoesDistintas = progresso.questoesDistintas ?? progresso.totalQuestoes ?? 0;
        const taxa = progresso.taxaAcertoGeral ?? 0;
        this.taxaAcertoGeral = Math.round(taxa * 10) / 10;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas gerais:', error);
      }
    });
  }

  selecionarMateria(materia: string) {
    this.materiaSelecionada = materia;
    this.totalQuestoesMateriaSelecionada = 0;
    this.carregarAnaliseProgresso(materia);
    this.carregarPerfilAprendizado(materia);
    this.carregarProgressoHabilidades(materia);
    this.carregarProgressoCompetencias(materia);
  }

  carregarProgressoHabilidades(materia: string) {
    this.habilidadesService.obterProgressoHabilidades(materia).subscribe({
      next: (data) => {
        const habilidadesProcessadas = (data.progresso_habilidades ?? []).map(habilidade => ({
          ...habilidade,
          total_questoes: Number(habilidade.total_questoes ?? 0),
          questoes_corretas: Number(habilidade.questoes_corretas ?? 0),
          taxa_acerto: Number(habilidade.taxa_acerto ?? 0)
        }));

        this.progressoHabilidades = habilidadesProcessadas
          .filter(habilidade => habilidade.total_questoes > 0)
          .sort((a, b) => a.numero - b.numero);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar progresso por habilidades:', error);
      }
    });
  }

  carregarProgressoCompetencias(materia: string) {
    this.habilidadesService.obterProgressoCompetencias(materia).subscribe({
      next: (data) => {
        const competenciasProcessadas = (data.progresso_competencias ?? []).map(competencia => ({
          ...competencia,
          total_questoes: Number(competencia.total_questoes ?? 0),
          questoes_corretas: Number(competencia.questoes_corretas ?? 0),
          taxa_acerto: Number(competencia.taxa_acerto ?? 0)
        }));

        const totalQuestoesMateria = competenciasProcessadas
          .reduce((total, competencia) => total + competencia.total_questoes, 0);
        this.totalQuestoesMateriaSelecionada = totalQuestoesMateria;

        this.progressoCompetencias = competenciasProcessadas
          .filter(competencia => competencia.total_questoes > 0)
          .sort((a, b) => a.numero - b.numero);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar progresso por competências:', error);
      }
    });
  }

  async carregarResumoMaterias() {
    this.resumoMateriasCarregando = true;
    this.cdr.markForCheck();

    try {
      const resultados = await Promise.all(
        this.materias.map(async codigo => {
          try {
            const resposta = await firstValueFrom(this.habilidadesService.obterProgressoCompetencias(codigo));
            const competencias = resposta.progresso_competencias;
            const totalRespondidas = competencias.reduce((total, item) => total + (item.total_questoes || 0), 0);
            const totalCorretas = competencias.reduce((total, item) => total + (item.questoes_corretas || 0), 0);
            const competenciasMonitoradas = competencias.filter(item => item.total_questoes > 0).length;
            const taxaAcerto = totalRespondidas > 0 ? Math.round((totalCorretas / totalRespondidas) * 100) : 0;

            return {
              codigo,
              nome: this.getNomeMateria(codigo),
              totalRespondidas,
              totalCorretas,
              taxaAcerto,
              competenciasMonitoradas
            };
          } catch (erroMateria) {
            console.error(`Erro ao carregar resumo da matéria ${codigo}:`, erroMateria);
            return {
              codigo,
              nome: this.getNomeMateria(codigo),
              totalRespondidas: 0,
              totalCorretas: 0,
              taxaAcerto: 0,
              competenciasMonitoradas: 0
            };
          }
        })
      );

      this.resumoMaterias = resultados;
    } catch (erro) {
      console.error('Erro ao montar resumo das matérias:', erro);
      this.resumoMaterias = [];
    } finally {
      this.resumoMateriasCarregando = false;
      this.cdr.markForCheck();
    }
  }

  carregarAnaliseProgresso(materia: string) {
    this.carregando = true;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<AnaliseProgresso>(`http://localhost:3000/api/analise-progresso/${materia}`, {
      headers
    })
    .subscribe({
      next: (data) => {
        this.analiseProgresso = data;
        this.carregando = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar análise de progresso:', error);
        this.carregando = false;
        this.cdr.markForCheck();
      }
    });
  }

  carregarPerfilAprendizado(materia: string) {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<PerfilAprendizado>(`http://localhost:3000/api/perfil-aprendizado/${materia}`, {
      headers
    })
    .subscribe({
      next: (data) => {
        this.perfilAprendizado = data;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar perfil de aprendizado:', error);
      }
    });
  }

  marcarRecomendacaoComoVisualizada(id: number) {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.put(`http://localhost:3000/api/recomendacoes/${id}/visualizar`, {}, { headers })
    .subscribe({
      next: (data) => {
        // Remover a recomendação da lista
        this.recomendacoes = this.recomendacoes.filter(rec => rec.id !== id);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao marcar recomendação como visualizada:', error);
      }
    });
  }

  getNivelDificuldadeTexto(nivel: number): string {
    if (nivel <= 0.3) return 'Iniciante';
    if (nivel <= 0.6) return 'Intermediário';
    if (nivel <= 0.8) return 'Avançado';
    return 'Expert';
  }

  getNivelDificuldadeCor(nivel: number): string {
    if (nivel <= 0.3) return '#e74c3c';
    if (nivel <= 0.6) return '#f39c12';
    if (nivel <= 0.8) return '#27ae60';
    return '#8e44ad';
  }

  getTipoRecomendacaoIcone(tipo: string): string {
    switch (tipo) {
      case 'estudo': return '📚';
      case 'pratica': return '🎯';
      case 'revisao': return '🔄';
      default: return '💡';
    }
  }

  getTipoRecomendacaoCor(tipo: string): string {
    switch (tipo) {
      case 'estudo': return '#3498db';
      case 'pratica': return '#e74c3c';
      case 'revisao': return '#f39c12';
      default: return '#9b59b6';
    }
  }

  getPrioridadeTexto(prioridade: number): string {
    switch (prioridade) {
      case 5: return 'Muito Alta';
      case 4: return 'Alta';
      case 3: return 'Média';
      case 2: return 'Baixa';
      case 1: return 'Muito Baixa';
      default: return 'Normal';
    }
  }

  getPrioridadeCor(prioridade: number): string {
    switch (prioridade) {
      case 5: return '#e74c3c';
      case 4: return '#f39c12';
      case 3: return '#f1c40f';
      case 2: return '#27ae60';
      case 1: return '#95a5a6';
      default: return '#3498db';
    }
  }

  formatarData(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  getNomeMateria(codigo: string): string {
    return this.habilidadesService.getNomeMateria(codigo);
  }

  getCorTaxaAcerto(taxa: number): string {
    return this.habilidadesService.getCorTaxaAcerto(taxa);
  }

  getTextoTaxaAcerto(taxa: number): string {
    return this.habilidadesService.getTextoTaxaAcerto(taxa);
  }

  getIconeTaxaAcerto(taxa: number): string {
    return this.habilidadesService.getIconeTaxaAcerto(taxa);
  }

  temDadosNivelIdeal(): boolean {
    if (!this.materiaSelecionada) {
      return false;
    }

    const resumoMateria = this.resumoMaterias.find(
      resumo => resumo.codigo === this.materiaSelecionada
    );

    const totalRespondidas = resumoMateria?.totalRespondidas ?? this.totalQuestoesMateriaSelecionada;
    return totalRespondidas >= this.minimoQuestoesNivelIdeal;
  }

  getHabilidadesPrioritarias(): ProgressoHabilidade[] {
    return this.progressoHabilidades
      .filter(h => h.total_questoes > 0 && h.taxa_acerto < 60)
      .sort((a, b) => a.taxa_acerto - b.taxa_acerto)
      .slice(0, 5);
  }

  getHabilidadesFortes(): ProgressoHabilidade[] {
    return this.progressoHabilidades
      .filter(h => h.total_questoes > 0 && h.taxa_acerto >= 80)
      .sort((a, b) => b.taxa_acerto - a.taxa_acerto)
      .slice(0, 5);
  }

  podeExportarRelatorio(): boolean {
    return !!(
      this.materiaSelecionada &&
      !this.carregando &&
      this.analiseProgresso &&
      this.usuario
    );
  }

  async exportarRelatorio() {
    if (this.exportandoPdf || !this.podeExportarRelatorio()) {
      return;
    }

    if (!this.usuario) {
      console.warn('Usuário não identificado para gerar o relatório.');
      return;
    }

    try {
      this.exportandoPdf = true;
      const payload = this.montarPayloadRelatorio();
      await this.relatorioPdfService.gerarRelatorioProfessor(payload);
    } catch (error) {
      console.error('Erro ao gerar relatório em PDF:', error);
    } finally {
      this.exportandoPdf = false;
    }
  }

  private montarPayloadRelatorio(): RelatorioProfessorPayload {
    if (!this.usuario) {
      throw new Error('Usuário não identificado');
    }

    const materia = this.materiaSelecionada
      ? {
          codigo: this.materiaSelecionada,
          nome: this.getNomeMateria(this.materiaSelecionada)
        }
      : undefined;

    return {
      aluno: {
        nome: this.usuario.nome,
        email: this.usuario.email
      },
      geradoEm: new Date(),
      estatisticasGerais: {
        totalQuestoes: this.totalQuestoes,
        taxaAcerto: this.taxaAcertoGeral
      },
      materia,
      analise: this.analiseProgresso
        ? {
            descricao: this.analiseProgresso.analise_progresso,
            metaSemanal: this.analiseProgresso.meta_semanal,
            areasFoco: this.analiseProgresso.areas_foco,
            nivelIdeal: this.analiseProgresso.nivel_dificuldade_ideal,
            nivelIdealTexto: this.getNivelDificuldadeTexto(this.analiseProgresso.nivel_dificuldade_ideal),
            mensagemMotivacional: this.mensagemMotivacional?.mensagem ?? this.analiseProgresso.mensagem_motivacional
          }
        : undefined,
      perfil: this.perfilAprendizado
        ? {
            nivelAtual: this.perfilAprendizado.nivel_atual,
            nivelAtualTexto: this.getNivelDificuldadeTexto(this.perfilAprendizado.nivel_atual),
            pontosFortes: this.perfilAprendizado.pontos_fortes,
            pontosFracos: this.perfilAprendizado.pontos_fracos
          }
        : undefined,
      habilidadesPrioritarias: this.getHabilidadesPrioritarias().map(habilidade => ({
        codigo: `H${habilidade.numero}`,
        competencia: `C${habilidade.competencia_numero}`,
        descricao: habilidade.descricao,
        taxaAcerto: habilidade.taxa_acerto,
        totalQuestoes: habilidade.total_questoes
      })),
      habilidadesFortes: this.getHabilidadesFortes().map(habilidade => ({
        codigo: `H${habilidade.numero}`,
        competencia: `C${habilidade.competencia_numero}`,
        descricao: habilidade.descricao,
        taxaAcerto: habilidade.taxa_acerto,
        totalQuestoes: habilidade.total_questoes
      })),
      recomendacoes: this.recomendacoes.map(recomendacao => ({
        tipo: this.formatarTipoRecomendacao(recomendacao.tipo_recomendacao),
        prioridade: this.getPrioridadeTexto(recomendacao.prioridade),
        conteudo: recomendacao.conteudo,
        data: this.formatarData(recomendacao.data_criacao)
      }))
    };
  }

  private formatarTipoRecomendacao(tipo: string): string {
    switch (tipo) {
      case 'estudo':
        return 'Plano de estudo';
      case 'pratica':
        return 'Prática guiada';
      case 'revisao':
        return 'Revisão dirigida';
      default:
        return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Recomendação';
    }
  }
}
