import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-painel-usuario',
  imports: [
    CommonModule, 
    FormsModule,
    ButtonModule,
    RouterModule
  ],
  templateUrl: './painel-usuario.html'
})
export class PainelUsuario {

}
