import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-reset-senha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>🔐 Redefinir Senha</h1>
          <p *ngIf="!tokenValido && !verificandoToken">Token inválido ou expirado</p>
          <p *ngIf="tokenValido">Crie uma nova senha para sua conta</p>
        </div>

        <!-- Loading -->
        <div class="loading" *ngIf="verificandoToken">
          <div class="spinner"></div>
          <p>Verificando token...</p>
        </div>

        <!-- Formulário de Reset -->
        <form (ngSubmit)="resetarSenha()" [class.submitting]="enviando" *ngIf="tokenValido && !sucesso">
          <div class="form-group">
            <label for="novaSenha">Nova Senha</label>
            <input 
              type="password" 
              id="novaSenha" 
              [(ngModel)]="novaSenha" 
              name="novaSenha"
              placeholder="Digite sua nova senha"
              required
              [disabled]="enviando"
              class="form-input"
              [class.error]="erroNovaSenha"
              (input)="validarSenha()">
            <div class="error-message" *ngIf="erroNovaSenha">{{ erroNovaSenha }}</div>
            <div class="password-strength" *ngIf="novaSenha && !erroNovaSenha">
              <div class="strength-bar">
                <div class="strength-fill" [style.width.%]="getForcaSenha()" [class]="getClasseForcaSenha()"></div>
              </div>
              <span class="strength-text">{{ getTextoForcaSenha() }}</span>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmarSenha">Confirmar Senha</label>
            <input 
              type="password" 
              id="confirmarSenha" 
              [(ngModel)]="confirmarSenha" 
              name="confirmarSenha"
              placeholder="Confirme sua nova senha"
              required
              [disabled]="enviando"
              class="form-input"
              [class.error]="erroConfirmarSenha"
              (input)="validarConfirmacaoSenha()">
            <div class="error-message" *ngIf="erroConfirmarSenha">{{ erroConfirmarSenha }}</div>
          </div>

          <button 
            type="submit" 
            class="btn-primary"
            [disabled]="enviando || !senhasValidas()">
            <span *ngIf="!enviando">Redefinir Senha</span>
            <span *ngIf="enviando">Redefinindo...</span>
          </button>
        </form>

        <!-- Sucesso -->
        <div class="success-message" *ngIf="sucesso">
          <div class="success-icon">✅</div>
          <h3>Senha redefinida com sucesso!</h3>
          <p>Sua senha foi alterada com sucesso. Agora você pode fazer login com sua nova senha.</p>
          <button class="btn-primary" (click)="irParaLogin()">
            Ir para Login
          </button>
        </div>

        <!-- Erro -->
        <div class="error-message" *ngIf="erro">
          <div class="error-icon">❌</div>
          <h3>Erro ao redefinir senha</h3>
          <p>{{ erro }}</p>
          <button class="btn-secondary" (click)="irParaEsqueciSenha()">
            Solicitar novo link
          </button>
        </div>

        <!-- Token Inválido -->
        <div class="error-message" *ngIf="!tokenValido && !verificandoToken">
          <div class="error-icon">⚠️</div>
          <h3>Link inválido ou expirado</h3>
          <p>Este link de redefinição de senha é inválido ou já expirou.</p>
          <button class="btn-primary" (click)="irParaEsqueciSenha()">
            Solicitar novo link
          </button>
        </div>

        <div class="auth-footer" *ngIf="tokenValido && !sucesso">
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

    .loading {
      text-align: center;
      padding: 40px 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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

    .password-strength {
      margin-top: 8px;
    }

    .strength-bar {
      width: 100%;
      height: 4px;
      background-color: #e9ecef;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 5px;
    }

    .strength-fill {
      height: 100%;
      transition: all 0.3s ease;
    }

    .strength-fill.weak {
      background-color: #e74c3c;
    }

    .strength-fill.medium {
      background-color: #f39c12;
    }

    .strength-fill.strong {
      background-color: #27ae60;
    }

    .strength-text {
      font-size: 12px;
      color: #7f8c8d;
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

    .btn-secondary {
      width: 100%;
      padding: 15px;
      background: transparent;
      color: #667eea;
      border: 2px solid #667eea;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 20px;
    }

    .btn-secondary:hover {
      background: #667eea;
      color: white;
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
      margin: 0 0 20px 0;
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
      margin: 0 0 20px 0;
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
export class ResetSenhaComponent implements OnInit {
  token: string = '';
  novaSenha: string = '';
  confirmarSenha: string = '';
  enviando: boolean = false;
  verificandoToken: boolean = true;
  tokenValido: boolean = false;
  sucesso: boolean = false;
  erro: string = '';
  erroNovaSenha: string = '';
  erroConfirmarSenha: string = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.verificarToken();
      } else {
        this.verificandoToken = false;
        this.tokenValido = false;
      }
    });
  }

  verificarToken() {
    this.http.get<any>(`http://localhost:3000/api/verify-reset-token/${this.token}`)
      .subscribe({
        next: (response) => {
          this.verificandoToken = false;
          this.tokenValido = response.valido;
        },
        error: (error) => {
          this.verificandoToken = false;
          this.tokenValido = false;
          this.erro = error.error?.erro || 'Erro ao verificar token';
        }
      });
  }

  resetarSenha() {
    this.limparErros();
    
    if (!this.validarSenhas()) {
      return;
    }

    this.enviando = true;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    this.http.post<any>('http://localhost:3000/api/reset-password', 
      { 
        token: this.token,
        novaSenha: this.novaSenha,
        confirmarSenha: this.confirmarSenha
      }, 
      { headers }
    ).subscribe({
      next: (response) => {
        this.enviando = false;
        this.sucesso = true;
      },
      error: (error) => {
        this.enviando = false;
        this.erro = error.error?.erro || 'Erro ao redefinir senha. Tente novamente.';
      }
    });
  }

  validarSenhas(): boolean {
    let valido = true;

    if (!this.validarSenha()) {
      valido = false;
    }

    if (!this.validarConfirmacaoSenha()) {
      valido = false;
    }

    return valido;
  }

  validarSenha(): boolean {
    this.erroNovaSenha = '';
    
    if (!this.novaSenha) {
      this.erroNovaSenha = 'Nova senha é obrigatória';
      return false;
    }

    if (this.novaSenha.length < 6) {
      this.erroNovaSenha = 'A senha deve ter pelo menos 6 caracteres';
      return false;
    }

    return true;
  }

  validarConfirmacaoSenha(): boolean {
    this.erroConfirmarSenha = '';
    
    if (!this.confirmarSenha) {
      this.erroConfirmarSenha = 'Confirmação de senha é obrigatória';
      return false;
    }

    if (this.novaSenha !== this.confirmarSenha) {
      this.erroConfirmarSenha = 'As senhas não coincidem';
      return false;
    }

    return true;
  }

  senhasValidas(): boolean {
    return this.novaSenha.length >= 6 && 
           this.confirmarSenha.length >= 6 && 
           this.novaSenha === this.confirmarSenha;
  }

  getForcaSenha(): number {
    if (!this.novaSenha) return 0;
    
    let forca = 0;
    if (this.novaSenha.length >= 6) forca += 20;
    if (this.novaSenha.length >= 8) forca += 20;
    if (/[a-z]/.test(this.novaSenha)) forca += 20;
    if (/[A-Z]/.test(this.novaSenha)) forca += 20;
    if (/[0-9]/.test(this.novaSenha)) forca += 20;
    
    return forca;
  }

  getClasseForcaSenha(): string {
    const forca = this.getForcaSenha();
    if (forca < 40) return 'weak';
    if (forca < 80) return 'medium';
    return 'strong';
  }

  getTextoForcaSenha(): string {
    const forca = this.getForcaSenha();
    if (forca < 40) return 'Senha fraca';
    if (forca < 80) return 'Senha média';
    return 'Senha forte';
  }

  limparErros() {
    this.erro = '';
    this.erroNovaSenha = '';
    this.erroConfirmarSenha = '';
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }

  irParaEsqueciSenha() {
    this.router.navigate(['/esqueci-senha']);
  }
}
