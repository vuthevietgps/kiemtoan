import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CustomerRelationshipsComponent } from './customer-relationships.component';

describe('CustomerRelationshipsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [provideNoopAnimations()]}));
  function setup(canManage = true) {
    const fixture = TestBed.createComponent(CustomerRelationshipsComponent);
    fixture.componentRef.setInput('contacts', []);
    fixture.componentRef.setInput('assignments', []);
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return fixture;
  }

  it('does not emit invalid contacts or whitespace-only names', () => {
    const fixture = setup();
    const action = vi.fn(); fixture.componentInstance.action.subscribe(action);
    const name = fixture.nativeElement.querySelector('[formcontrolname="fullName"]') as HTMLInputElement;
    name.value = '   '; name.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(action).not.toHaveBeenCalled();
  });

  it('emits normalized values without calling an API', () => {
    const fixture = setup();
    const action = vi.fn(); fixture.componentInstance.action.subscribe(action);
    const name = fixture.nativeElement.querySelector('[formcontrolname="fullName"]') as HTMLInputElement;
    name.value = '  Contact  '; name.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(action).toHaveBeenCalledWith({type: 'contact', id: undefined, value: {
      fullName: 'Contact', title: null, phone: null, email: null, note: null, isPrimary: false,
    }});
  });

  it('hides editing controls for read-only users', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('nz-select')).toBeNull();
  });
});
