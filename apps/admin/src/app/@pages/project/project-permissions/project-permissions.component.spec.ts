import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectPermissionsComponent } from './project-permissions.component';

describe('ProjectPermissionsComponent', () => {
  let component: ProjectPermissionsComponent;
  let fixture: ComponentFixture<ProjectPermissionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectPermissionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectPermissionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
