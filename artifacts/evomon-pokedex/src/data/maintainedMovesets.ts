import supplement from '../../../api-server/src/data/replit-move-supplement.json';
import type { Evomon, EvomonMove } from './evomonData';

// Pages and the API deploy independently. Keep reviewed reference movesets
// authoritative in the browser even when the API still runs an older release.
const maintainedMovesets = supplement.exactLearnsets as Record<string, EvomonMove[]>;

export function applyMaintainedMovesets(catalog: Evomon[]): Evomon[] {
  return catalog.map((entry) => {
    const moves = maintainedMovesets[entry.name];
    return moves ? { ...entry, moves: moves.map((move) => ({ ...move, tags: [...move.tags] })) } : entry;
  });
}

