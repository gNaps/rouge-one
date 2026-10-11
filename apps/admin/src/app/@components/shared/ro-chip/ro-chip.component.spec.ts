import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoChipComponent } from './ro-chip.component';

describe('RoChipComponent', () => {
  let component: RoChipComponent;
  let fixture: ComponentFixture<RoChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoChipComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoChipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
