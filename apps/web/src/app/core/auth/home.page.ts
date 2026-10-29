import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
export class HomePage {
  constructor() {
    void inject(Router).navigateByUrl(inject(AuthService).home());
  }
}
