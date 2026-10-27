/* ============================================
   Biblia de Jerusalén - Database Module
   ============================================ */

const DB = {
  manifest: null,
  books: null,
  dividers: null,
  dictionary: null,
  dictionaryIndex: null,
  verseCache: {},
  _jsonCache: {},
  _initDone: false,
  _initPromise: null,

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  },

  async _doInit() {
    try {
      const [manifest, books, dividers, dictionary, dictionaryIndex] = await Promise.all([
        this.loadJSON('data/manifest.json'),
        this.loadJSON('data/books.json'),
        this.loadJSON('data/dividers.json'),
        this.loadJSON('data/dictionary.json'),
        this.loadJSON('data/dictionary-index.json')
      ]);
      this.manifest = manifest;
      this.books = books;
      this.dividers = dividers;
      this.dictionary = dictionary;
      this.dictionaryIndex = dictionaryIndex;
      this._initDone = true;
    } catch (err) {
      console.error('DB.init failed:', err);
      throw err;
    }
  },

  async loadJSON(path) {
    if (this._jsonCache[path]) {
      return this._jsonCache[path];
    }
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${path}`);
      }
      const data = await response.json();
      this._jsonCache[path] = data;
      return data;
    } catch (err) {
      console.error(`DB.loadJSON failed for ${path}:`, err);
      throw err;
    }
  },

  async getVerses(bookId) {
    if (this.verseCache[bookId]) {
      return this.verseCache[bookId];
    }
    const manifestBook = this.getBookFile(bookId);
    if (!manifestBook) {
      throw new Error(`Book ${bookId} not found in manifest`);
    }
    const path = 'data/verses/' + manifestBook.file;
    const data = await this.loadJSON(path);
    this.verseCache[bookId] = data;
    return data;
  },

  getBookById(id) {
    if (!this.books) return null;
    return this.books.find(function(b) { return b.id === id; }) || null;
  },

  getBookFile(bookId) {
    if (!this.manifest || !this.manifest.books) return null;
    return this.manifest.books.find(function(b) { return b.id === bookId; }) || null;
  },

  getDividerById(id) {
    if (!this.dividers) return null;
    return this.dividers.find(function(d) { return d.id === id; }) || null;
  },

  getBooksByDivider(dividerId) {
    if (!this.books) return [];
    return this.books.filter(function(b) { return b.divider === dividerId; });
  },

  async search(query, exactWord) {
    if (!query || query.trim().length < 2) return [];
    if (!this.manifest) await this.init();

    var results = [];
    var searchTerm = query.trim();
    var booksList = this.manifest.books;
    var totalBooks = booksList.length;

    for (var i = 0; i < totalBooks; i++) {
      var bookInfo = booksList[i];
      try {
        var verses = await this.getVerses(bookInfo.id);
        var chapterKeys = Object.keys(verses);
        for (var c = 0; c < chapterKeys.length; c++) {
          var chapterNum = chapterKeys[c];
          var chapterData = verses[chapterNum];
          if (!chapterData || typeof chapterData !== 'object') continue;
          var verseKeys = Object.keys(chapterData);
          for (var v = 0; v < verseKeys.length; v++) {
            var verseNum = verseKeys[v];
            var text = chapterData[verseNum];
            if (!text) continue;

            var matched = false;
            if (exactWord) {
              var escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              var pattern = new RegExp('\\b' + escaped + '\\b', 'i');
              matched = pattern.test(text);
            } else {
              var textLower = this._normalizeText(text).toLowerCase();
              var searchLower = this._normalizeText(searchTerm).toLowerCase();
              matched = textLower.indexOf(searchLower) !== -1;
            }

            if (matched) {
              results.push({
                bookName: bookInfo.name,
                bookId: bookInfo.id,
                chapter: parseInt(chapterNum, 10),
                verse: parseInt(verseNum, 10),
                text: text,
                bookChapters: bookInfo.chapters
              });
            }
          }
        }
      } catch (err) {
        console.warn('Search: failed to load verses for', bookInfo.name, err);
      }
    }

    results.sort(function(a, b) {
      if (a.bookId !== b.bookId) return a.bookId - b.bookId;
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return a.verse - b.verse;
    });

    return results;
  },

  _normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  },

  getDictionaryTerms(letter) {
    if (!this.dictionary) return [];
    if (!letter) return this.dictionary;
    return this.dictionary.filter(function(t) {
      return t.letter === letter.toUpperCase();
    });
  },

  searchDictionary(query) {
    if (!this.dictionary) return [];
    if (!query || query.trim().length < 2) return [];
    var q = this._normalizeText(query).toLowerCase();
    return this.dictionary.filter(function(term) {
      var nameNorm = (term.accents || term.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      var nameOrig = term.name.toLowerCase();
      var infoNorm = (term.info || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return nameNorm.indexOf(q) !== -1 || nameOrig.indexOf(q) !== -1 || infoNorm.indexOf(q) !== -1;
    });
  },

  getSetting(key, defaultVal) {
    try {
      var val = localStorage.getItem('biblia_' + key);
      if (val === null) return defaultVal;
      try { return JSON.parse(val); } catch(e) { return val; }
    } catch(e) {
      return defaultVal;
    }
  },

  setSetting(key, val) {
    try {
      localStorage.setItem('biblia_' + key, JSON.stringify(val));
    } catch(e) {
      console.warn('Failed to save setting:', key, e);
    }
  },

  getFavorites() {
    try {
      var raw = localStorage.getItem('biblia_favorites');
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  },

  addFavorite(bookId, chapter, verse, text) {
    var favs = this.getFavorites();
    var exists = favs.some(function(f) {
      return f.bookId === bookId && f.chapter === chapter && f.verse === verse;
    });
    if (!exists) {
      favs.push({
        bookId: bookId,
        chapter: chapter,
        verse: verse,
        text: text,
        addedAt: Date.now()
      });
      try {
        localStorage.setItem('biblia_favorites', JSON.stringify(favs));
      } catch(e) {
        console.warn('Failed to save favorite:', e);
      }
      return true;
    }
    return false;
  },

  removeFavorite(bookId, chapter, verse) {
    var favs = this.getFavorites();
    var newFavs = favs.filter(function(f) {
      return !(f.bookId === bookId && f.chapter === chapter && f.verse === verse);
    });
    try {
      localStorage.setItem('biblia_favorites', JSON.stringify(newFavs));
    } catch(e) {
      console.warn('Failed to remove favorite:', e);
    }
  },

  isFavorite(bookId, chapter, verse) {
    var favs = this.getFavorites();
    return favs.some(function(f) {
      return f.bookId === bookId && f.chapter === chapter && f.verse === verse;
    });
  },

  getNotes() {
    try {
      var raw = localStorage.getItem('biblia_notes');
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  },

  addNote(bookId, chapter, verse, text, note) {
    var notes = this.getNotes();
    var existingIdx = -1;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].bookId === bookId && notes[i].chapter === chapter && notes[i].verse === verse) {
        existingIdx = i;
        break;
      }
    }
    var noteObj = {
      bookId: bookId,
      chapter: chapter,
      verse: verse,
      text: text,
      note: note,
      updatedAt: Date.now()
    };
    if (existingIdx >= 0) {
      notes[existingIdx] = noteObj;
    } else {
      notes.push(noteObj);
    }
    try {
      localStorage.setItem('biblia_notes', JSON.stringify(notes));
    } catch(e) {
      console.warn('Failed to save note:', e);
    }
  },

  removeNote(bookId, chapter, verse) {
    var notes = this.getNotes();
    var newNotes = notes.filter(function(n) {
      return !(n.bookId === bookId && n.chapter === chapter && n.verse === verse);
    });
    try {
      localStorage.setItem('biblia_notes', JSON.stringify(newNotes));
    } catch(e) {
      console.warn('Failed to remove note:', e);
    }
  },

  getNote(bookId, chapter, verse) {
    var notes = this.getNotes();
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].bookId === bookId && notes[i].chapter === chapter && notes[i].verse === verse) {
        return notes[i];
      }
    }
    return null;
  },

  getVerseOfDay() {
    var today = new Date();
    var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    if (!this.manifest || !this.manifest.books) {
      return null;
    }

    var books = this.manifest.books;
    var bookIndex = seed % books.length;
    var book = books[bookIndex];

    var chapter = (seed % book.chapters) + 1;

    return {
      bookName: book.name,
      bookId: book.id,
      chapter: chapter,
      seed: seed,
      bookChapters: book.chapters
    };
  },

  async resolveVerseOfDay() {
    var vod = this.getVerseOfDay();
    if (!vod) return null;

    try {
      var verses = await this.getVerses(vod.bookId);
      var chapterData = verses[String(vod.chapter)];
      if (!chapterData) {
        return null;
      }
      var verseKeys = Object.keys(chapterData);
      if (verseKeys.length === 0) return null;

      var verseIndex = vod.seed % verseKeys.length;
      var verseNum = parseInt(verseKeys[verseIndex], 10);
      var text = chapterData[verseKeys[verseIndex]];

      return {
        bookName: vod.bookName,
        bookId: vod.bookId,
        chapter: vod.chapter,
        verse: verseNum,
        text: text
      };
    } catch (err) {
      console.error('Failed to resolve verse of day:', err);
      return null;
    }
  }
};
