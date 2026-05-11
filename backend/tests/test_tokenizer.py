import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.nlp.tokenizer import tokenize, initialize

initialize()


def test_basic_tokenization():
    tokens = tokenize("我今天去了圖書館")
    assert "圖書館" in tokens
    assert "今天" in tokens


def test_stopwords_filtered():
    tokens = tokenize("我今天去了圖書館")
    assert "我" not in tokens
    assert "了" not in tokens


def test_cjk_only():
    tokens = tokenize("Hello 你好 123 世界")
    assert "Hello" not in tokens
    assert "123" not in tokens
    assert "你好" in tokens or "世界" in tokens


def test_traditional_chinese():
    tokens = tokenize("台灣的夜市非常熱鬧，有很多美食和娛樂活動。")
    # These should be recognized as words
    word_set = set(tokens)
    # At minimum we should get some multi-char tokens
    multi_char = [t for t in word_set if len(t) > 1]
    assert len(multi_char) > 0
