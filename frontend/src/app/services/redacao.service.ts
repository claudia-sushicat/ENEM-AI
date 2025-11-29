import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface TextoApoio {
  titulo: string;
  tipo: string;
  conteudo: string;
  fonte: string;
}

export interface TemaRedacao {
  id: string;
  titulo: string;
  descricao: string;
  problematica: string;
  diretrizes_intervencao: string;
  textos_apoio: TextoApoio[];
}

export interface CompetenciaAvaliacao {
  numero: number;
  titulo: string;
  nota: number;
  justificativa: string;
  erros: string[];
  observacoes: string;
  trechos_citados: string[];
}

export interface AvaliacaoRedacao {
  avaliacao_id: number;
  tema: string;
  total_palavras: number;
  competencias: CompetenciaAvaliacao[];
  nota_final: number;
  comentarios_gerais: string;
  sugestoes: string[];
  criado_em: string;
}

export interface HistoricoRedacao {
  id: number;
  tema: string;
  nota_total: number;
  total_palavras: number;
  comentarios_gerais: string;
  created_at: string;
  competencias: CompetenciaAvaliacao[];
  sugestoes: string[];
}

export interface CorrigirRedacaoPayload {
  tema: string;
  texto: string;
}

@Injectable({
  providedIn: 'root'
})
export class RedacaoService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  gerarTemas(): Observable<{ temas: TemaRedacao[] }> {
    return this.http.get<{ temas: TemaRedacao[] }>(`${this.API_URL}/redacao/temas`, {
      headers: this.criarHeaders()
    });
  }

  corrigirRedacao(payload: CorrigirRedacaoPayload): Observable<AvaliacaoRedacao> {
    return this.http.post<AvaliacaoRedacao>(`${this.API_URL}/redacao/corrigir`, payload, {
      headers: this.criarHeaders()
    });
  }

  listarHistorico(limite: number = 5): Observable<{ historico: HistoricoRedacao[] }> {
    return this.http.get<{ historico: HistoricoRedacao[] }>(
      `${this.API_URL}/redacao/historico?limite=${limite}`,
      {
        headers: this.criarHeaders()
      }
    );
  }

  private criarHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getToken()}`
    });
  }
}


