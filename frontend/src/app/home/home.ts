import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterModule, ButtonModule],
  templateUrl: './home.html'
})
export class Home implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    // Se o usuário já está logado, redirecionar para o painel
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/painel-usuario']);
    }
  }
}
