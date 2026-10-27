/**
 * BookList module - renders the book list with sticky section headers.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const BookList = {

  /**
   * Render the full book list with sticky section headers.
   * Groups books by their divider (section), renders each group under
   * a colored sticky header row.
   */
  async render() {
    var main = App.getMainContent();
    if (!main) return;

    App.showLoading();
    main.innerHTML = '';

    try {
      var books = DB.books;
      var dividers = DB.dividers;
      if (!books || !dividers) {
        main.innerHTML = '<div class="error-state"><p>Error al cargar los libros. Intente de nuevo.</p></div>';
        App.hideLoading();
        return;
      }

      // Build a map: dividerId -> { divider, books[] }
      var dividerMap = {};
      var orphanBooks = [];

      for (var divider of dividers) {
        dividerMap[divider.id] = { divider: divider, books: [] };
      }

      for (var book of books) {
        if (book.divider && dividerMap[book.divider]) {
          dividerMap[book.divider].books.push(book);
        } else {
          orphanBooks.push(book);
        }
      }

      // Build HTML
      var html = '<div class="book-list-container">';

      for (var entry of Object.values(dividerMap)) {
        if (entry.books.length === 0) continue;
        html += BookList.createStickyHeader(entry.divider);
        for (var book of entry.books) {
          html += BookList.createBookRow(book, entry.divider.color);
        }
      }

      // Orphan books (no divider) - group under a generic header
      if (orphanBooks.length > 0) {
        html += BookList.createStickyHeader({ name: 'Otros', color: '#757575' });
        for (var book of orphanBooks) {
          html += BookList.createBookRow(book, '#757575');
        }
      }

      html += '</div>';
      main.innerHTML = html;

      // Attach event delegation for book row clicks
      var listContainer = main.querySelector('.book-list-container');
      if (listContainer) {
        listContainer.addEventListener('click', function(e) {
          var row = e.target.closest('.book-row');
          if (!row) return;
          var bookId = parseInt(row.getAttribute('data-book-id'), 10);
          var chapters = parseInt(row.getAttribute('data-chapters'), 10);
          if (bookId) {
            // If book has only 1 chapter, go directly to reader
            if (chapters === 1) {
              App.navigate('#read/' + bookId + '/1');
            } else {
              BookList.renderChapterPicker(bookId);
            }
          }
        });
      }

    } catch (err) {
      console.error('BookList.render error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar los libros: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    } finally {
      App.hideLoading();
    }
  },

  /**
   * Render a chapter picker (grid/list) for a specific book.
   * @param {number} bookId - The book ID
   */
  async renderChapterPicker(bookId) {
    var main = App.getMainContent();
    if (!main) return;

    try {
      var books = DB.books;
      var book = books.find(function(b) { return b.id === bookId; });
      if (!book) {
        main.innerHTML = '<div class="error-state"><p>Libro no encontrado.</p></div>';
        return;
      }

      var divider = DB.dividers.find(function(d) { return d.id === book.divider; });
      var dividerColor = divider ? divider.color : '#757575';

      var html = '<div class="chapter-picker-container">';
      html += '<div class="chapter-picker-header">';
      html += '<button class="back-btn" id="back-to-book-list">&larr; Volver</button>';
      html += '<h2>' + App.escapeHtml(book.name) + '</h2>';
      html += '<span class="chapter-count">' + book.chapters + ' cap&iacute;tulos</span>';
      html += '</div>';
      html += '<div class="chapter-grid">';

      for (var ch = 1; ch <= book.chapters; ch++) {
        html += '<button class="chapter-btn" data-book-id="' + bookId + '" data-chapter="' + ch + '" style="border-left: 3px solid ' + dividerColor + '">' + ch + '</button>';
      }

      html += '</div></div>';
      main.innerHTML = html;

      // Back button
      var backBtn = main.querySelector('#back-to-book-list');
      if (backBtn) {
        backBtn.addEventListener('click', function() {
          BookList.render();
        });
      }

      // Chapter button clicks
      var chapterGrid = main.querySelector('.chapter-grid');
      if (chapterGrid) {
        chapterGrid.addEventListener('click', function(e) {
          var btn = e.target.closest('.chapter-btn');
          if (!btn) return;
          var bid = parseInt(btn.getAttribute('data-book-id'), 10);
          var ch = parseInt(btn.getAttribute('data-chapter'), 10);
          if (bid && ch) {
            App.navigate('#read/' + bid + '/' + ch);
          }
        });
      }

    } catch (err) {
      console.error('BookList.renderChapterPicker error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar cap&iacute;tulos: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    }
  },

  /**
   * Create an HTML string for a book row.
   * @param {Object} book - Book object { id, name, chapters, divider }
   * @param {string} dividerColor - Hex color string
   * @returns {string} HTML string
   */
  createBookRow(book, dividerColor) {
    return '<div class="book-row" data-book-id="' + book.id + '" data-chapters="' + book.chapters + '" style="border-left: 4px solid ' + dividerColor + '">' +
      '<span class="book-name">' + App.escapeHtml(book.name) + '</span>' +
      '<span class="book-chapters-badge">' + book.chapters + '</span>' +
    '</div>';
  },

  /**
   * Create an HTML string for a sticky section header.
   * @param {Object} divider - Divider object { id, name, color }
   * @returns {string} HTML string
   */
  createStickyHeader(divider) {
    return '<div class="sticky-header" style="background-color: ' + divider.color + '; color: #ffffff; position: sticky; top: 56px; z-index: 10; padding: 8px 16px; font-weight: bold; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">' +
      App.escapeHtml(divider.name) +
    '</div>';
  }
};

// Make BookList globally available
window.BookList = BookList;
