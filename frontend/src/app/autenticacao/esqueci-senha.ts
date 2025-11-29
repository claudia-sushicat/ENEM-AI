import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-esqueci-senha',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>Esqueci minha senha</h1>
          <p>Digite seu email para receber um link de redefinição</p>
        </div>

        <form (ngSubmit)="solicitarReset()" [class.submitting]="enviando">
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              [(ngModel)]="email" 
              name="email"
              placeholder="Digite seu email"
              required
              [disabled]="enviando"
              class="form-input"
              [class.error]="erroEmail">
            <div class="error-message" *ngIf="erroEmail">{{ erroEmail }}</div>
          </div>

          <p-button 
            type="submit" 
            styleClass="w-full"
            [disabled]="enviando || !email">
            <span *ngIf="!enviando">Enviar Link de Redefinição</span>
            <span *ngIf="enviando">Enviando...</span>
          </p-button >
        </form>

        <div class="success-message" *ngIf="sucesso">
          <div class="success-icon">✅</div>
          <h3>Email enviado com sucesso!</h3>
          <p>{{ mensagemSucesso }}</p>
          <p class="info-text">
            Verifique sua caixa de entrada e também a pasta de spam.
          </p>
        </div>

        <div class="error-message" *ngIf="erro">
          <div class="error-icon">❌</div>
          <h3>Erro ao enviar email</h3>
          <p>{{ erro }}</p>
        </div>

        <div class="auth-footer">
          <p>
            Lembrou da senha? 
            <a routerLink="/login" class="auth-link">Fazer login</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .auth-card {
      background: white;
      border-radius: 15px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 450px;
    }

    .auth-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .auth-header h1 {
      color: #2c3e50;
      margin: 0 0 10px 0;
      font-size: 28px;
    }

    .auth-header p {
      color: #7f8c8d;
      margin: 0;
      font-size: 16px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #2c3e50;
      font-weight: 600;
    }

    .form-input {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error {
      border-color: #e74c3c;
    }

    .form-input:disabled {
      background-color: #f8f9fa;
      cursor: not-allowed;
    }

    .btn-primary {
      width: 100%;
      padding: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 20px;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .success-message {
      text-align: center;
      padding: 20px;
      background: #d5f4e6;
      border: 1px solid #27ae60;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .success-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .success-message h3 {
      color: #27ae60;
      margin: 0 0 10px 0;
    }

    .success-message p {
      color: #2c3e50;
      margin: 0 0 10px 0;
    }

    .info-text {
      color: #7f8c8d !important;
      font-size: 14px;
    }

    .error-message {
      text-align: center;
      padding: 20px;
      background: #fdeaea;
      border: 1px solid #e74c3c;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .error-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .error-message h3 {
      color: #e74c3c;
      margin: 0 0 10px 0;
    }

    .error-message p {
      color: #2c3e50;
      margin: 0;
    }

    .auth-footer {
      text-align: center;
      margin-top: 20px;
    }

    .auth-footer p {
      color: #7f8c8d;
      margin: 0;
    }

    .auth-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .auth-link:hover {
      text-decoration: underline;
    }

    .submitting .form-input {
      opacity: 0.7;
    }

    @media (max-width: 480px) {
      .auth-card {
        padding: 30px 20px;
      }
      
      .auth-header h1 {
        font-size: 24px;
      }
    }
  `]
})
export class EsqueciSenhaComponent {
  email: string = '';
  enviando: boolean = false;
  sucesso: boolean = false;
  erro: string = '';
  erroEmail: string = '';
  mensagemSucesso: string = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  solicitarReset() {
    this.limparErros();
    
    if (!this.validarEmail()) {
      return;
    }

    this.enviando = true;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    this.http.post<any>('http://localhost:3000/api/forgot-password', 
      { email: this.email }, 
      { headers }
    ).subscribe({
      next: (response) => {
        this.enviando = false;
        this.sucesso = true;
        this.mensagemSucesso = response.mensagem;
      },
      error: (error) => {
        this.enviando = false;
        this.erro = error.error?.erro || 'Erro ao enviar email. Tente novamente.';
      }
    });
  }

  validarEmail(): boolean {
    this.erroEmail = '';
    
    if (!this.email) {
      this.erroEmail = 'Email é obrigatório';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.erroEmail = 'Formato de email inválido';
      return false;
    }

    return true;
  }

  limparErros() {
    this.erro = '';
    this.erroEmail = '';
  }
}
