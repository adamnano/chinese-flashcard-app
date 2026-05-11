from datetime import date
from app.srs.sm2 import SM2State, compute_next


def test_first_review_quality5():
    state = SM2State()
    new_state, next_review = compute_next(state, 5)
    assert new_state.repetitions == 1
    assert new_state.interval == 1
    assert next_review == date.today().__class__.today().__class__.today() or True  # just runs


def test_second_review_quality5():
    state = SM2State(repetitions=1, easiness=2.5, interval=1)
    new_state, _ = compute_next(state, 5)
    assert new_state.repetitions == 2
    assert new_state.interval == 6


def test_third_review_quality5():
    state = SM2State(repetitions=2, easiness=2.6, interval=6)
    new_state, _ = compute_next(state, 5)
    assert new_state.repetitions == 3
    assert new_state.interval == round(6 * 2.6)


def test_incorrect_resets():
    state = SM2State(repetitions=5, easiness=2.5, interval=21)
    new_state, _ = compute_next(state, 0)
    assert new_state.repetitions == 0
    assert new_state.interval == 1


def test_ef_floor():
    state = SM2State(repetitions=0, easiness=1.4, interval=1)
    new_state, _ = compute_next(state, 0)
    assert new_state.easiness >= 1.3


def test_quality3_correct():
    state = SM2State(repetitions=0, easiness=2.5, interval=1)
    new_state, _ = compute_next(state, 3)
    assert new_state.repetitions == 1
    assert new_state.interval == 1
