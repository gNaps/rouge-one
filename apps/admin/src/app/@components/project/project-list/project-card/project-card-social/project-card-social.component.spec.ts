import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectCardSocialComponent } from './project-card-social.component';

describe('ProjectCardSocialComponent', () => {
  let component: ProjectCardSocialComponent;
  let fixture: ComponentFixture<ProjectCardSocialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectCardSocialComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectCardSocialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
