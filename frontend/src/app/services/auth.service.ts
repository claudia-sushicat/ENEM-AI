import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
}

export interface LoginResponse {
  mensagem: string;
  usuario: Usuario;
  token: string;
}

export interface CadastroResponse {
  mensagem: string;
  usuario: Usuario;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api';
  private readonly TOKEN_KEY = 'token_usuario';
  
  private usuarioSubject = new BehaviorSubject<Usuario | null>(null);
  public usuario$ = this.usuarioSubject.asObservable();

  constructor(private http: HttpClient) {
    // Verificar se há token salvo ao inicializar o serviço
    this.verificarTokenSalvo();
  }

  // Cadastrar novo usuário
  cadastrar(nome: string, email: string, senha: string): Observable<CadastroResponse> {
    return this.http.post<CadastroResponse>(`${this.API_URL}/cadastro`, {
      nome,
      email,
      senha
    }).pipe(
      tap(response => {
        this.salvarToken(response.token);
        this.usuarioSubject.next(response.usuario);
      })
    );
  }

  // Fazer login
  login(email: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, {
      email,
      senha
    }).pipe(
      tap(response => {
        this.salvarToken(response.token);
        this.usuarioSubject.next(response.usuario);
      })
    );
  }

  // Fazer logout
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.usuarioSubject.next(null);
  }

  // Verificar se o usuário está logado
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Verificar se o token não expirou 
    try {
      // Decodificar o JWT para verificar se não expirou
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      if (payload.exp && payload.exp < currentTime) {
        // Token expirado
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      // Token inválido
      this.logout();
      return false;
    }
  }

  // Obter token do localStorage
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Salvar token no localStorage
  private salvarToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  // Verificar token salvo e obter dados do usuário
  private verificarTokenSalvo(): void {
    const token = this.getToken();
    if (token) {
      this.verificarToken().subscribe({
        next: (response) => {
          if (response.valido) {
            // Buscar dados completos do usuário
            this.obterUsuario().subscribe({
              next: (userData) => {
                this.usuarioSubject.next(userData.usuario);
              },
              error: () => {
                this.logout();
              }
            });
          } else {
            this.logout();
          }
        },
        error: () => {
          this.logout();
        }
      });
    }
  }

  // Verificar se o token é válido
  verificarToken(): Observable<{valido: boolean, usuario: {id: number, email: string}}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });
    
    return this.http.get<{valido: boolean, usuario: {id: number, email: string}}>(
      `${this.API_URL}/verificar-token`,
      { headers }
    );
  }

  // Obter dados do usuário logado
  obterUsuario(): Observable<{usuario: Usuario}> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`
    });
    
    return this.http.get<{usuario: Usuario}>(`${this.API_URL}/usuario`, { headers });
  }

  // Obter usuário atual (síncrono)
  getUsuarioAtual(): Usuario | null {
    return this.usuarioSubject.value;
  }
}
