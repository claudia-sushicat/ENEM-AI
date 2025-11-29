import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-cadastro',
  imports: [
    CommonModule, 
    FormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './cadastro.html',
  styleUrl: './autenticacao.css'
})
export class Cadastro {

  nome = '';
  email = '';
  senha = '';
  confirmarSenha = '';
  carregando = false;
  erro = '';
  sucesso = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    // Validações
    if (!this.nome || !this.email || !this.senha || !this.confirmarSenha) {
      this.erro = 'Todos os campos são obrigatórios';
      return;
    }

    if (this.senha.length < 6) {
      this.erro = 'A senha deve ter pelo menos 6 caracteres';
      return;
    }

    if (this.senha !== this.confirmarSenha) {
      this.erro = 'As senhas não coincidem';
      return;
    }

    this.carregando = true;
    this.erro = '';
    this.sucesso = '';

    this.authService.cadastrar(this.nome, this.email, this.senha).subscribe({
      next: (response) => {
        console.log('Cadastro realizado com sucesso:', response);
        this.sucesso = 'Cadastro realizado com sucesso! Redirecionando...';
        setTimeout(() => {
          this.router.navigate(['/painel-usuario']);
        }, 200);
      },
      error: (error) => {
        console.error('Erro no cadastro:', error);
        this.erro = error.error?.erro || 'Erro ao realizar cadastro';
        this.carregando = false;
      }
    });
  }

  irParaLogin() {
    this.router.navigate(['/login']);
  }
}
