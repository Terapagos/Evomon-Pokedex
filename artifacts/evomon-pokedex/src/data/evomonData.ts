/**
 * Local catalog contract. The maintained catalog can replace `evomonData`
 * without changing the field guide UI. Optional fields stay optional so
 * missing wiki notes are represented honestly.
 */
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
  sourceUrl?: string;
}

export const evomonData: Evomon[] = [];
export default evomonData;