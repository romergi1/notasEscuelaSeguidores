import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AdminAlumnoResponse {
  headers: string[];
  alumno: Record<string, string | number>;
  modulo: string;
}

const TOKEN_KEY = 'admin_token';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = '/api/admin';

  // Se inicializa desde sessionStorage para sobrevivir a un refresh de página
  token = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));

  get logueado(): boolean {
    return !!this.token();
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token() ?? ''}` });
  }

  login(password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${this.baseUrl}/login`, { password })
      .pipe(
        tap((res) => {
          this.token.set(res.token);
          sessionStorage.setItem(TOKEN_KEY, res.token);
        })
      );
  }

  logout(): void {
    this.token.set(null);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  headers(modulo: string): Observable<{ headers: string[] }> {
    const params = new URLSearchParams({ modulo }).toString();
    return this.http.get<{ headers: string[] }>(`${this.baseUrl}/headers?${params}`, {
      headers: this.authHeaders()
    });
  }

  buscar(correo: string, modulo: string): Observable<AdminAlumnoResponse> {
    const params = new URLSearchParams({ correo, modulo }).toString();
    return this.http.get<AdminAlumnoResponse>(`${this.baseUrl}/alumno?${params}`, {
      headers: this.authHeaders()
    });
  }

  crear(modulo: string, data: Record<string, string | number>): Observable<AdminAlumnoResponse> {
    return this.http.post<AdminAlumnoResponse>(
      `${this.baseUrl}/alumno`,
      { modulo, data },
      { headers: this.authHeaders() }
    );
  }

  actualizar(
    modulo: string,
    correoOriginal: string,
    data: Record<string, string | number>
  ): Observable<AdminAlumnoResponse> {
    return this.http.put<AdminAlumnoResponse>(
      `${this.baseUrl}/alumno`,
      { modulo, correoOriginal, data },
      { headers: this.authHeaders() }
    );
  }

  eliminar(correo: string, modulo: string): Observable<{ ok: boolean }> {
    const params = new URLSearchParams({ correo, modulo }).toString();
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/alumno?${params}`, {
      headers: this.authHeaders()
    });
  }
}
