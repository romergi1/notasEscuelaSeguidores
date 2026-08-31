import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlumnoService } from '../services/alumno.service';

@Component({
  selector: 'app-search',
  imports: [FormsModule],
  templateUrl: './search.html'
})
export class Search {
  private service = inject(AlumnoService);
  private router = inject(Router);

  correo = signal('');
  modulo = signal('');
  loading = signal(false);
  errorMsg = signal('');

  buscar(): void {
    this.errorMsg.set('');

    const correo = this.correo().trim();
    const modulo = this.modulo();

    if (!correo) {
      this.errorMsg.set('Por favor ingresa un correo electrónico.');
      return;
    }
    if (!modulo) {
      this.errorMsg.set('Por favor selecciona un módulo.');
      return;
    }

    this.loading.set(true);
    this.service.consultar(correo, modulo).subscribe({
      next: (res) => {
        this.loading.set(false);
        // Enviamos los datos a la página de resultados por el estado del router
        this.router.navigate(['/resultados'], {
          state: { data: res, correo, modulo }
        });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.errorMsg.set('Alumno no existe.');
        } else if (err.error && err.error.error) {
          this.errorMsg.set(err.error.error);
        } else {
          this.errorMsg.set('Ocurrió un error al consultar. Intenta nuevamente.');
        }
      }
    });
  }
}
