import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../services/auth.service';
import { HabilidadesService, Competencia, ProgressoCompetencia } from '../services/habilidades.service';
import { interval, Subscription } from 'rxjs';

interface Questao {
  id: number;
  materia: string;
  posicao: number;
  cod_questao: string;
  habilidade: number;
  habilidade_id?: number;
  lingua: string;
  dificuldade: number;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  habilidade_descricao?: string;
  competencia_numero?: number;
  competencia_descricao?: string;
}

interface RespostaResultado {
  correta: boolean;
  resposta_correta: string;
  mensagem: string;
  feedback_ia?: {
    feedback: string;
    explicacao_correta: string;
    conceitos_revisar: string[];
    estrategia_estudo: string;
    nivel_dificuldade_sugerido: number;
    areas_melhoria: string;
    motivo_erro?: string;
    ponto_confusao?: string;
    passos_revisao?: string[];
  };
}

@Component({
  selector: 'app-questoes',
  imports: [
    CommonModule, 
    FormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    DialogModule,
    TagModule
  ],
  templateUrl: './questoes.html'
})
export class QuestoesComponent implements OnInit, OnDestroy {
  questoes: Questao[] = [];
  questaoAtual: Questao | null = null;
  questaoIndex: number = 0;
  respostaSelecionada: string = '';
  materiaSelecionada: string = '';
  sessoesEstudo: any[] = [];
  
  // Dados de competências
  competencias: Competencia[] = [];
  progressoCompetencias: ProgressoCompetencia[] = [];
  competenciaSelecionada: number | null = null;
  
  // Filtro de dificuldade
  dificuldadeSelecionada: string | null = null;
  opcoesDificuldade = [
    { label: 'Fácil', value: 'facil', min: 0, max: 3 },
    { label: 'Médio', value: 'medio', min: 4, max: 6 },
    { label: 'Difícil', value: 'dificil', min: 7, max: 10 }
  ];
  
  // Estados da interface
  carregando: boolean = false;
  mostrandoResultado: boolean = false;
  resultado: RespostaResultado | null = null;
  iniciandoSessao: boolean = false;
  sessaoId: number | null = null;
  tempoInicio: number = 0;
  mostrandoFiltros: boolean = false;
  mostrandoZoomImagem: boolean = false;
  imagemZoomUrl: string = '';
  nenhumaQuestaoEncontrada: boolean = false;
  aguardandoCorrecao: boolean = false;
  
  // Estatísticas da sessão atual
  totalRespondidas: number = 0;
  corretas: number = 0;
  incorretas: number = 0;
  
  // Timer para atualização do tempo
  private timerSubscription?: Subscription;
  tempoDecorrido: string = '00:00';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private habilidadesService: HabilidadesService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('QuestoesComponent ngOnInit iniciado');
    this.carregarHistoricoSessoes();
    
    // Verificar se há uma matéria específica nos parâmetros de query
    this.route.queryParams.subscribe(params => {
      console.log('Query params:', params);
      if (params['materia']) {
        this.selecionarMateria(params['materia']);
      } else {
        this.voltarParaDashboard();
      }
    });
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  selecionarMateria(materia: string) {
    console.log('Selecionando matéria:', materia);
    this.materiaSelecionada = materia;
    
    // Carregar competências primeiro
    this.carregarCompetencias(materia);
    this.carregarProgressoCompetencias(materia);
    
    // Aguardar um pouco antes de iniciar a sessão para garantir que as competências sejam carregadas
    setTimeout(() => {
      this.iniciarSessaoEstudo();
    }, 100);
  }

  carregarCompetencias(materia: string) {
    console.log('Carregando competências para matéria:', materia);
    this.habilidadesService.obterCompetencias(materia).subscribe({
      next: (data) => {
        console.log('Competências carregadas:', data.competencias);
        this.competencias = data.competencias;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar competências:', error);
      }
    });
  }

  carregarProgressoCompetencias(materia: string) {
    this.habilidadesService.obterProgressoCompetencias(materia).subscribe({
      next: (data) => {
        this.progressoCompetencias = data.progresso_competencias;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar progresso por competências:', error);
      }
    });
  }

  selecionarCompetencia(competenciaId: number) {
    this.competenciaSelecionada = competenciaId;
    this.carregarQuestoesPorCompetencia();
  }

  carregarQuestoesPorCompetencia() {
    if (!this.materiaSelecionada || !this.competenciaSelecionada) return;
    
    this.carregando = true;
    this.nenhumaQuestaoEncontrada = false;
    
    const dificuldadeMedia = this.getDificuldadeMedia();
    
    this.habilidadesService.obterQuestoesPorCompetencia(
      this.materiaSelecionada, 
      this.competenciaSelecionada, 
      10,
      0,
      dificuldadeMedia
    ).subscribe({
      next: (data) => {
        this.questoes = data.questoes;
        this.questaoIndex = 0;
        this.questaoAtual = this.questoes[0] || null;
        this.nenhumaQuestaoEncontrada = this.questoes.length === 0;
        this.carregando = false;
        this.resetarContadores();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar questões por competência:', error);
        this.carregando = false;
        this.nenhumaQuestaoEncontrada = false;
        this.cdr.markForCheck();
      }
    });
  }

  limparFiltroCompetencia() {
    this.competenciaSelecionada = null;
    this.carregarQuestoes();
  }

  getProgressoCompetencia(competenciaId: number): ProgressoCompetencia | null {
    return this.progressoCompetencias.find(p => p.id === competenciaId) || null;
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

  // Lista de posições que têm imagens disponíveis
  private questoesComImagem = [1, 5, 24, 33, 34, 44, 46, 56, 65, 72, 89, 111, 135, 144, 165, 179];

  // Verificar se existe imagem para a questão
  temImagemQuestao(questao: Questao): boolean {
    if (!questao) return false;
    return questao.posicao !== undefined && 
           questao.posicao > 0 && 
           this.questoesComImagem.includes(questao.posicao);
  }

  // Obter URL da imagem da questão
  getImagemQuestao(questao: Questao): string {
    if (!this.temImagemQuestao(questao)) return '';
    return `/img/question-${questao.posicao}.png`;
  }

  // Tratar erro de carregamento de imagem
  onImageError(event: any) {
    console.log('Erro ao carregar imagem da questão:', event.target.src);
    // Ocultar toda a div da imagem em caso de erro
    const imageContainer = event.target.closest('.questao-imagem');
    if (imageContainer) {
      imageContainer.style.display = 'none';
    }
  }

  // Abrir zoom da imagem
  abrirZoomImagem(event: any) {
    this.imagemZoomUrl = event.target.src;
    this.mostrandoZoomImagem = true;
    document.body.style.overflow = 'hidden'; // Prevenir scroll da página
  }

  // Fechar zoom da imagem
  fecharZoomImagem() {
    this.mostrandoZoomImagem = false;
    this.imagemZoomUrl = '';
    document.body.style.overflow = 'auto'; // Restaurar scroll da página
  }

  iniciarSessaoEstudo() {
    if (!this.materiaSelecionada) return;
    
    this.iniciandoSessao = true;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.post<{sessao_id: number}>('http://localhost:3000/api/sessao/iniciar', 
      { materia: this.materiaSelecionada }, 
      { headers }
    )
    .subscribe({
      next: (data) => {
        this.sessaoId = data.sessao_id;
        this.tempoInicio = Date.now();
        this.iniciarTimer();
        this.carregarQuestoes();
        this.iniciandoSessao = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao iniciar sessão:', error);
        this.iniciandoSessao = false;
        this.cdr.markForCheck();
      }
    });
  }

  carregarQuestoes() {
    if (!this.materiaSelecionada) return;
    
    this.carregando = true;
    this.nenhumaQuestaoEncontrada = false;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    const dificuldadeMedia = this.getDificuldadeMedia();
    let url = `http://localhost:3000/api/questoes/${this.materiaSelecionada}?limit=10`;
    
    if (dificuldadeMedia !== undefined) {
      url += `&dificuldade=${dificuldadeMedia}`;
    }

    this.http.get<{questoes: Questao[]}>(url, { headers })
    .subscribe({
      next: (data) => {
        this.questoes = data.questoes;
        this.questaoIndex = 0;
        this.questaoAtual = this.questoes[0] || null;
        this.nenhumaQuestaoEncontrada = this.questoes.length === 0;
        this.carregando = false;
        this.resetarContadores();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar questões:', error);
        this.carregando = false;
        this.nenhumaQuestaoEncontrada = false;
        this.cdr.markForCheck();
      }
    });
  }

  proximaQuestao() {
    if (this.questaoIndex < this.questoes.length - 1) {
      this.questaoIndex++;
      this.questaoAtual = this.questoes[this.questaoIndex];
      this.respostaSelecionada = '';
      this.mostrandoResultado = false;
      this.resultado = null;
    }
  }

  questaoAnterior() {
    if (this.questaoIndex > 0) {
      this.questaoIndex--;
      this.questaoAtual = this.questoes[this.questaoIndex];
      this.respostaSelecionada = '';
      this.mostrandoResultado = false;
      this.resultado = null;
    }
  }

  submeterResposta() {
    if (!this.respostaSelecionada || !this.questaoAtual) return;
    
    this.aguardandoCorrecao = true;
    this.cdr.markForCheck();
    
    const tempoResposta = Date.now() - this.tempoInicio;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    const body = {
      questao_id: this.questaoAtual.id,
      resposta_escolhida: this.respostaSelecionada,
      tempo_resposta: Math.floor(tempoResposta / 1000) // em segundos
    };

    this.http.post<RespostaResultado>('http://localhost:3000/api/resposta', body, { headers })
    .subscribe({
      next: (data) => {
        this.resultado = data;
        this.mostrandoResultado = true;
        
        // Atualizar estatísticas
        this.totalRespondidas++;
        if (data.correta) {
          this.corretas++;
        } else {
          this.incorretas++;
        }
        this.aguardandoCorrecao = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao submeter resposta:', error);
        this.aguardandoCorrecao = false;
        this.cdr.markForCheck();
      }
    });
  }

  finalizarSessao() {
    if (!this.sessaoId) return;
    
    const tempoTotal = Math.floor((Date.now() - this.tempoInicio) / 1000);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.put(`http://localhost:3000/api/sessao/${this.sessaoId}/finalizar`, 
      { tempo_total: tempoTotal }, 
      { headers }
    )
    .subscribe({
      next: (data: any) => {
        alert(`Sessão finalizada!\n\nEstatísticas:\nTotal de questões: ${data.estatisticas.total_questoes}\nCorretas: ${data.estatisticas.questoes_corretas}\nIncorretas: ${data.estatisticas.questoes_incorretas}\nPercentual de acerto: ${data.estatisticas.percentual_acerto}%`);
        
        // Parar timer e resetar estado
        this.pararTimer();
        this.resetarSessao();
        this.carregarHistoricoSessoes();
      },
      error: (error) => {
        console.error('Erro ao finalizar sessão:', error);
      }
    });
  }

  resetarSessao() {
    this.pararTimer();
    this.questoes = [];
    this.questaoAtual = null;
    this.questaoIndex = 0;
    this.respostaSelecionada = '';
    this.materiaSelecionada = '';
    this.mostrandoResultado = false;
    this.resultado = null;
    this.sessaoId = null;
    this.tempoDecorrido = '00:00';
    this.nenhumaQuestaoEncontrada = false;
    this.competenciaSelecionada = null;
    this.dificuldadeSelecionada = null;
    this.resetarContadores();
    this.voltarParaDashboard();
  }

  resetarContadores() {
    this.totalRespondidas = 0;
    this.corretas = 0;
    this.incorretas = 0;
  }

  carregarHistoricoSessoes() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<{sessoes: any[]}>('http://localhost:3000/api/sessoes?limite=5', {
      headers
    })
    .subscribe({
      next: (data) => {
        this.sessoesEstudo = data.sessoes;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar histórico:', error);
      }
    });
  }

  getPercentualAcerto(): number {
    if (this.totalRespondidas === 0) return 0;
    return Math.round((this.corretas / this.totalRespondidas) * 100);
  }

  iniciarTimer() {
    // Parar timer anterior se existir
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    
    // Iniciar novo timer que atualiza a cada segundo
    this.timerSubscription = interval(1000).subscribe(() => {
      this.atualizarTempoDecorrido();
    });
  }

  pararTimer() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }

  atualizarTempoDecorrido() {
    if (!this.tempoInicio) {
      this.tempoDecorrido = '00:00';
      return;
    }
    
    const segundos = Math.floor((Date.now() - this.tempoInicio) / 1000);
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;
    
    this.tempoDecorrido = `${minutos.toString().padStart(2, '0')}:${segundosRestantes.toString().padStart(2, '0')}`;
    this.cdr.markForCheck();
  }

  getTempoDecorrido(): string {
    return this.tempoDecorrido;
  }

  getAlternativa(questao: Questao, indice: number): string {
    const alternativas = [questao.alt_a, questao.alt_b, questao.alt_c, questao.alt_d, questao.alt_e];
    return alternativas[indice] || '';
  }

  getLetraAlternativa(indice: number): string {
    const letras = ['A', 'B', 'C', 'D', 'E'];
    return letras[indice] || '';
  }

  // Métodos para filtro de dificuldade
  selecionarDificuldade(dificuldade: string) {
    this.dificuldadeSelecionada = dificuldade;
    this.recarregarQuestoes();
  }

  limparFiltroDificuldade() {
    this.dificuldadeSelecionada = null;
    this.recarregarQuestoes();
  }

  getDificuldadeMedia(): number | undefined {
    if (!this.dificuldadeSelecionada) return undefined;
    
    const opcao = this.opcoesDificuldade.find(op => op.value === this.dificuldadeSelecionada);
    if (!opcao) return undefined;
    
    // Retorna o valor médio do range
    return (opcao.min + opcao.max) / 2;
  }

  recarregarQuestoes() {
    if (this.competenciaSelecionada) {
      this.carregarQuestoesPorCompetencia();
    } else {
      this.carregarQuestoes();
    }
  }

  voltarParaDashboard() {
    this.router.navigate(['/painel-usuario/']);
  }
}
