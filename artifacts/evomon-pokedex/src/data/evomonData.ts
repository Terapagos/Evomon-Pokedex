/**
 * Local catalog contract. The maintained catalog can replace `evomonData`
 * without changing the field guide UI. Optional fields stay optional so
 * missing wiki notes are represented honestly.
 */
export type MoveTag = 'Physical' | 'Sp. Atk' | 'Support' | 'Priority' | 'Status condition' | 'Weather' | 'AoE' | 'Single target';

export interface EvomonMove {
  name: string;
  element: string;
  category: string;
  description: string;
  obtained: string | null;
  unlockLevel: number | null;
  slot: string;
  power: string | null;
  uses: number | null;
  tags: MoveTag[];
}

export interface Evomon {
  id?: string;
  dexNumber?: number;
  name: string;
  element?: string[];
  stage?: string;
  image?: string | null;
  shinyImage?: string | null;
  baseStats?: Record<string, number>;
  shinyBaseStats?: Record<string, number>;
  shinyStatsRecorded?: boolean;
  legendaryTrait?: string | null;
  legendaryTraitEffect?: string | null;
  catchLocation?: string;
  eventStatus?: string;
  evolutionLine?: string[];
  moves?: EvomonMove[];
  sourceUrl?: string;
}

export const evomonData: Evomon[] = [];
export default evomonData;