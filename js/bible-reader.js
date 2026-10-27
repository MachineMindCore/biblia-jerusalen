/**
 * BibleReader module - displays Bible verses for reading.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const BibleReader = {
  currentBook: null,
  currentChapter: 1,

  /**
   * Render the Bible reader for a given book and chapter.
   * Loads book info and verses, renders toolbar, verses, and navigation.
   * @param {number|string} bookId - The book ID
   * @param {number|string} chapter - The chapter number
   */
  async render(bookId, chapter) {
    var main = App.getMainContent();
    if (!main) return;

    App.showLoading();
    main.innerHTML = '';

    try {
      var books = DB.books;
      if (!books) {
        main.innerHTML = '<div class="error-state"><p>Error al cargar los datos. Intente de nuevo.</p></div>';
        App.hideLoading();
        return;
      }

      var book = DB.getBookById(parseInt(bookId, 10));
      if (!book) {
        main.innerHTML = '<div class="error-state"><p>Libro no encontrado.</p></div>';
        App.hideLoading();
        return;
      }

      var chapterNum = parseInt(chapter, 10);
      if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > book.chapters) {
        main.innerHTML = '<div class="error-state"><p>Cap&iacute;tulo inv&aacute;lido. Este libro tiene ' + book.chapters + ' cap&iacute;tulos.</p></div>';
        App.hideLoading();
        return;
      }

      // Load verses
      var verseData = await DB.getVerses(book.id);
      if (!verseData) {
        main.innerHTML = '<div class="error-state"><p>No se pudieron cargar los vers&iacute;culos.</p></div>';
        App.hideLoading();
        return;
      }

      var chapterKey = String(chapterNum);
      var chapterVerses = verseData[chapterKey];
      if (!chapterVerses || typeof chapterVerses !== 'object' || Object.keys(chapterVerses).length === 0) {
        main.innerHTML = '<div class="error-state"><p>No se encontraron vers&iacute;culos para ' + App.escapeHtml(book.name) + ' cap&iacute;tulo ' + chapterNum + '.</p></div>';
        App.hideLoading();
        return;
      }

      this.currentBook = book;
      this.currentChapter = chapterNum;

      // Get favorites and notes for the current book
      var favoritesMap = {};
      var notesMap = {};
      try {
        var favorites = DB.getFavorites();
        if (favorites) {
          for (var i = 0; i < favorites.length; i++) {
            if (favorites[i].bookId === book.id && favorites[i].chapter === chapterNum) {
              favoritesMap[favorites[i].verse] = true;
            }
          }
        }
      } catch (e) { /* ignore */ }

      try {
        var notes = DB.getNotes();
        if (notes) {
          for (var j = 0; j < notes.length; j++) {
            if (notes[j].bookId === book.id && notes[j].chapter === chapterNum) {
              notesMap[notes[j].verse] = true;
            }
          }
        }
      } catch (e) { /* ignore */ }

      // Build HTML
      var html = '<div class="reader-container">';

      // Toolbar
      html += '<div class="reader-toolbar" id="reader-toolbar">';
      html += '<button class="toolbar-back-btn" id="reader-back-btn">&larr;</button>';
      html += '<div class="toolbar-title">' + App.escapeHtml(book.name) + '</div>';
      html += BibleReader.renderChapterSelector(book, chapterNum);
      html += '</div>';

      // Verse list
      html += '<div class="verses-container" id="verses-container">';

      var verseKeys = Object.keys(chapterVerses).sort(function(a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
      });
      for (var k = 0; k < verseKeys.length; k++) {
        var vKey = verseKeys[k];
        var verseNum = parseInt(vKey, 10);
        var text = chapterVerses[vKey];
        var isFav = !!favoritesMap[verseNum];
        var hasNote = !!notesMap[verseNum];
        html += BibleReader.renderVerse(verseNum, text, isFav, hasNote);
      }

      html += '</div>';

      // Navigation
      html += BibleReader.renderNavigation(book, chapterNum);
      html += '</div>';

      main.innerHTML = html;

      // Attach event listeners
      BibleReader._attachListeners(main, book);

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error('BibleReader.render error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar el texto: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    } finally {
      App.hideLoading();
    }
  },

  /**
   * Render the chapter selector dropdown.
   * @param {Object} book - Book object
   * @param {number} currentChapter - Current chapter number
   * @returns {string} HTML string
   */
  renderChapterSelector(book, currentChapter) {
    var html = '<select class="chapter-select" id="chapter-select">';
    for (var ch = 1; ch <= book.chapters; ch++) {
      var selected = (ch === currentChapter) ? ' selected' : '';
      html += '<option value="' + ch + '"' + selected + '>Cap. ' + ch + '</option>';
    }
    html += '</select>';
    return html;
  },

  /**
   * Render a single verse with verse number, text, and action buttons.
   * @param {number} verseNum - Verse number
   * @param {string} text - Verse text (may contain HTML entities)
   * @param {boolean} isFav - Whether verse is favorited
   * @param {boolean} hasNote - Whether verse has a note
   * @returns {string} HTML string
   */
  renderVerse(verseNum, text, isFav, hasNote) {
    var favClass = isFav ? ' verse-favorited' : '';
    var noteClass = hasNote ? ' verse-has-note' : '';
    var decodedText = BibleReader._decodeEntities(text);

    return '<div class="verse-row' + favClass + noteClass + '" data-verse="' + verseNum + '" id="verse-' + verseNum + '">' +
      '<span class="verse-number">' + verseNum + '</span>' +
      '<span class="verse-text">' + decodedText + '</span>' +
      '<div class="verse-actions">' +
        '<button class="verse-action-btn fav-btn' + (isFav ? ' active' : '') + '" data-action="fav" data-verse="' + verseNum + '" title="' + (isFav ? 'Quitar de favoritos' : 'Agregar a favoritos') + '">&#11088;</button>' +
        '<button class="verse-action-btn note-btn' + (hasNote ? ' active' : '') + '" data-action="note" data-verse="' + verseNum + '" title="' + (hasNote ? 'Ver/Editar nota' : 'Agregar nota') + '">&#128221;</button>' +
        '<button class="verse-action-btn share-btn" data-action="share" data-verse="' + verseNum + '" title="Compartir">&#128228;</button>' +
      '</div>' +
    '</div>';
  },

  /**
   * Render previous/next chapter navigation.
   * @param {Object} book - Book object
   * @param {number} currentChapter - Current chapter number
   * @returns {string} HTML string
   */
  renderNavigation(book, currentChapter) {
    var prevDisabled = currentChapter <= 1;
    var nextDisabled = currentChapter >= book.chapters;

    var html = '<div class="reader-navigation">';
    html += '<button class="nav-btn prev-btn" id="prev-chapter-btn"' + (prevDisabled ? ' disabled' : '') + ' data-chapter="' + (currentChapter - 1) + '">&laquo; Anterior</button>';
    html += '<span class="nav-indicator">Cap&iacute;tulo ' + currentChapter + ' de ' + book.chapters + '</span>';
    html += '<button class="nav-btn next-btn" id="next-chapter-btn"' + (nextDisabled ? ' disabled' : '') + ' data-chapter="' + (currentChapter + 1) + '">Siguiente &raquo;</button>';
    html += '</div>';
    return html;
  },

  /**
   * Navigate to a specific chapter of a book.
   * @param {number|string} bookId - Book ID
   * @param {number|string} chapter - Chapter number
   */
  goToChapter(bookId, chapter) {
    App.navigate('#read/' + bookId + '/' + chapter);
    this.render(bookId, chapter);
  },

  /**
   * Toggle favorite status for a verse.
   * Uses DB.addFavorite / DB.removeFavorite since DB has no toggleFavorite.
   * @param {number} bookId - Book ID
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   * @param {string} text - Verse text
   */
  async toggleFavorite(bookId, chapter, verse, text) {
    try {
      var currentlyFav = DB.isFavorite(bookId, chapter, verse);

      if (currentlyFav) {
        DB.removeFavorite(bookId, chapter, verse);
      } else {
        DB.addFavorite(bookId, chapter, verse, text);
      }

      var isNowFav = !currentlyFav;

      // Update UI
      var verseRow = document.getElementById('verse-' + verse);
      if (verseRow) {
        var favBtn = verseRow.querySelector('[data-action="fav"]');
        if (favBtn) {
          if (isNowFav) {
            favBtn.classList.add('active');
            favBtn.setAttribute('title', 'Quitar de favoritos');
            verseRow.classList.add('verse-favorited');
          } else {
            favBtn.classList.remove('active');
            favBtn.setAttribute('title', 'Agregar a favoritos');
            verseRow.classList.remove('verse-favorited');
          }
        }
      }

      App.showToast(isNowFav ? 'Agregado a favoritos' : 'Quitado de favoritos');
    } catch (err) {
      console.error('BibleReader.toggleFavorite error:', err);
      App.showToast('Error al modificar favorito');
    }
  },

  /**
   * Add or edit a note for a verse.
   * DB.addNote signature: (bookId, chapter, verse, verseText, noteText)
   * @param {number} bookId - Book ID
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   * @param {string} text - Verse text (for reference)
   */
  async addNote(bookId, chapter, verse, text) {
    try {
      // Check if there's an existing note
      var existingNote = '';
      var existingNoteObj = DB.getNote(bookId, chapter, verse);
      if (existingNoteObj) {
        existingNote = existingNoteObj.note || '';
      }

      var noteText = prompt(
        existingNote ? 'Editar nota para ' + this.currentBook.name + ' ' + chapter + ':' + verse : 'Agregar nota para ' + this.currentBook.name + ' ' + chapter + ':' + verse,
        existingNote
      );

      if (noteText === null) return; // User cancelled

      if (noteText.trim() === '') {
        // Empty note - delete it using removeNote
        DB.removeNote(bookId, chapter, verse);
        var verseRow = document.getElementById('verse-' + verse);
        if (verseRow) {
          var noteBtn = verseRow.querySelector('[data-action="note"]');
          if (noteBtn) {
            noteBtn.classList.remove('active');
            noteBtn.setAttribute('title', 'Agregar nota');
          }
          verseRow.classList.remove('verse-has-note');
        }
        App.showToast('Nota eliminada');
      } else {
        // DB.addNote(bookId, chapter, verse, verseText, noteText)
        DB.addNote(bookId, chapter, verse, text, noteText.trim());

        // Update UI
        var verseRow = document.getElementById('verse-' + verse);
        if (verseRow) {
          var noteBtn = verseRow.querySelector('[data-action="note"]');
          if (noteBtn) {
            noteBtn.classList.add('active');
            noteBtn.setAttribute('title', 'Ver/Editar nota');
          }
          verseRow.classList.add('verse-has-note');
        }
        App.showToast('Nota guardada');
      }
    } catch (err) {
      console.error('BibleReader.addNote error:', err);
      App.showToast('Error al guardar la nota');
    }
  },

  /**
   * Share a verse using Web Share API or clipboard fallback.
   * @param {string} bookName - Book name
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   * @param {string} text - Verse text
   */
  async shareVerse(bookName, chapter, verse, text) {
    var decodedText = BibleReader._decodeEntities(text);
    var shareText = bookName + ' ' + chapter + ':' + verse + ' - ' + decodedText;

    if (navigator.share) {
      try {
        await navigator.share({
          title: bookName + ' ' + chapter + ':' + verse,
          text: shareText
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          BibleReader._copyToClipboard(shareText);
        }
      }
    } else {
      BibleReader._copyToClipboard(shareText);
    }
  },

  /**
   * Copy text to clipboard and show toast.
   * @param {string} text - Text to copy
   */
  _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        App.showToast('Vers&iacute;culo copiado al portapapeles');
      }).catch(function() {
        BibleReader._fallbackCopy(text);
      });
    } else {
      BibleReader._fallbackCopy(text);
    }
  },

  /**
   * Fallback clipboard copy using textarea.
   * @param {string} text - Text to copy
   */
  _fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      App.showToast('Vers&iacute;culo copiado al portapapeles');
    } catch (e) {
      App.showToast('No se pudo copiar el texto');
    }
    document.body.removeChild(textarea);
  },

  /**
   * Attach event listeners to the rendered reader UI.
   * @param {HTMLElement} main - Main content element
   * @param {Object} book - Current book object
   */
  _attachListeners(main, book) {
    // Back button
    var backBtn = main.querySelector('#reader-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        App.navigate('#books');
      });
    }

    // Chapter selector
    var chapterSelect = main.querySelector('#chapter-select');
    if (chapterSelect) {
      chapterSelect.addEventListener('change', function(e) {
        var newChapter = parseInt(e.target.value, 10);
        if (newChapter && newChapter !== BibleReader.currentChapter) {
          BibleReader.goToChapter(book.id, newChapter);
        }
      });
    }

    // Previous chapter button
    var prevBtn = main.querySelector('#prev-chapter-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        var ch = parseInt(e.target.getAttribute('data-chapter'), 10);
        if (ch >= 1) {
          BibleReader.goToChapter(book.id, ch);
        }
      });
    }

    // Next chapter button
    var nextBtn = main.querySelector('#next-chapter-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        var ch = parseInt(e.target.getAttribute('data-chapter'), 10);
        if (ch <= book.chapters) {
          BibleReader.goToChapter(book.id, ch);
        }
      });
    }

    // Verse action buttons (event delegation)
    var versesContainer = main.querySelector('#verses-container');
    if (versesContainer) {
      versesContainer.addEventListener('click', function(e) {
        var btn = e.target.closest('.verse-action-btn');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var verse = parseInt(btn.getAttribute('data-verse'), 10);
        if (!verse) return;

        // Get verse text from the row
        var verseRow = btn.closest('.verse-row');
        var verseTextEl = verseRow ? verseRow.querySelector('.verse-text') : null;
        var verseText = verseTextEl ? verseTextEl.textContent : '';

        switch (action) {
          case 'fav':
            BibleReader.toggleFavorite(book.id, BibleReader.currentChapter, verse, verseText);
            break;
          case 'note':
            BibleReader.addNote(book.id, BibleReader.currentChapter, verse, verseText);
            break;
          case 'share':
            BibleReader.shareVerse(book.name, BibleReader.currentChapter, verse, verseText);
            break;
        }
      });
    }
  },

  /**
   * Decode HTML entities in a string for proper display.
   * @param {string} text - Text that may contain HTML entities
   * @returns {string} Decoded text
   */
  _decodeEntities(text) {
    if (!text) return '';
    var textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
};

// Make BibleReader globally available
window.BibleReader = BibleReader;
