import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="app-shell px-3 py-4">
      <header class="mb-4 text-center position-relative">
        <h1 class="brand-title h3 mb-1">Consulta de Notas · Seguidores</h1>
        <p class="text-secondary mb-0">Ingresa tu correo y elige tu módulo para ver tus resultados.</p>
        <a routerLink="/admin" class="small text-secondary d-inline-block mt-2">Administración</a>
      </header>
      <router-outlet></router-outlet>
    </div>
  `
})
export class App {}
