import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { AuthService, Usuario } from '../services/auth.service';

@Component({
  selector: 'app-menu',
  imports: [ButtonModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css'
})
export class Menu implements OnInit {

  logado = false;
  usuario: Usuario | null = null;

  constructor(
    private router: Router,
    private authService: AuthService) {}

  ngOnInit() {
    this.authService.usuario$.subscribe(usuario => {
      if (this.authService.isLoggedIn()) {
        this.logado = true;
        this.router.navigate(['/painel-usuario']);
        this.usuario = usuario;
      }
    });
  }

  logout() {
    this.authService.logout();
    this.logado = false;
    this.usuario = null;
    this.router.navigate(['/']);
  }

  cadastro() {
    this.router.navigate(['/cadastro']);
  }

  login() {
    this.router.navigate(['/login']);
  }

  
}
