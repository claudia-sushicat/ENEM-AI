import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';

interface Disciplina {
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ButtonModule],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard {
  readonly disciplinas: Disciplina[] = [
    {
      nome: 'Ciências Humanas',
      descricao: 'História, Geografia, Filosofia e Sociologia',
      icone: 'user',
      cor: '#8B5CF6'
    },
    {
      nome: 'Matématica',
      descricao: 'Matemática',
      icone: 'calculator',
      cor: '#06B6D4'
    },
    {
      nome: 'Ciências da Natureza',
      descricao: 'Biologia e Química e Física',
      icone: 'globe',
      cor: '#10B981'
    },
    {
      nome: 'Línguas',
      descricao: 'Português, Literatura e Línguas Estrangeiras',
      icone: 'book',
      cor: '#F59E0B'
    },
    {
      nome: 'Redação',
      descricao: 'Técnicas de escrita e produção textual',
      icone: 'pen-to-square',
      cor: '#EF4444'
    }
  ];

  readonly disciplinasPrincipais = this.disciplinas.filter(({ nome }) => nome !== 'Redação');
  readonly redacao = this.disciplinas.find(({ nome }) => nome === 'Redação');

  constructor(private router: Router) {}

  navegarParaQuestoes(materia: string) {
    if (materia === 'Redação') {
      this.router.navigate(['/painel-usuario/redacao']);
      return;
    }

    // Mapear nomes das disciplinas para códigos das matérias
    const mapeamento: { [key: string]: string } = {
      'Ciências Humanas': 'CH',
      'Matématica': 'MT',
      'Ciências da Natureza': 'CN',
      'Línguas': 'LC',
      'Redação': 'RD'
    };
    
    const codigoMateria = mapeamento[materia] || materia;
    this.router.navigate(['/painel-usuario/questoes'], { 
      queryParams: { materia: codigoMateria } 
    });
  }
}
