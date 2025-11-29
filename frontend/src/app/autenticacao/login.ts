import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule, 
    FormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './login.html',
  styleUrl: './autenticacao.css'
})
export class Login {

  email = '';
  senha = '';
  carregando = false;
  erro = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.email || !this.senha) {
      this.erro = 'Email e senha são obrigatórios';
      return;
    }

    this.carregando = true;
    this.erro = '';

    this.authService.login(this.email, this.senha).subscribe({
      next: (response) => {
        console.log('Login realizado com sucesso:', response);
        this.router.navigate(['/painel-usuario']);
      },
      error: (error) => {
        console.error('Erro no login:', error);
        this.erro = error.error?.erro || 'Erro ao fazer login';
        this.carregando = false;
      }
    });
  }

  irParaCadastro() {
    this.router.navigate(['/cadastro']);
  }

  irParaEsqueciSenha() {
    this.router.navigate(['/esqueci-senha']);
  }
}
