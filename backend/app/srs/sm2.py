"""SM-2 spaced repetition algorithm.

Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method

Quality scale:
  5 - Perfect recall
  4 - Correct with slight hesitation
  3 - Correct with serious difficulty
  2 - Incorrect; easy recall on seeing answer
  1 - Incorrect; remembered on seeing answer
  0 - Complete blackout
"""
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class SM2State:
    repetitions: int = 0
    easiness: float = 2.5
    interval: int = 1


def compute_next(state: SM2State, quality: int) -> tuple[SM2State, date]:
    """Return (new_state, next_review_date)."""
    if not 0 <= quality <= 5:
        raise ValueError(f"Quality must be 0-5, got {quality}")

    rep = state.repetitions
    ef = state.easiness
    interval = state.interval

    if quality < 3:
        # Incorrect — reset
        rep = 0
        interval = 1
    else:
        if rep == 0:
            interval = 1
        elif rep == 1:
            interval = 6
        else:
            interval = round(interval * ef)
        rep += 1

    # Update easiness factor
    ef = ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    ef = max(1.3, ef)

    new_state = SM2State(repetitions=rep, easiness=ef, interval=interval)
    next_review = date.today() + timedelta(days=interval)
    return new_state, next_review
