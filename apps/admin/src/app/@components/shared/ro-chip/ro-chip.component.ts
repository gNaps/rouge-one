import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChipModule } from 'primeng/chip';

@Component({
  selector: 'app-ro-chip',
  standalone: true,
  imports: [ChipModule, CommonModule],
  templateUrl: './ro-chip.component.html',
  styleUrl: './ro-chip.component.sass',
})
export class RoChipComponent {
  @Input() color: 'green' | 'blue' | 'purple' | 'red' | 'yellow' | 'grey' =
    'grey';
  @Input() label: string = '';
}
