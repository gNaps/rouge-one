import { Component, EventEmitter, Output, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({ selector: 'app-project-form', standalone: true, imports: [CommonModule, ReactiveFormsModule], templateUrl: './project-form.component.html', styleUrl: './project-form.component.sass' })
export class ProjectFormComponent {
  project = input<any>();
  saving = input(false);
  @Output() save = new EventEmitter<any>();
  step = 1;
  projectForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    description: new FormControl('', { nonNullable: true }),
    redirect_url: new FormControl(`${location.origin}/example/`, { nonNullable: true, validators: [Validators.required] }),
    google_client_id: new FormControl('', { nonNullable: true }),
    google_secret_id: new FormControl('', { nonNullable: true }),
    is_google_active: new FormControl(false, { nonNullable: true }),
    is_password_active: new FormControl(true, { nonNullable: true }),
    is_magic_link_active: new FormControl(false, { nonNullable: true }),
  });
  constructor() { effect(() => { const p = this.project(); if (p) this.projectForm.patchValue({ ...p, google_secret_id: '' }); }); }
  onSave() { if (this.projectForm.valid) this.save.emit(this.projectForm.getRawValue()); }
}
