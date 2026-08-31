import { Routes } from '@angular/router';
import { Search } from './search/search';
import { Results } from './results/results';

export const routes: Routes = [
  { path: '', component: Search },
  { path: 'resultados', component: Results },
  { path: '**', redirectTo: '' }
];
