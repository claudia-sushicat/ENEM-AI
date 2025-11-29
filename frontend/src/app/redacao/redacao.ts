import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { PanelModule } from 'primeng/panel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DividerModule } from 'primeng/divider';

import {
  AvaliacaoRedacao,
  HistoricoRedacao,
  RedacaoService,
  TemaRedacao
} from '../services/redacao.service';

@Component({
  selector: 'app-redacao',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TextareaModule,
    CardModule,
    TagModule,
    PanelModule,
    ProgressSpinnerModule,
    DividerModule
  ],
  templateUrl: './redacao.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RedacaoComponent implements OnInit {
  private readonly redacaoService = inject(RedacaoService);
  private readonly cdr = inject(ChangeDetectorRef);

  temas: TemaRedacao[] = [];
  temaSelecionado: TemaRedacao | null = null;
  temaPersonalizado: string = '';
  textoRedacao: string = '';

  carregandoTemas = false;
  carregandoHistorico = false;
  corrigindo = false;

  avaliacao: AvaliacaoRedacao | null = null;
  historico: HistoricoRedacao[] = [];

  erroTemas: string | null = null;
  erroCorrecao: string | null = null;

  readonly minimoPalavras = 80;
  readonly maximoPalavras = 1200;

  ngOnInit() {
    this.carregarTemas();
    this.carregarHistorico();
  }

  carregarTemas() {
    this.carregandoTemas = true;
    this.erroTemas = null;
    this.redacaoService.gerarTemas().subscribe({
      next: ({ temas }) => {
        this.temas = temas;
        this.temaSelecionado = temas[0] || null;
        this.carregandoTemas = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.erroTemas = error?.error?.erro || 'Não foi possível gerar os temas agora.';
        this.carregandoTemas = false;
        this.cdr.markForCheck();
      }
    });
  }

  carregarHistorico() {
    this.carregandoHistorico = true;
    this.redacaoService.listarHistorico().subscribe({
      next: ({ historico }) => {
        this.historico = historico;
        this.carregandoHistorico = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.carregandoHistorico = false;
        this.cdr.markForCheck();
      }
    });
  }

  selecionarTema(tema: TemaRedacao) {
    this.temaSelecionado = tema;
    this.temaPersonalizado = '';
  }

  get totalPalavras(): number {
    if (!this.textoRedacao.trim()) {
      return 0;
    }
    return this.textoRedacao
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  get progressoPalavras(): number {
    return Math.min(100, Math.floor((this.totalPalavras / this.maximoPalavras) * 100));
  }

  get temaAtual(): string {
    if (this.temaPersonalizado.trim()) {
      return this.temaPersonalizado.trim();
    }
    return this.temaSelecionado ? this.temaSelecionado.titulo : '';
  }

  podeCorrigir(): boolean {
    return (
      !this.corrigindo &&
      !!this.temaAtual &&
      this.totalPalavras >= this.minimoPalavras &&
      this.totalPalavras <= this.maximoPalavras
    );
  }

  corrigirRedacao() {
    this.erroCorrecao = null;

    const tema = this.temaAtual;
    if (!tema) {
      this.erroCorrecao = 'Informe o tema para a correção.';
      return;
    }

    if (this.totalPalavras < this.minimoPalavras) {
      this.erroCorrecao = `A redação precisa ter pelo menos ${this.minimoPalavras} palavras.`;
      return;
    }

    if (this.totalPalavras > this.maximoPalavras) {
      this.erroCorrecao = `A redação deve ter no máximo ${this.maximoPalavras} palavras.`;
      return;
    }

    this.corrigindo = true;
    this.avaliacao = null;

    this.redacaoService
      .corrigirRedacao({
        tema,
        texto: this.textoRedacao.trim()
      })
      .subscribe({
        next: (avaliacao) => {
          this.avaliacao = avaliacao;
          this.corrigindo = false;
          this.carregarHistorico();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.erroCorrecao = error?.error?.erro || 'Não foi possível corrigir a redação.';
          this.corrigindo = false;
          this.cdr.markForCheck();
        }
      });
  }

  getMensagemResumoTema(tema: TemaRedacao): string {
    return tema.problematica || tema.descricao || '';
  }

  getClasseNota(nota: number): string {
    if (nota >= 160) return 'text-green-600';
    if (nota >= 120) return 'text-amber-500';
    if (nota >= 80) return 'text-orange-500';
    return 'text-red-500';
  }
}

