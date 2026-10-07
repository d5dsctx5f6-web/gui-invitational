// Brief 33: a round's format (scramble / best ball) locks at the first posted score. Pure mirror of
// the database trigger lock_round_format() (migration 0030); the database is the real enforcement.

export const FORMAT_LOCKED_MESSAGE = "Format is locked — scores have been posted for this round.";

export function canChangeFormat(scoreRowCount: number): { allowed: boolean; message: string | null } {
  return scoreRowCount > 0
    ? { allowed: false, message: FORMAT_LOCKED_MESSAGE }
    : { allowed: true, message: null };
}
