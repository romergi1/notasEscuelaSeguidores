import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="app-shell px-3 py-4">
      <header class="mb-4 text-center">
        <h1 class="brand-title h3 mb-1">Consulta de Notas · Seguidores</h1>
        <p class="text-secondary mb-0">Ingresa tu correo y elige tu módulo para ver tus resultados.</p>
      </header>
      <router-outlet></router-outlet>
    </div>
  `
})
export class App {}
