import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';

type Vista = 'login' | 'buscar' | 'form';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.html'
})
export class Admin {
  service = inject(AdminService);

  // Campos que se consideran datos personales (mismo criterio que la pantalla de resultados)
  private readonly PERSONALES = ['Apellido', 'Nombre', 'CorreoElectronico'];
  private readonly NOTA_FINAL = 'NotaFinal';

  vista = signal<Vista>(this.service.logueado ? 'buscar' : 'login');

  // --- Login ---
  password = signal('');
  loginError = signal('');

  // --- Búsqueda ---
  correoBusqueda = signal('');
  moduloBusqueda = signal('');
  buscarError = signal('');
  buscarInfo = signal('');

  // --- Formulario (alta o edición) ---
  esNuevo = signal(false);
  correoOriginal = signal('');
  formHeaders = signal<string[]>([]);
  formData = signal<Record<string, string | number>>({});
  formError = signal('');
  formOk = signal('');

  loading = signal(false);

  datosPersonales = computed(() => this.formHeaders().filter((h) => this.PERSONALES.includes(h)));
  // Columnas de exámenes: todo lo que no es dato personal ni la nota final, en el orden original del Excel
  examenes = computed(() =>
    this.formHeaders().filter((h) => !this.PERSONALES.includes(h) && h !== this.NOTA_FINAL)
  );

  // --- Acciones: login ---

  login(): void {
    this.loginError.set('');
    if (!this.password().trim()) {
      this.loginError.set('Ingresa la contraseña.');
      return;
    }
    this.loading.set(true);
    this.service.login(this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.password.set('');
        this.vista.set('buscar');
      },
      error: (err) => {
        this.loading.set(false);
        this.loginError.set(err?.error?.error || 'No se pudo iniciar sesión.');
      }
    });
  }

  cerrarSesion(): void {
    this.service.logout();
    this.vista.set('login');
  }

  // --- Acciones: búsqueda ---

  buscar(): void {
    this.buscarError.set('');
    this.buscarInfo.set('');

    const correo = this.correoBusqueda().trim();
    const modulo = this.moduloBusqueda();

    if (!correo) {
      this.buscarError.set('Ingresa un correo electrónico.');
      return;
    }
    if (!modulo) {
      this.buscarError.set('Selecciona un módulo.');
      return;
    }

    this.loading.set(true);
    this.service.buscar(correo, modulo).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.esNuevo.set(false);
        this.correoOriginal.set(correo);
        this.formHeaders.set(res.headers);
        this.formData.set({ ...res.alumno });
        this.formError.set('');
        this.formOk.set('');
        this.vista.set('form');
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          // No existe: ofrecemos crearlo con un formulario en blanco
          const headers: string[] = err?.error?.headers || [];
          if (headers.length) {
            this.iniciarAlta(modulo, correo, headers);
          } else {
            this.buscarError.set('Alumno no existe y no se pudieron obtener las columnas del módulo.');
          }
        } else {
          this.buscarError.set(err?.error?.error || 'Ocurrió un error al buscar.');
        }
      }
    });
  }

  private iniciarAlta(modulo: string, correo: string, headers: string[]): void {
    const vacio: Record<string, string | number> = {};
    headers.forEach((h) => (vacio[h] = ''));
    vacio['CorreoElectronico'] = correo;

    this.esNuevo.set(true);
    this.correoOriginal.set(correo);
    this.formHeaders.set(headers);
    this.formData.set(vacio);
    this.formError.set('');
    this.formOk.set('');
    this.vista.set('form');
  }

  // --- Acciones: formulario ---

  actualizarCampo(header: string, valor: string): void {
    this.formData.update((actual) => ({ ...actual, [header]: valor }));
  }

  calcularPromedio(): void {
    this.formError.set('');

    // Solo se promedian las columnas de examen que tengan un valor numérico cargado
    const numeros: number[] = [];
    for (const h of this.examenes()) {
      const raw = this.formData()[h];
      if (raw === '' || raw === undefined || raw === null) {
        continue;
      }
      const num = Number(raw);
      if (!isNaN(num)) {
        numeros.push(num);
      }
    }

    if (!numeros.length) {
      this.formError.set('No hay notas de exámenes para calcular el promedio.');
      return;
    }

    const promedio = numeros.reduce((a, b) => a + b, 0) / numeros.length;
    const redondeado = Math.round(promedio * 100) / 100;
    this.actualizarCampo(this.NOTA_FINAL, redondeado.toString());
  }

  guardar(): void {
    this.formError.set('');
    this.formOk.set('');

    const modulo = this.moduloBusqueda();
    const data = this.formData();

    if (!(data['CorreoElectronico'] || '').toString().trim()) {
      this.formError.set('El correo electrónico es obligatorio.');
      return;
    }

    this.loading.set(true);

    const obs = this.esNuevo()
      ? this.service.crear(modulo, data)
      : this.service.actualizar(modulo, this.correoOriginal(), data);

    obs.subscribe({
      next: (res) => {
        this.loading.set(false);
        this.formOk.set('Guardado correctamente.');
        this.esNuevo.set(false);
        this.correoOriginal.set((res.alumno['CorreoElectronico'] || '').toString());
        this.formData.set({ ...res.alumno });
      },
      error: (err) => {
        this.loading.set(false);
        this.formError.set(err?.error?.error || 'No se pudo guardar.');
      }
    });
  }

  eliminar(): void {
    if (this.esNuevo()) {
      return;
    }
    const confirmado = confirm(`¿Eliminar al alumno ${this.correoOriginal()} del módulo ${this.moduloBusqueda()}? Esta acción no se puede deshacer.`);
    if (!confirmado) {
      return;
    }

    this.loading.set(true);
    this.service.eliminar(this.correoOriginal(), this.moduloBusqueda()).subscribe({
      next: () => {
        this.loading.set(false);
        this.volverABuscar();
      },
      error: (err) => {
        this.loading.set(false);
        this.formError.set(err?.error?.error || 'No se pudo eliminar.');
      }
    });
  }

  volverABuscar(): void {
    this.formError.set('');
    this.formOk.set('');
    this.formHeaders.set([]);
    this.formData.set({});
    this.vista.set('buscar');
  }
}
