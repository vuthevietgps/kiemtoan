import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzIconModule, provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MENU } from '../layout/menu';
import { APP_ICONS } from './app-icons';

@Component({
  template: `
    @for (name of icons; track name) {
      <nz-icon [nzType]="name" />
    }
  `,
  imports: [NzIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class IconHost {
  icons: string[] = [];
}

describe('Application icon rendering without network requests', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IconHost],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNzIcons(APP_ICONS)],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function expectRendered(names: string[]): Promise<void> {
    const fixture = TestBed.createComponent(IconHost);
    fixture.componentInstance.icons = names;
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const rendered = Array.from(element.querySelectorAll('nz-icon'));
    expect(rendered).toHaveLength(names.length);
    rendered.forEach((icon) => expect(icon.querySelector('svg path')).not.toBeNull());
    fixture.destroy();
  }

  it('renders every menu icon selected from navigation data', async () => {
    await expectRendered(MENU.map((item) => item.icon));
  });

  it('renders task, KPI and action icons including dynamic variants', async () => {
    await expectRendered([
      'rise', 'wallet', 'arrow-up', 'arrow-down', 'clock-circle', 'check-circle',
      'warning', 'unordered-list', 'paper-clip', 'plus', 'search', 'copy', 'eye',
      'eye-invisible', 'edit', 'delete', 'arrow-left', 'arrow-right', 'save', 'send',
      'check', 'file-add', 'download', 'upload', 'table', 'project', 'safety-certificate',
      'rollback', 'file', 'bell', 'down', 'logout',
    ]);
  });
});
