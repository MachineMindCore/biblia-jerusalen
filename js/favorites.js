/**
 * FavoritesModule - manages favorites and notes.
 * Provides tabbed interface to view, manage, and navigate to favorited
 * verses and personal notes.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const FavoritesModule = {
  _activeTab: 'favorites', // 'favorites' or 'notes'

  /**
   * Look up a book name by its ID.
   * @param {number} bookId - Book ID
   * @returns {string} Book name or fallback string
   */
  _getBookName(bookId) {
    if (DB.books) {
      var book = DB.getBookById(bookId);
      if (book) return book.name;
    }
    return 'Libro ' + bookId;
  },

  /**
   * Render the favorites/notes container with tabs.
   * Loads and displays favorites by default.
   */
  async render() {
    var main = App.getMainContent();
    if (!main) return;

    App.showLoading();
    main.innerHTML = '';

    try {
      var html = '<div class="favorites-container">';

      // Header
      html += '<div class="favorites-header">';
      html += '<h2>Mis Favoritos y Notas</h2>';
      html += '</div>';

      // Tabs
      html += '<div class="favorites-tabs" id="favorites-tabs">';
      html += '<button class="fav-tab-btn active" data-tab="favorites" id="tab-favorites">';
      html += '&#11088; Favoritos';
      html += '</button>';
      html += '<button class="fav-tab-btn" data-tab="notes" id="tab-notes">';
      html += '&#128221; Notas';
      html += '</button>';
      html += '</div>';

      // Content area
      html += '<div class="favorites-content" id="favorites-content">';
      html += '</div>';

      html += '</div>';
      main.innerHTML = html;

      // Attach tab listeners
      FavoritesModule._attachTabListeners(main);

      // Load favorites by default
      await FavoritesModule.renderFavorites();

    } catch (err) {
      console.error('FavoritesModule.render error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar favoritos: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    } finally {
      App.hideLoading();
    }
  },

  /**
   * Render the favorites list.
   * Shows all favorited verses with book reference, text preview,
   * and options to remove or navigate.
   */
  async renderFavorites() {
    var content = document.getElementById('favorites-content');
    if (!content) return;

    this._activeTab = 'favorites';

    // Update tab button states
    var favTab = document.getElementById('tab-favorites');
    var notesTab = document.getElementById('tab-notes');
    if (favTab) favTab.classList.add('active');
    if (notesTab) notesTab.classList.remove('active');

    content.innerHTML = '<div class="fav-loading"><div class="spinner"></div><p>Cargando favoritos...</p></div>';

    try {
      var favorites = DB.getFavorites();

      if (!favorites || favorites.length === 0) {
        content.innerHTML = FavoritesModule._renderEmptyState('favorites');
        return;
      }

      // Sort: most recent first (using addedAt field from DB)
      favorites.sort(function(a, b) {
        var ta = a.addedAt || 0;
        var tb = b.addedAt || 0;
        return tb - ta;
      });

      var html = '<div class="fav-list">';
      html += '<div class="fav-count">' + favorites.length + ' vers&iacute;culo' + (favorites.length !== 1 ? 's' : '') + ' favorito' + (favorites.length !== 1 ? 's' : '') + '</div>';

      for (var i = 0; i < favorites.length; i++) {
        html += FavoritesModule._createFavoriteItem(favorites[i]);
      }

      html += '</div>';
      content.innerHTML = html;

      // Attach click listeners
      FavoritesModule._attachFavoriteListListeners(content);

    } catch (err) {
      console.error('FavoritesModule.renderFavorites error:', err);
      content.innerHTML = '<div class="fav-error"><p>Error al cargar favoritos: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    }
  },

  /**
   * Render the notes list.
   * Shows all noted verses with book reference, text preview, note text,
   * and options to edit, delete, or navigate.
   */
  async renderNotes() {
    var content = document.getElementById('favorites-content');
    if (!content) return;

    this._activeTab = 'notes';

    // Update tab button states
    var favTab = document.getElementById('tab-favorites');
    var notesTab = document.getElementById('tab-notes');
    if (favTab) favTab.classList.remove('active');
    if (notesTab) notesTab.classList.add('active');

    content.innerHTML = '<div class="fav-loading"><div class="spinner"></div><p>Cargando notas...</p></div>';

    try {
      var notes = DB.getNotes();

      if (!notes || notes.length === 0) {
        content.innerHTML = FavoritesModule._renderEmptyState('notes');
        return;
      }

      // Sort: most recent first (using updatedAt field from DB)
      notes.sort(function(a, b) {
        var ta = a.updatedAt || 0;
        var tb = b.updatedAt || 0;
        return tb - ta;
      });

      var html = '<div class="notes-list">';
      html += '<div class="fav-count">' + notes.length + ' nota' + (notes.length !== 1 ? 's' : '') + '</div>';

      for (var i = 0; i < notes.length; i++) {
        html += FavoritesModule._createNoteItem(notes[i]);
      }

      html += '</div>';
      content.innerHTML = html;

      // Attach click listeners
      FavoritesModule._attachNoteListListeners(content);

    } catch (err) {
      console.error('FavoritesModule.renderNotes error:', err);
      content.innerHTML = '<div class="fav-error"><p>Error al cargar notas: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    }
  },

  /**
   * Remove a favorite item and refresh the favorites list.
   * @param {number} bookId - Book ID
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   */
  async removeFavoriteItem(bookId, chapter, verse) {
    try {
      DB.removeFavorite(bookId, chapter, verse);
      App.showToast('Favorito eliminado');

      // Refresh the favorites list
      await FavoritesModule.renderFavorites();
    } catch (err) {
      console.error('FavoritesModule.removeFavoriteItem error:', err);
      App.showToast('Error al eliminar favorito');
    }
  },

  /**
   * Delete a note and refresh the notes list.
   * Uses DB.removeNote (not deleteNote).
   * @param {number} bookId - Book ID
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   */
  async deleteNote(bookId, chapter, verse) {
    // Confirm deletion
    if (!confirm('&#191;Eliminar esta nota?')) return;

    try {
      DB.removeNote(bookId, chapter, verse);
      App.showToast('Nota eliminada');

      // Refresh the notes list
      await FavoritesModule.renderNotes();
    } catch (err) {
      console.error('FavoritesModule.deleteNote error:', err);
      App.showToast('Error al eliminar nota');
    }
  },

  /**
   * Edit a note - prompt for new text.
   * DB.addNote signature: (bookId, chapter, verse, verseText, noteText)
   * @param {number} bookId - Book ID
   * @param {number} chapter - Chapter number
   * @param {number} verse - Verse number
   * @param {string} currentText - Current note text
   * @param {string} verseText - Original verse text
   */
  async editNote(bookId, chapter, verse, currentText, verseText) {
    var newText = prompt('Editar nota:', currentText || '');

    if (newText === null) return; // User cancelled

    if (newText.trim() === '') {
      // Empty text means delete
      await FavoritesModule.deleteNote(bookId, chapter, verse);
      return;
    }

    try {
      // DB.addNote(bookId, chapter, verse, verseText, noteText)
      DB.addNote(bookId, chapter, verse, verseText || '', newText.trim());
      App.showToast('Nota actualizada');

      // Refresh the notes list
      await FavoritesModule.renderNotes();
    } catch (err) {
      console.error('FavoritesModule.editNote error:', err);
      App.showToast('Error al guardar nota');
    }
  },

  /**
   * Create HTML for a favorite item in the list.
   * DB favorites have: { bookId, chapter, verse, text, addedAt }
   * No bookName - must look up from DB.books.
   * @param {Object} fav - Favorite object
   * @returns {string} HTML string
   */
  _createFavoriteItem(fav) {
    var bookName = FavoritesModule._getBookName(fav.bookId);
    var reference = bookName + ' ' + (fav.chapter || 1) + ':' + (fav.verse || 1);
    var textPreview = FavoritesModule._truncateText(FavoritesModule._decodeEntities(fav.text || ''), 120);

    return '<div class="fav-item" data-book-id="' + fav.bookId + '" data-chapter="' + fav.chapter + '" data-verse="' + fav.verse + '">' +
      '<div class="fav-item-main">' +
        '<div class="fav-item-reference">' + App.escapeHtml(reference) + '</div>' +
        '<div class="fav-item-text">' + textPreview + '</div>' +
      '</div>' +
      '<div class="fav-item-actions">' +
        '<button class="fav-item-remove-btn" data-action="remove-fav" title="Quitar de favoritos">&times;</button>' +
      '</div>' +
    '</div>';
  },

  /**
   * Create HTML for a note item in the list.
   * DB notes have: { bookId, chapter, verse, text, note, updatedAt }
   * No bookName - must look up from DB.books.
   * @param {Object} note - Note object
   * @returns {string} HTML string
   */
  _createNoteItem(note) {
    var bookName = FavoritesModule._getBookName(note.bookId);
    var reference = bookName + ' ' + (note.chapter || 1) + ':' + (note.verse || 1);
    var versePreview = FavoritesModule._truncateText(FavoritesModule._decodeEntities(note.text || ''), 80);
    var notePreview = FavoritesModule._truncateText(note.note || '', 150);

    return '<div class="note-item" data-book-id="' + note.bookId + '" data-chapter="' + note.chapter + '" data-verse="' + note.verse + '">' +
      '<div class="note-item-main">' +
        '<div class="note-item-reference">' + App.escapeHtml(reference) + '</div>' +
        '<div class="note-item-verse">' + versePreview + '</div>' +
        '<div class="note-item-note">' + App.escapeHtml(notePreview) + '</div>' +
      '</div>' +
      '<div class="note-item-actions">' +
        '<button class="note-item-edit-btn" data-action="edit-note" title="Editar nota">&#9998;</button>' +
        '<button class="note-item-delete-btn" data-action="delete-note" title="Eliminar nota">&times;</button>' +
      '</div>' +
    '</div>';
  },

  /**
   * Render empty state for favorites or notes.
   * @param {string} type - 'favorites' or 'notes'
   * @returns {string} HTML string
   */
  _renderEmptyState(type) {
    if (type === 'favorites') {
      return '<div class="fav-empty-state">' +
        '<div class="fav-empty-icon">&#11088;</div>' +
        '<h3>No tienes favoritos</h3>' +
        '<p>Marca vers&iacute;culos como favoritos mientras lees la Biblia. Aparecer&aacute;n aqu&iacute; para que puedas acceder r&aacute;pidamente a ellos.</p>' +
      '</div>';
    } else {
      return '<div class="fav-empty-state">' +
        '<div class="fav-empty-icon">&#128221;</div>' +
        '<h3>No tienes notas</h3>' +
        '<p>Agrega notas a los vers&iacute;culos mientras lees. Tus notas aparecer&aacute;n aqu&iacute; para referencia futura.</p>' +
      '</div>';
    }
  },

  /**
   * Attach tab switching listeners.
   * @param {HTMLElement} main - Main content element
   */
  _attachTabListeners(main) {
    var favTab = main.querySelector('#tab-favorites');
    var notesTab = main.querySelector('#tab-notes');

    if (favTab) {
      favTab.addEventListener('click', function() {
        if (FavoritesModule._activeTab !== 'favorites') {
          FavoritesModule.renderFavorites();
        }
      });
    }

    if (notesTab) {
      notesTab.addEventListener('click', function() {
        if (FavoritesModule._activeTab !== 'notes') {
          FavoritesModule.renderNotes();
        }
      });
    }
  },

  /**
   * Attach click listeners to the favorites list (event delegation).
   * @param {HTMLElement} container - Favorites content container
   */
  _attachFavoriteListListeners(container) {
    container.addEventListener('click', function(e) {
      // Check if remove button was clicked
      var removeBtn = e.target.closest('[data-action="remove-fav"]');
      if (removeBtn) {
        e.stopPropagation();
        var item = removeBtn.closest('.fav-item');
        if (item) {
          var bookId = parseInt(item.getAttribute('data-book-id'), 10);
          var chapter = parseInt(item.getAttribute('data-chapter'), 10);
          var verse = parseInt(item.getAttribute('data-verse'), 10);
          if (bookId && chapter && verse) {
            FavoritesModule.removeFavoriteItem(bookId, chapter, verse);
          }
        }
        return;
      }

      // Otherwise, navigate to verse
      var favItem = e.target.closest('.fav-item');
      if (favItem) {
        var bid = parseInt(favItem.getAttribute('data-book-id'), 10);
        var ch = parseInt(favItem.getAttribute('data-chapter'), 10);
        var vs = parseInt(favItem.getAttribute('data-verse'), 10);
        if (bid && ch) {
          App.navigate('#read/' + bid + '/' + ch);
          // Scroll to verse after navigation
          setTimeout(function() {
            var verseEl = document.getElementById('verse-' + vs);
            if (verseEl) {
              verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              verseEl.classList.add('verse-highlight');
              setTimeout(function() { verseEl.classList.remove('verse-highlight'); }, 3000);
            }
          }, 500);
        }
      }
    });
  },

  /**
   * Attach click listeners to the notes list (event delegation).
   * @param {HTMLElement} container - Notes content container
   */
  _attachNoteListListeners(container) {
    container.addEventListener('click', function(e) {
      var item = e.target.closest('.note-item');
      if (!item) return;

      var bookId = parseInt(item.getAttribute('data-book-id'), 10);
      var chapter = parseInt(item.getAttribute('data-chapter'), 10);
      var verse = parseInt(item.getAttribute('data-verse'), 10);

      if (!bookId || !chapter) return;

      // Check action buttons
      var editBtn = e.target.closest('[data-action="edit-note"]');
      if (editBtn) {
        e.stopPropagation();
        // Get current note from DB
        var noteObj = DB.getNote(bookId, chapter, verse);
        var currentNote = noteObj ? noteObj.note || '' : '';
        var verseText = noteObj ? noteObj.text || '' : '';
        FavoritesModule.editNote(bookId, chapter, verse, currentNote, verseText);
        return;
      }

      var deleteBtn = e.target.closest('[data-action="delete-note"]');
      if (deleteBtn) {
        e.stopPropagation();
        FavoritesModule.deleteNote(bookId, chapter, verse);
        return;
      }

      // Navigate to verse
      App.navigate('#read/' + bookId + '/' + chapter);
      setTimeout(function() {
        var verseEl = document.getElementById('verse-' + verse);
        if (verseEl) {
          verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          verseEl.classList.add('verse-highlight');
          setTimeout(function() { verseEl.classList.remove('verse-highlight'); }, 3000);
        }
      }, 500);
    });
  },

  /**
   * Truncate text to a maximum length, adding ellipsis if truncated.
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  _truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  },

  /**
   * Decode HTML entities in a string.
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

// Make FavoritesModule globally available
window.FavoritesModule = FavoritesModule;
