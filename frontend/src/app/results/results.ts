import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlumnoResponse } from '../services/alumno.service';

@Component({
  selector: 'app-results',
  imports: [],
  templateUrl: './results.html'
})
export class Results {
  private router = inject(Router);

  data = signal<AlumnoResponse | null>(null);
  correo = signal('');
  modulo = signal('');

  private readonly APPROVAL = 7;
  private readonly NOTA_COL = 'NotaFinal';

  constructor() {
    const nav = this.router.getCurrentNavigation();
    const state = (nav?.extras?.state ?? history.state) as {
      data?: AlumnoResponse;
      correo?: string;
      modulo?: string;
    };

    if (state && state.data) {
      this.data.set(state.data);
      this.correo.set(state.correo ?? '');
      this.modulo.set(state.modulo ?? '');
    } else {
      // Si se llega sin datos (recarga directa), volvemos a la búsqueda
      this.router.navigate(['/']);
    }
  }

  headers = computed(() => this.data()?.headers ?? []);
  alumno = computed(() => this.data()?.alumno ?? {});

  notaFinal = computed<number>(() => {
    const value = this.alumno()[this.NOTA_COL];
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  });

  aprobado = computed<boolean>(() => this.notaFinal() >= this.APPROVAL);

  isNotaColumn(header: string): boolean {
    return header === this.NOTA_COL;
  }

  cellValue(header: string): string {
    const value = this.alumno()[header];
    return value === undefined || value === null ? '' : String(value);
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
