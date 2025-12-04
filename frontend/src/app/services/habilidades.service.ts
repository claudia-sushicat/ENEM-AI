import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Competencia {
  id: number;
  numero: number;
  descricao: string;
}

export interface Habilidade {
  id: number;
  numero: number;
  descricao: string;
  competencia_numero: number;
  competencia_descricao: string;
}

export interface ProgressoHabilidade {
  id: number;
  numero: number;
  descricao: string;
  competencia_numero: number;
  competencia_descricao: string;
  total_questoes: number;
  questoes_corretas: number;
  taxa_acerto: number;
}

export interface ProgressoCompetencia {
  id: number;
  numero: number;
  descricao: string;
  total_questoes_disponiveis: number;
  total_questoes: number;
  questoes_corretas: number;
  taxa_acerto: number;
}

export interface QuestaoComHabilidade {
  id: number;
  materia: string;
  posicao: number;
  cod_questao: string;
  habilidade: number;
  lingua: string;
  dificuldade: number;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  alt_e: string;
  habilidade_descricao: string;
  competencia_numero: number;
}

@Injectable({
  providedIn: 'root'
})
export class HabilidadesService {
  private readonly API_URL = 'http://localhost:3000/api';
  private readonly authService = inject(AuthService);

  constructor(private http: HttpClient) {}

  // Obter competências de uma matéria
  obterCompetencias(materia: string): Observable<{competencias: Competencia[]}> {
    return this.http.get<{competencias: Competencia[]}>(`${this.API_URL}/competencias/${materia}`);
  }

  // Obter habilidades de uma matéria
  obterHabilidades(materia: string): Observable<{habilidades: Habilidade[]}> {
    return this.http.get<{habilidades: Habilidade[]}>(`${this.API_URL}/habilidades/${materia}`);
  }

  // Obter progresso por habilidades de um usuário
  obterProgressoHabilidades(materia: string): Observable<{progresso_habilidades: ProgressoHabilidade[]}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<{progresso_habilidades: ProgressoHabilidade[]}>(
      `${this.API_URL}/progresso-habilidades/${materia}`,
      { headers }
    );
  }

  // Obter questões por habilidade específica
  obterQuestoesPorHabilidade(materia: string, habilidadeId: number, limit: number = 10, offset: number = 0, dificuldade?: number): Observable<{questoes: QuestaoComHabilidade[]}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });

    let url = `${this.API_URL}/questoes/${materia}/habilidade/${habilidadeId}?limit=${limit}&offset=${offset}`;
    if (dificuldade) {
      url += `&dificuldade=${dificuldade}`;
    }

    return this.http.get<{questoes: QuestaoComHabilidade[]}>(url, { headers });
  }

  // Obter progresso por competências de um usuário
  obterProgressoCompetencias(materia: string): Observable<{progresso_competencias: ProgressoCompetencia[]}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.get<{progresso_competencias: ProgressoCompetencia[]}>(
      `${this.API_URL}/progresso-competencias/${materia}`,
      { headers }
    );
  }

  // Obter questões por competência específica
  obterQuestoesPorCompetencia(materia: string, competenciaId: number, limit: number = 10, offset: number = 0, dificuldade?: number): Observable<{questoes: QuestaoComHabilidade[]}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });

    let url = `${this.API_URL}/questoes/${materia}/competencia/${competenciaId}?limit=${limit}&offset=${offset}`;
    if (dificuldade) {
      url += `&dificuldade=${dificuldade}`;
    }

    return this.http.get<{questoes: QuestaoComHabilidade[]}>(url, { headers });
  }

  // Obter token do localStorage
  private getToken(): string | null {
    return this.authService.getToken();
  }

  // Mapear códigos de matéria para nomes amigáveis
  getNomeMateria(codigo: string): string {
    const mapeamento: {[key: string]: string} = {
      'LC': 'Linguagens e Códigos',
      'MT': 'Matemática',
      'CN': 'Ciências da Natureza',
      'CH': 'Ciências Humanas'
    };
    return mapeamento[codigo] || codigo;
  }

  // Obter cor baseada na taxa de acerto
  getCorTaxaAcerto(taxa: number): string {
    if (taxa >= 80) return '#27ae60'; // Verde
    if (taxa >= 60) return '#f39c12'; // Laranja
    if (taxa >= 40) return '#e67e22'; // Laranja escuro
    return '#e74c3c'; // Vermelho
  }

  // Obter texto baseado na taxa de acerto
  getTextoTaxaAcerto(taxa: number): string {
    if (taxa >= 80) return 'Excelente';
    if (taxa >= 60) return 'Bom';
    if (taxa >= 40) return 'Regular';
    return 'Precisa melhorar';
  }

  // Obter ícone baseado na taxa de acerto
  getIconeTaxaAcerto(taxa: number): string {
    if (taxa >= 80) return '🎯';
    if (taxa >= 60) return '👍';
    if (taxa >= 40) return '⚠️';
    return '📚';
  }
}
