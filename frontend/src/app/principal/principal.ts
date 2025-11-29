import { Component, OnInit } from '@angular/core';
import { Menu } from "../menu/menu";
import { RouterModule, Router } from '@angular/router';
import { AuthService, Usuario } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-principal',
  imports: [RouterModule, Menu, CommonModule],
  templateUrl: './principal.html',
  styleUrl: './principal.css'
})
export class Principal implements OnInit {

  usuario: Usuario | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Obter dados do usuário
    this.authService.usuario$.subscribe(usuario => {
      this.usuario = usuario;
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
