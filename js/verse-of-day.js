/**
 * VerseOfDay module - displays a daily Bible verse in a beautiful card format.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const VerseOfDay = {
  _currentVerse: null,

  /**
   * Render the verse of the day card.
   * Uses DB.resolveVerseOfDay() which returns the fully resolved verse
   * with bookName, bookId, chapter, verse, and text.
   */
  async render() {
    var main = App.getMainContent();
    if (!main) return;

    App.showLoading();
    main.innerHTML = '';

    try {
      // DB.resolveVerseOfDay() returns full verse data with text
      var verseData = await DB.resolveVerseOfDay();
      if (!verseData || !verseData.text) {
        main.innerHTML = '<div class="error-state"><p>No se pudo cargar el vers&iacute;culo del d&iacute;a.</p></div>';
        App.hideLoading();
        return;
      }

      this._currentVerse = verseData;
      VerseOfDay._renderVerseCard(main, verseData);

    } catch (err) {
      console.error('VerseOfDay.render error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar el vers&iacute;culo del d&iacute;a: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    } finally {
      App.hideLoading();
    }
  },

  /**
   * Render the verse card HTML into the main element.
   * @param {HTMLElement} main - Main content element
   * @param {Object} verseData - Verse data { bookName, bookId, chapter, verse, text }
   */
  _renderVerseCard(main, verseData) {
    var bookName = verseData.bookName || 'Desconocido';
    var chapter = verseData.chapter || 1;
    var verse = verseData.verse || 1;
    var text = verseData.text || '';

    var html = '<div class="verse-of-day-container">';

    // Header
    html += '<div class="vod-header">';
    html += '<h2>Vers&iacute;culo del D&iacute;a</h2>';
    html += '<p class="vod-date">' + VerseOfDay._getFormattedDate() + '</p>';
    html += '</div>';

    // Verse card
    html += '<div class="vod-card">';
    html += '<div class="vod-card-inner">';
    html += '<div class="vod-reference">' + App.escapeHtml(bookName) + ' ' + chapter + ':' + verse + '</div>';
    html += '<div class="vod-divider"></div>';
    html += '<blockquote class="vod-text">' + VerseOfDay._decodeEntities(text) + '</blockquote>';
    html += '</div>';
    html += '</div>';

    // Action buttons
    html += '<div class="vod-actions">';
    html += '<button class="vod-btn share-btn" id="vod-share-btn" title="Compartir vers&iacute;culo">';
    html += '<span class="vod-btn-icon">&#128228;</span>';
    html += '<span class="vod-btn-label">Compartir</span>';
    html += '</button>';
    html += '<button class="vod-btn refresh-btn" id="vod-refresh-btn" title="Otro vers&iacute;culo aleatorio">';
    html += '<span class="vod-btn-icon">&#128260;</span>';
    html += '<span class="vod-btn-label">Otro Vers&iacute;culo</span>';
    html += '</button>';
    html += '<button class="vod-btn read-btn" id="vod-read-btn" title="Leer cap&iacute;tulo completo">';
    html += '<span class="vod-btn-icon">&#128214;</span>';
    html += '<span class="vod-btn-label">Leer Cap&iacute;tulo</span>';
    html += '</button>';
    html += '</div>';

    html += '</div>';

    main.innerHTML = html;

    // Attach event listeners
    VerseOfDay._attachListeners(main, verseData);
  },

  /**
   * Refresh to show a truly random verse (not date-based).
   * Implements random verse selection locally since DB has no getRandomVerse.
   */
  async refreshRandom() {
    var main = App.getMainContent();
    if (!main) return;

    // Show a subtle loading on the card
    var card = main.querySelector('.vod-card');
    if (card) {
      card.style.opacity = '0.5';
      card.style.transition = 'opacity 0.2s ease';
    }

    try {
      // Generate a random verse
      var verseData = await VerseOfDay._getRandomVerse();
      if (!verseData) {
        App.showToast('No se pudo cargar otro vers&iacute;culo');
        if (card) card.style.opacity = '1';
        return;
      }

      this._currentVerse = verseData;

      // Update the card content
      var referenceEl = main.querySelector('.vod-reference');
      var textEl = main.querySelector('.vod-text');

      if (referenceEl) {
        referenceEl.textContent = (verseData.bookName || 'Desconocido') + ' ' + (verseData.chapter || 1) + ':' + (verseData.verse || 1);
      }
      if (textEl) {
        textEl.textContent = VerseOfDay._decodeEntities(verseData.text || '');
      }

      // Rebind event listeners with new verse data
      VerseOfDay._rebindListeners(main, verseData);

      // Fade card back in
      if (card) {
        card.style.opacity = '1';
      }

      // Brief highlight effect
      if (card) {
        card.classList.add('vod-card-refreshed');
        setTimeout(function() { card.classList.remove('vod-card-refreshed'); }, 1000);
      }

      App.showToast('Nuevo vers&iacute;culo cargado');

    } catch (err) {
      console.error('VerseOfDay.refreshRandom error:', err);
      App.showToast('Error al cargar otro vers&iacute;culo');
      if (card) card.style.opacity = '1';
    }
  },

  /**
   * Get a truly random verse from the entire Bible.
   * Picks a random book, random chapter, random verse.
   * @returns {Promise<Object>} Verse data { bookName, bookId, chapter, verse, text }
   */
  async _getRandomVerse() {
    if (!DB.manifest || !DB.manifest.books || DB.manifest.books.length === 0) {
      return null;
    }

    var books = DB.manifest.books;
    var maxAttempts = 20;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      // Pick a random book
      var bookIndex = Math.floor(Math.random() * books.length);
      var book = books[bookIndex];

      // Pick a random chapter
      var chapter = Math.floor(Math.random() * book.chapters) + 1;

      try {
        // Load verses for this book
        var verseData = await DB.getVerses(book.id);
        var chapterData = verseData[String(chapter)];

        if (!chapterData || typeof chapterData !== 'object') continue;

        var verseKeys = Object.keys(chapterData);
        if (verseKeys.length === 0) continue;

        // Pick a random verse
        var verseIndex = Math.floor(Math.random() * verseKeys.length);
        var verseNum = parseInt(verseKeys[verseIndex], 10);
        var text = chapterData[verseKeys[verseIndex]];

        if (text && text.trim().length > 0) {
          return {
            bookName: book.name,
            bookId: book.id,
            chapter: chapter,
            verse: verseNum,
            text: text
          };
        }
      } catch (e) {
        // Skip this book and try another
        continue;
      }
    }

    // Fallback: try to use resolveVerseOfDay as a fallback
    try {
      return await DB.resolveVerseOfDay();
    } catch (e) {
      return null;
    }
  },

  /**
   * Share the verse using Web Share API or clipboard fallback.
   * @param {Object} verseData - Verse data object
   */
  _shareVerse(verseData) {
    var bookName = verseData.bookName || '';
    var chapter = verseData.chapter || 1;
    var verse = verseData.verse || 1;
    var text = VerseOfDay._decodeEntities(verseData.text || '');
    var shareText = bookName + ' ' + chapter + ':' + verse + ' - ' + text;

    if (navigator.share) {
      navigator.share({
        title: 'Vers&iacute;culo del D&iacute;a - ' + bookName + ' ' + chapter + ':' + verse,
        text: shareText
      }).catch(function(err) {
        if (err.name !== 'AbortError') {
          VerseOfDay._copyToClipboard(shareText);
        }
      });
    } else {
      VerseOfDay._copyToClipboard(shareText);
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
        VerseOfDay._fallbackCopy(text);
      });
    } else {
      VerseOfDay._fallbackCopy(text);
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
   * Decode HTML entities in text.
   * @param {string} text - Text that may contain HTML entities
   * @returns {string} Decoded text
   */
  _decodeEntities(text) {
    if (!text) return '';
    var textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  },

  /**
   * Get today's date formatted in Spanish locale.
   * @returns {string} Formatted date string
   */
  _getFormattedDate() {
    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      return now.toLocaleDateString('es-ES', options);
    } catch (e) {
      return now.toLocaleDateString();
    }
  },

  /**
   * Attach event listeners to the verse of the day UI.
   * @param {HTMLElement} main - Main content element
   * @param {Object} verseData - Current verse data
   */
  _attachListeners(main, verseData) {
    VerseOfDay._rebindListeners(main, verseData);
  },

  /**
   * Rebind event listeners (used after card content update).
   * Clones and replaces buttons to avoid duplicate listeners.
   * @param {HTMLElement} main - Main content element
   * @param {Object} verseData - Verse data object
   */
  _rebindListeners(main, verseData) {
    // Share button
    var shareBtn = main.querySelector('#vod-share-btn');
    if (shareBtn) {
      var newShareBtn = shareBtn.cloneNode(true);
      shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
      newShareBtn.addEventListener('click', function() {
        VerseOfDay._shareVerse(verseData);
      });
    }

    // Refresh button
    var refreshBtn = main.querySelector('#vod-refresh-btn');
    if (refreshBtn) {
      var newRefreshBtn = refreshBtn.cloneNode(true);
      refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
      newRefreshBtn.addEventListener('click', function() {
        VerseOfDay.refreshRandom();
      });
    }

    // Read chapter button
    var readBtn = main.querySelector('#vod-read-btn');
    if (readBtn) {
      var newReadBtn = readBtn.cloneNode(true);
      readBtn.parentNode.replaceChild(newReadBtn, readBtn);
      newReadBtn.addEventListener('click', function() {
        App.navigate('#read/' + verseData.bookId + '/' + verseData.chapter);
      });
    }
  }
};

// Make VerseOfDay globally available
window.VerseOfDay = VerseOfDay;
