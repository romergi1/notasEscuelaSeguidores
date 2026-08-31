import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AlumnoResponse {
  headers: string[];
  alumno: Record<string, string | number>;
  modulo: string;
}

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private http = inject(HttpClient);

  // La API se sirve bajo /api (Nginx la redirige al backend en Docker)
  private baseUrl = '/api';

  consultar(correo: string, modulo: string): Observable<AlumnoResponse> {
    const params = new URLSearchParams({ correo, modulo }).toString();
    return this.http.get<AlumnoResponse>(`${this.baseUrl}/alumno?${params}`);
  }
}
