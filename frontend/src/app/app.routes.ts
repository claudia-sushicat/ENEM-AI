import { Routes } from '@angular/router';
import { Principal } from './principal/principal';
import { Cadastro } from './autenticacao/cadastro';
import { Login } from './autenticacao/login';
import { EsqueciSenhaComponent } from './autenticacao/esqueci-senha';
import { ResetSenhaComponent } from './autenticacao/reset-senha';
import { Home } from './home/home';
import { PainelUsuario } from './painel-usuario/painel-usuario';
import { Dashboard } from './dashboard/dashboard';
import { QuestoesComponent } from './questoes/questoes';
import { DashboardIAComponent } from './dashboard-ia/dashboard-ia';
import { RedacaoComponent } from './redacao/redacao';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';

export const routes: Routes = [

    { path: '', component: Principal,
        children: [
            { path: '', component: Home },
            
            { path: 'cadastro', component: Cadastro, canActivate: [GuestGuard] },
            { path: 'login', component: Login, canActivate: [GuestGuard] },
            { path: 'esqueci-senha', component: EsqueciSenhaComponent, canActivate: [GuestGuard] },
            { path: 'reset-password', component: ResetSenhaComponent, canActivate: [GuestGuard] },
            
            { path: 'painel-usuario', component: PainelUsuario, canActivate: [AuthGuard], canActivateChild: [AuthGuard], children: [
                  { path: '', component: Dashboard },
                  { path: 'questoes', component: QuestoesComponent },
                  { path: 'dashboard-ia', component: DashboardIAComponent },
                  { path: 'redacao', component: RedacaoComponent },
            ] },
        ]
    },

];
