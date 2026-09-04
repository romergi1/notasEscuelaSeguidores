import { Routes } from '@angular/router';
import { Search } from './search/search';
import { Results } from './results/results';
import { Admin } from './admin/admin';

export const routes: Routes = [
  { path: '', component: Search },
  { path: 'resultados', component: Results },
  { path: 'admin', component: Admin },
  { path: '**', redirectTo: '' }
];
