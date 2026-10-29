import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Chỉ hiện phần tử khi có quyền: <button *appCan="'contracts:approve'">Duyệt</button>.
 * Đây chỉ là giao diện — backend vẫn là nơi kiểm tra quyền chính.
 */
@Directive({ selector: '[appCan]' })
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly appCan = input.required<string>();
  private shown = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.permissions().has(this.appCan());
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}
