/* ============================================
   Biblia de Jerusalén - Application Module
   ============================================ */

const App = {
  currentView: null,
  currentBook: null,
  currentChapter: null,
  _searchTimeout: null,
  _activeLetter: null,

  async init() {
    var self = this;

    this._bindEvents();
    this._applyTheme();
    this._applyFontSize();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js').then(function(reg) {
          console.log('Service Worker registered:', reg.scope);
        }).catch(function(err) {
          console.warn('Service Worker registration failed:', err);
        });
      });
    }

    try {
      await DB.init();
    } catch (err) {
      console.error('Failed to initialize DB:', err);
      this.showToast('Error al cargar datos. Verifica tu conexión.');
    }

    this.handleRoute();
    window.addEventListener('hashchange', function() { self.handleRoute(); });
  },

  /* ---------- Event Binding ---------- */
  _bindEvents() {
    var self = this;

    document.getElementById('hamburger-btn').addEventListener('click', function() {
      self.showDrawer();
    });

    document.getElementById('drawer-overlay').addEventListener('click', function() {
      self.hideDrawer();
    });

    document.getElementById('drawer-close-btn').addEventListener('click', function() {
      self.hideDrawer();
    });

    document.getElementById('toolbar-theme-btn').addEventListener('click', function() {
      self.toggleTheme();
    });

    var drawerItems = document.querySelectorAll('.drawer-menu-item');
    drawerItems.forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        var href = item.getAttribute('href');
        self.hideDrawer();
        if (href) {
          window.location.hash = href;
        }
      });
    });

    var bottomBtns = document.querySelectorAll('.bottom-toolbar .nav-btn');
    bottomBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var nav = btn.getAttribute('data-nav');
        if (nav) {
          window.location.hash = '#' + nav;
        }
      });
    });

    document.addEventListener('click', function(e) {
      var verseBlock = e.target.closest('.verse-block');
      if (!verseBlock) return;
      if (e.target.closest('.verse-action-btn')) return;
      var bookId = parseInt(verseBlock.getAttribute('data-book'), 10);
      var chapter = parseInt(verseBlock.getAttribute('data-chapter'), 10);
      var verse = parseInt(verseBlock.getAttribute('data-verse'), 10);
      if (!isNaN(bookId) && !isNaN(chapter) && !isNaN(verse)) {
        self._showVerseMenu(bookId, chapter, verse, verseBlock);
      }
    });
  },

  /* ---------- Routing ---------- */
  navigate(view, params) {
    if (params) {
      var hash = '#' + view;
      if (typeof params === 'object') {
        var parts = [];
        for (var key in params) {
          if (params.hasOwnProperty(key)) {
            parts.push(encodeURIComponent(params[key]));
          }
        }
        if (parts.length > 0) {
          hash += '/' + parts.join('/');
        }
      }
      window.location.hash = hash;
    } else {
      window.location.hash = '#' + view;
    }
  },

  handleRoute() {
    var hash = window.location.hash || '#home';
    hash = hash.replace(/^#/, '');
    var parts = hash.split('/');
    var view = parts[0] || 'home';

    this._highlightBottomNav(view);
    this.hideDrawer();
    this._activeLetter = null;

    switch (view) {
      case 'home':
        this.renderHome();
        break;
      case 'books':
        this.renderBookList();
        break;
      case 'read':
        var bookId = parts[1] ? parseInt(parts[1], 10) : null;
        var chapter = parts[2] ? parseInt(parts[2], 10) : null;
        if (bookId && chapter) {
          this.renderReader(bookId, chapter);
        } else if (bookId) {
          this.renderChapterSelect(bookId);
        } else {
          this.renderBookList();
        }
        break;
      case 'search':
        this.renderSearch();
        break;
      case 'dictionary':
        this.renderDictionary();
        break;
      case 'verse-of-day':
        this.renderVerseOfDay();
        break;
      case 'favorites':
        this.renderFavorites();
        break;
      case 'notes':
        this.renderNotes();
        break;
      case 'settings':
        this.renderSettings();
        break;
      default:
        this.renderHome();
    }
  },

  _highlightBottomNav(view) {
    var map = {
      'home': 'home',
      'books': 'books',
      'read': 'books',
      'search': 'search',
      'favorites': 'favorites',
      'notes': 'favorites',
      'settings': 'settings'
    };
    var active = map[view] || 'home';
    var btns = document.querySelectorAll('.bottom-toolbar .nav-btn');
    btns.forEach(function(btn) {
      var nav = btn.getAttribute('data-nav');
      if (nav === active) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  /* ---------- View Renderers ---------- */
  renderHome() {
    this.setTitle('Biblia de Jerusalén');
    this.currentView = 'home';
    var html = '<div class="home-grid">';

    var cards = [
      { icon: '&#128214;', label: 'Libros', view: 'books' },
      { icon: '&#128269;', label: 'Buscar', view: 'search' },
      { icon: '&#128218;', label: 'Diccionario', view: 'dictionary' },
      { icon: '&#127775;', label: 'Versículo del Día', view: 'verse-of-day' },
      { icon: '&#11088;', label: 'Favoritos', view: 'favorites' },
      { icon: '&#128221;', label: 'Notas', view: 'notes' },
      { icon: '&#9881;', label: 'Configuración', view: 'settings' },
      { icon: '&#128214;', label: 'Leer la Biblia', view: 'books' }
    ];

    cards.forEach(function(card) {
      html += '<a class="home-card" href="#' + card.view + '">';
      html += '<span class="card-icon">' + card.icon + '</span>';
      html += '<span class="card-label">' + card.label + '</span>';
      html += '</a>';
    });

    html += '</div>';
    document.getElementById('main-content').innerHTML = html;
  },

  renderBookList() {
    this.setTitle('Libros');
    this.currentView = 'books';
    var self = this;

    if (!DB.dividers || !DB.books) {
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#128214;</div><div class="empty-text">Cargando libros...</div></div>';
      return;
    }

    var html = '<div class="book-list">';

    DB.dividers.forEach(function(divider) {
      var books = DB.getBooksByDivider(divider.id);
      if (books.length === 0) return;

      html += '<div class="divider-header" style="background-color: ' + self._escapeHtml(divider.color) + '">';
      html += self._escapeHtml(divider.name);
      html += '</div>';

      books.forEach(function(book) {
        html += '<div class="book-item" data-book="' + book.id + '">';
        html += '<span class="book-name">' + self._escapeHtml(book.name) + '</span>';
        html += '<span class="book-chapters">' + book.chapters + ' cap.</span>';
        html += '</div>';
      });
    });

    html += '</div>';
    document.getElementById('main-content').innerHTML = html;

    var items = document.querySelectorAll('.book-item');
    items.forEach(function(item) {
      item.addEventListener('click', function() {
        var bookId = parseInt(item.getAttribute('data-book'), 10);
        self.renderChapterSelect(bookId);
      });
    });
  },

  renderChapterSelect(bookId) {
    var book = DB.getBookById(bookId);
    if (!book) {
      this.renderBookList();
      return;
    }
    this.setTitle(book.name);
    this.currentView = 'chapter-select';
    this.currentBook = bookId;
    var self = this;

    var html = '<div style="max-width:var(--max-content-width);margin:0 auto;">';
    html += '<h2 style="text-align:center;margin-bottom:16px;color:var(--text-secondary);">' + self._escapeHtml(book.name) + '</h2>';
    html += '<div class="chapter-grid">';

    for (var c = 1; c <= book.chapters; c++) {
      html += '<button class="chapter-btn" data-chapter="' + c + '">' + c + '</button>';
    }

    html += '</div></div>';
    document.getElementById('main-content').innerHTML = html;

    var btns = document.querySelectorAll('.chapter-btn');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ch = parseInt(btn.getAttribute('data-chapter'), 10);
        self.navigate('read', { bookId: bookId, chapter: ch });
      });
    });
  },

  async renderReader(bookId, chapter) {
    var book = DB.getBookById(bookId);
    if (!book) {
      this.renderBookList();
      return;
    }
    this.setTitle(book.name + ' ' + chapter);
    this.currentView = 'reader';
    this.currentBook = bookId;
    this.currentChapter = chapter;
    var self = this;

    document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 16px;"></div><div class="empty-text">Cargando...</div></div>';

    try {
      var verses = await DB.getVerses(bookId);
      var chapterData = verses[String(chapter)];

      if (!chapterData) {
        document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#128214;</div><div class="empty-text">Capítulo no encontrado.</div></div>';
        return;
      }

      var hasPrev = chapter > 1;
      var hasNext = chapter < book.chapters;

      var html = '<div class="verse-container">';

      html += '<div class="reader-nav">';
      html += '<button class="nav-arrow" ' + (hasPrev ? '' : 'disabled') + ' id="prev-chapter" title="Capítulo anterior">&#9664;</button>';
      html += '<span class="chapter-info">' + self._escapeHtml(book.name) + ' ' + chapter + '</span>';
      html += '<button class="chapter-select-btn" id="chapter-select-btn">Capítulos</button>';
      html += '<button class="nav-arrow" ' + (hasNext ? '' : 'disabled') + ' id="next-chapter" title="Capítulo siguiente">&#9654;</button>';
      html += '</div>';

      var verseKeys = Object.keys(chapterData).sort(function(a, b) { return parseInt(a) - parseInt(b); });
      var isFav = DB.isFavorite.bind(DB);
      var hasNote = function(bk, ch, vs) { return DB.getNote(bk, ch, vs) !== null; };

      verseKeys.forEach(function(vKey) {
        var vNum = parseInt(vKey, 10);
        var text = chapterData[vKey];
        var favorited = isFav(bookId, chapter, vNum);
        var noted = hasNote(bookId, chapter, vNum);

        html += '<div class="verse-block" data-book="' + bookId + '" data-chapter="' + chapter + '" data-verse="' + vNum + '">';
        html += '<span class="verse-number">' + vNum + '</span>';
        html += '<span class="verse-text">' + self._escapeHtml(text) + '</span>';
        html += '<span class="verse-actions">';
        html += '<button class="verse-action-btn ' + (favorited ? 'favorited' : '') + '" data-action="fav" title="Favorito">&#9733;</button>';
        html += '<button class="verse-action-btn ' + (noted ? 'noted' : '') + '" data-action="note" title="Nota">&#128221;</button>';
        html += '<button class="verse-action-btn" data-action="copy" title="Copiar">&#128203;</button>';
        html += '</span>';
        html += '</div>';
      });

      html += '<div class="reader-nav" style="margin-top:20px;">';
      html += '<button class="nav-arrow" ' + (hasPrev ? '' : 'disabled') + ' id="prev-chapter2" title="Capítulo anterior">&#9664;</button>';
      html += '<span class="chapter-info">' + self._escapeHtml(book.name) + ' ' + chapter + '</span>';
      html += '<button class="nav-arrow" ' + (hasNext ? '' : 'disabled') + ' id="next-chapter2" title="Capítulo siguiente">&#9654;</button>';
      html += '</div>';

      html += '</div>';

      document.getElementById('main-content').innerHTML = html;

      self._bindReaderEvents(bookId, chapter, hasPrev, hasNext);
      self._bindVerseActions(bookId, chapter);

    } catch (err) {
      console.error('Failed to load verses:', err);
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;</div><div class="empty-text">Error al cargar el capítulo.</div></div>';
    }
  },

  _bindReaderEvents(bookId, chapter, hasPrev, hasNext) {
    var self = this;

    var prev1 = document.getElementById('prev-chapter');
    var next1 = document.getElementById('next-chapter');
    var prev2 = document.getElementById('prev-chapter2');
    var next2 = document.getElementById('next-chapter2');
    var chapBtn = document.getElementById('chapter-select-btn');

    if (prev1 && hasPrev) {
      prev1.addEventListener('click', function() { self.navigate('read', { bookId: bookId, chapter: chapter - 1 }); });
    }
    if (next1 && hasNext) {
      next1.addEventListener('click', function() { self.navigate('read', { bookId: bookId, chapter: chapter + 1 }); });
    }
    if (prev2 && hasPrev) {
      prev2.addEventListener('click', function() { self.navigate('read', { bookId: bookId, chapter: chapter - 1 }); });
    }
    if (next2 && hasNext) {
      next2.addEventListener('click', function() { self.navigate('read', { bookId: bookId, chapter: chapter + 1 }); });
    }
    if (chapBtn) {
      chapBtn.addEventListener('click', function() { self.renderChapterSelect(bookId); });
    }
  },

  _bindVerseActions(bookId, chapter) {
    var self = this;
    var verseBlocks = document.querySelectorAll('.verse-block');
    verseBlocks.forEach(function(block) {
      var vNum = parseInt(block.getAttribute('data-verse'), 10);
      var textEl = block.querySelector('.verse-text');
      var text = textEl ? textEl.textContent : '';

      var favBtn = block.querySelector('[data-action="fav"]');
      var noteBtn = block.querySelector('[data-action="note"]');
      var copyBtn = block.querySelector('[data-action="copy"]');

      if (favBtn) {
        favBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var isFav = DB.isFavorite(bookId, chapter, vNum);
          if (isFav) {
            DB.removeFavorite(bookId, chapter, vNum);
            favBtn.classList.remove('favorited');
            self.showToast('Eliminado de favoritos');
          } else {
            DB.addFavorite(bookId, chapter, vNum, text);
            favBtn.classList.add('favorited');
            self.showToast('Añadido a favoritos');
          }
        });
      }

      if (noteBtn) {
        noteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          self._showNoteEditor(bookId, chapter, vNum, text, noteBtn);
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var book = DB.getBookById(bookId);
          var ref = (book ? book.name : '') + ' ' + chapter + ':' + vNum;
          var copyText = ref + ' - ' + text;
          self._copyToClipboard(copyText);
          self.showToast('Copiado: ' + ref);
        });
      }
    });
  },

  _showVerseMenu(bookId, chapter, verse, verseBlock) {
    var self = this;
    var textEl = verseBlock.querySelector('.verse-text');
    var text = textEl ? textEl.textContent : '';
    var book = DB.getBookById(bookId);
    var ref = (book ? book.name : '') + ' ' + chapter + ':' + verse;

    var isFav = DB.isFavorite(bookId, chapter, verse);
    var noteObj = DB.getNote(bookId, chapter, verse);

    var menuHtml = '<div class="note-editor" style="margin-top:4px;">';
    menuHtml += '<p style="font-weight:600;margin-bottom:8px;">' + self._escapeHtml(ref) + '</p>';
    menuHtml += '<div style="display:flex;gap:12px;align-items:center;">';
    menuHtml += '<button class="verse-action-btn ' + (isFav ? 'favorited' : '') + '" id="vm-fav" title="' + (isFav ? 'Quitar de favoritos' : 'Añadir a favoritos') + '" style="font-size:1.5rem;">' + (isFav ? '&#9733;' : '&#9734;') + '</button>';
    menuHtml += '<button class="btn btn-secondary" id="vm-note" style="font-size:0.85rem;">&#128221; ' + (noteObj ? 'Editar nota' : 'Añadir nota') + '</button>';
    menuHtml += '<button class="btn btn-secondary" id="vm-copy" style="font-size:0.85rem;">&#128203; Copiar</button>';
    menuHtml += '</div></div>';

    var existingMenu = verseBlock.nextElementSibling;
    if (existingMenu && existingMenu.classList.contains('note-editor')) {
      existingMenu.remove();
      return;
    }

    document.querySelectorAll('.note-editor').forEach(function(el) { el.remove(); });

    verseBlock.insertAdjacentHTML('afterend', menuHtml);
    var menuEl = verseBlock.nextElementSibling;

    if (menuEl) {
      var favBtn = menuEl.querySelector('#vm-fav');
      var noteBtn = menuEl.querySelector('#vm-note');
      var copyBtn = menuEl.querySelector('#vm-copy');

      if (favBtn) {
        favBtn.addEventListener('click', function() {
          if (DB.isFavorite(bookId, chapter, verse)) {
            DB.removeFavorite(bookId, chapter, verse);
            self.showToast('Eliminado de favoritos');
          } else {
            DB.addFavorite(bookId, chapter, verse, text);
            self.showToast('Añadido a favoritos');
          }
          menuEl.remove();
          self.renderReader(bookId, chapter);
        });
      }
      if (noteBtn) {
        noteBtn.addEventListener('click', function() {
          menuEl.remove();
          var noteBtnEl = verseBlock.querySelector('[data-action="note"]');
          self._showNoteEditor(bookId, chapter, verse, text, noteBtnEl);
        });
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          var copyText = ref + ' - ' + text;
          self._copyToClipboard(copyText);
          self.showToast('Copiado: ' + ref);
          menuEl.remove();
        });
      }

    }
  },

  _showNoteEditor(bookId, chapter, verse, text, sourceBtn) {
    var self = this;
    var book = DB.getBookById(bookId);
    var ref = (book ? book.name : '') + ' ' + chapter + ':' + verse;
    var existingNote = DB.getNote(bookId, chapter, verse);

    var editorHtml = '<div class="note-editor" id="note-editor-inline">';
    editorHtml += '<p style="font-weight:600;margin-bottom:4px;">Nota para ' + self._escapeHtml(ref) + '</p>';
    editorHtml += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">' + self._escapeHtml(text.substring(0, 100)) + (text.length > 100 ? '...' : '') + '</p>';
    editorHtml += '<textarea id="note-textarea" placeholder="Escribe tu nota aquí...">' + self._escapeHtml(existingNote ? existingNote.note : '') + '</textarea>';
    editorHtml += '<div class="note-actions">';
    editorHtml += '<button class="btn btn-secondary" id="note-cancel">Cancelar</button>';
    if (existingNote) {
      editorHtml += '<button class="btn btn-secondary" id="note-delete" style="color:var(--error);">Eliminar</button>';
    }
    editorHtml += '<button class="btn btn-primary" id="note-save">Guardar</button>';
    editorHtml += '</div></div>';

    var existingEditors = document.querySelectorAll('#note-editor-inline');
    existingEditors.forEach(function(el) { el.remove(); });

    var targetBlock = sourceBtn ? sourceBtn.closest('.verse-block') : null;
    if (targetBlock) {
      targetBlock.insertAdjacentHTML('afterend', editorHtml);
    } else {
      document.getElementById('main-content').insertAdjacentHTML('beforeend', editorHtml);
    }

    var editorEl = document.getElementById('note-editor-inline');
    if (!editorEl) return;

    var textarea = editorEl.querySelector('#note-textarea');
    var saveBtn = editorEl.querySelector('#note-save');
    var cancelBtn = editorEl.querySelector('#note-cancel');
    var deleteBtn = editorEl.querySelector('#note-delete');

    if (textarea) textarea.focus();

    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var noteText = textarea ? textarea.value.trim() : '';
        if (noteText) {
          DB.addNote(bookId, chapter, verse, text, noteText);
          self.showToast('Nota guardada');
        } else {
          DB.removeNote(bookId, chapter, verse);
          self.showToast('Nota eliminada');
        }
        editorEl.remove();
        self.renderReader(bookId, chapter);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        editorEl.remove();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        DB.removeNote(bookId, chapter, verse);
        self.showToast('Nota eliminada');
        editorEl.remove();
        self.renderReader(bookId, chapter);
      });
    }
  },

  async renderSearch() {
    this.setTitle('Buscar');
    this.currentView = 'search';
    var self = this;

    var html = '<div class="search-container">';
    html += '<div class="search-input-wrapper">';
    html += '<input type="text" class="search-input" id="search-input" placeholder="Buscar en la Biblia..." autocomplete="off">';
    html += '<button class="search-clear" id="search-clear" style="display:none;">&times;</button>';
    html += '</div>';
    html += '<div class="search-options">';
    html += '<label><input type="checkbox" id="search-exact"> Palabra exacta</label>';
    html += '</div>';
    html += '<div id="search-status" style="text-align:center;color:var(--text-muted);font-size:0.85rem;"></div>';
    html += '<ul class="search-results" id="search-results"></ul>';
    html += '</div>';

    document.getElementById('main-content').innerHTML = html;

    var searchInput = document.getElementById('search-input');
    var searchClear = document.getElementById('search-clear');
    var searchExact = document.getElementById('search-exact');
    var searchStatus = document.getElementById('search-status');
    var searchResults = document.getElementById('search-results');

    if (searchInput) {
      setTimeout(function() { searchInput.focus(); }, 100);
      searchInput.addEventListener('input', function() {
        var val = searchInput.value;
        if (searchClear) searchClear.style.display = val ? 'block' : 'none';

        if (self._searchTimeout) clearTimeout(self._searchTimeout);
        self._searchTimeout = setTimeout(function() {
          self._performSearch(val, searchExact ? searchExact.checked : false, searchStatus, searchResults);
        }, 400);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        if (searchResults) searchResults.innerHTML = '';
        if (searchStatus) searchStatus.textContent = '';
        if (searchInput) searchInput.focus();
      });
    }

    if (searchExact) {
      searchExact.addEventListener('change', function() {
        var val = searchInput ? searchInput.value : '';
        if (val.trim().length >= 2) {
          self._performSearch(val, searchExact.checked, searchStatus, searchResults);
        }
      });
    }
  },

  async _performSearch(query, exactWord, statusEl, resultsEl) {
    var self = this;
    if (!query || query.trim().length < 2) {
      if (statusEl) statusEl.textContent = 'Escribe al menos 2 caracteres';
      if (resultsEl) resultsEl.innerHTML = '';
      return;
    }

    if (statusEl) statusEl.textContent = 'Buscando...';
    if (resultsEl) resultsEl.innerHTML = '';

    try {
      var results = await DB.search(query, exactWord);

      if (statusEl) {
        statusEl.textContent = results.length + ' resultado' + (results.length !== 1 ? 's' : '') + ' encontrado' + (results.length !== 1 ? 's' : '');
      }

      if (resultsEl) {
        if (results.length === 0) {
          resultsEl.innerHTML = '<li class="empty-state"><div class="empty-text">No se encontraron resultados.</div></li>';
        } else {
          var displayResults = results.slice(0, 200);
          var html = '';
          displayResults.forEach(function(r) {
            var highlightedText = self._highlightText(r.text, query, exactWord);
            html += '<li class="search-result-item" data-book="' + r.bookId + '" data-chapter="' + r.chapter + '" data-verse="' + r.verse + '">';
            html += '<div class="result-ref">' + self._escapeHtml(r.bookName) + ' ' + r.chapter + ':' + r.verse + '</div>';
            html += '<div class="result-text">' + highlightedText + '</div>';
            html += '</li>';
          });
          if (results.length > 200) {
            html += '<li class="empty-state"><div class="empty-text">Mostrando 200 de ' + results.length + ' resultados. Refina tu búsqueda.</div></li>';
          }
          resultsEl.innerHTML = html;

          var items = resultsEl.querySelectorAll('.search-result-item');
          items.forEach(function(item) {
            item.addEventListener('click', function() {
              var bk = parseInt(item.getAttribute('data-book'), 10);
              var ch = parseInt(item.getAttribute('data-chapter'), 10);
              var vs = parseInt(item.getAttribute('data-verse'), 10);
              self.navigate('read', { bookId: bk, chapter: ch });
              setTimeout(function() {
                var targetVerse = document.querySelector('.verse-block[data-verse="' + vs + '"]');
                if (targetVerse) {
                  targetVerse.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  targetVerse.classList.add('highlight');
                  setTimeout(function() { targetVerse.classList.remove('highlight'); }, 3000);
                }
              }, 500);
            });
          });
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      if (statusEl) statusEl.textContent = 'Error en la búsqueda';
    }
  },

  _highlightText(text, query, exactWord) {
    if (!query) return this._escapeHtml(text);
    var escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var pattern;
    if (exactWord) {
      pattern = new RegExp('(\\b' + escapedQuery + '\\b)', 'gi');
    } else {
      pattern = new RegExp('(' + escapedQuery + ')', 'gi');
    }
    return this._escapeHtml(text).replace(pattern, '<em>$1</em>');
  },

  async renderDictionary() {
    this.setTitle('Diccionario');
    this.currentView = 'dictionary';
    var self = this;

    if (!DB.dictionary) {
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#128218;</div><div class="empty-text">Cargando diccionario...</div></div>';
      return;
    }

    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var activeLetter = this._activeLetter;

    var html = '<div class="dictionary-container">';

    html += '<div class="search-input-wrapper">';
    html += '<input type="text" class="search-input" id="dict-search-input" placeholder="Buscar término..." autocomplete="off">';
    html += '<button class="search-clear" id="dict-search-clear" style="display:none;">&times;</button>';
    html += '</div>';

    html += '<div class="letter-index">';
    html += '<button class="letter-btn' + (!activeLetter ? ' active' : '') + '" data-letter="">Todo</button>';
    letters.forEach(function(l) {
      var hasTerms = DB.getDictionaryTerms(l).length > 0;
      html += '<button class="letter-btn' + (activeLetter === l ? ' active' : '') + (hasTerms ? '' : ' style="opacity:0.3;"') + '" data-letter="' + l + '"' + (hasTerms ? '' : ' disabled') + '>' + l + '</button>';
    });
    html += '</div>';

    html += '<div id="dict-terms-container"></div>';
    html += '</div>';

    document.getElementById('main-content').innerHTML = html;

    self._renderDictTerms(activeLetter);

    var letterBtns = document.querySelectorAll('.letter-btn');
    letterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var letter = btn.getAttribute('data-letter');
        self._activeLetter = letter || null;
        letterBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        self._renderDictTerms(letter || null);
        var dictSearch = document.getElementById('dict-search-input');
        if (dictSearch) dictSearch.value = '';
        var dictClear = document.getElementById('dict-search-clear');
        if (dictClear) dictClear.style.display = 'none';
      });
    });

    var dictSearch = document.getElementById('dict-search-input');
    var dictClear = document.getElementById('dict-search-clear');

    if (dictSearch) {
      dictSearch.addEventListener('input', function() {
        var val = dictSearch.value;
        if (dictClear) dictClear.style.display = val ? 'block' : 'none';
        if (val.trim().length >= 2) {
          self._renderDictSearch(val);
        } else {
          self._renderDictTerms(self._activeLetter);
        }
      });
    }

    if (dictClear) {
      dictClear.addEventListener('click', function() {
        if (dictSearch) dictSearch.value = '';
        dictClear.style.display = 'none';
        self._renderDictTerms(self._activeLetter);
        if (dictSearch) dictSearch.focus();
      });
    }
  },

  _renderDictTerms(letter) {
    var self = this;
    var terms = DB.getDictionaryTerms(letter);
    var container = document.getElementById('dict-terms-container');
    if (!container) return;

    if (terms.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-text">No hay términos para esta letra.</div></div>';
      return;
    }

    var html = '';
    terms.forEach(function(term) {
      html += '<div class="dict-term">';
      html += '<div class="dict-term-header">';
      html += '<span>' + self._escapeHtml(term.name) + '</span>';
      html += '<span class="expand-icon">&#9660;</span>';
      html += '</div>';
      html += '<div class="dict-term-body">' + self._escapeHtml(term.info) + '</div>';
      html += '</div>';
    });
    container.innerHTML = html;

    var headers = container.querySelectorAll('.dict-term-header');
    headers.forEach(function(header) {
      header.addEventListener('click', function() {
        var term = header.parentElement;
        var wasExpanded = term.classList.contains('expanded');
        container.querySelectorAll('.dict-term.expanded').forEach(function(t) { t.classList.remove('expanded'); });
        if (!wasExpanded) {
          term.classList.add('expanded');
        }
      });
    });
  },

  _renderDictSearch(query) {
    var self = this;
    var results = DB.searchDictionary(query);
    var container = document.getElementById('dict-terms-container');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-text">No se encontraron términos.</div></div>';
      return;
    }

    var html = '';
    results.forEach(function(term) {
      html += '<div class="dict-term">';
      html += '<div class="dict-term-header">';
      html += '<span>' + self._escapeHtml(term.name) + ' <span style="font-size:0.75rem;color:var(--text-muted);">(' + self._escapeHtml(term.letter) + ')</span></span>';
      html += '<span class="expand-icon">&#9660;</span>';
      html += '</div>';
      html += '<div class="dict-term-body">' + self._escapeHtml(term.info) + '</div>';
      html += '</div>';
    });
    container.innerHTML = html;

    var headers = container.querySelectorAll('.dict-term-header');
    headers.forEach(function(header) {
      header.addEventListener('click', function() {
        var term = header.parentElement;
        var wasExpanded = term.classList.contains('expanded');
        container.querySelectorAll('.dict-term.expanded').forEach(function(t) { t.classList.remove('expanded'); });
        if (!wasExpanded) {
          term.classList.add('expanded');
        }
      });
    });
  },

  async renderVerseOfDay() {
    this.setTitle('Versículo del Día');
    this.currentView = 'verse-of-day';

    document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto 16px;"></div><div class="empty-text">Cargando...</div></div>';

    try {
      var vod = await DB.resolveVerseOfDay();
      if (!vod) {
        document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#127775;</div><div class="empty-text">No se pudo cargar el versículo del día.</div></div>';
        return;
      }

      var today = new Date();
      var dateStr = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      var html = '<div class="votd-container">';
      html += '<div class="votd-card">';
      html += '<div class="votd-title">' + this._escapeHtml(dateStr) + '</div>';
      html += '<div class="votd-text">"' + this._escapeHtml(vod.text) + '"</div>';
      html += '<div class="votd-ref">' + this._escapeHtml(vod.bookName) + ' ' + vod.chapter + ':' + vod.verse + '</div>';
      html += '<div style="margin-top:16px;">';
      html += '<button class="btn btn-primary" id="votd-read">Leer capítulo</button>';
      html += '</div>';
      html += '</div></div>';

      document.getElementById('main-content').innerHTML = html;

      var readBtn = document.getElementById('votd-read');
      if (readBtn) {
        var self = this;
        readBtn.addEventListener('click', function() {
          self.navigate('read', { bookId: vod.bookId, chapter: vod.chapter });
        });
      }
    } catch (err) {
      console.error('Failed to load verse of day:', err);
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#127775;</div><div class="empty-text">Error al cargar el versículo del día.</div></div>';
    }
  },

  renderFavorites() {
    this.setTitle('Favoritos');
    this.currentView = 'favorites';
    var self = this;

    var favs = DB.getFavorites();

    if (favs.length === 0) {
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#11088;</div><div class="empty-text">No tienes versículos favoritos.<br>Toca una estrella junto a un versículo para añadirlo.</div></div>';
      return;
    }

    favs.sort(function(a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });

    var html = '<ul class="saved-list">';
    favs.forEach(function(fav) {
      var book = DB.getBookById(fav.bookId);
      var bookName = book ? book.name : 'Libro ' + fav.bookId;
      html += '<li class="saved-item" data-book="' + fav.bookId + '" data-chapter="' + fav.chapter + '" data-verse="' + fav.verse + '">';
      html += '<span class="saved-ref">' + self._escapeHtml(bookName) + ' ' + fav.chapter + ':' + fav.verse + '</span>';
      html += '<span class="saved-text">' + self._escapeHtml(fav.text.substring(0, 150)) + (fav.text.length > 150 ? '...' : '') + '</span>';
      html += '<button class="saved-remove" title="Eliminar">&times;</button>';
      html += '</li>';
    });
    html += '</ul>';

    document.getElementById('main-content').innerHTML = html;

    var items = document.querySelectorAll('.saved-item');
    items.forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.saved-remove')) return;
        var bk = parseInt(item.getAttribute('data-book'), 10);
        var ch = parseInt(item.getAttribute('data-chapter'), 10);
        self.navigate('read', { bookId: bk, chapter: ch });
      });

      var removeBtn = item.querySelector('.saved-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var bk = parseInt(item.getAttribute('data-book'), 10);
          var ch = parseInt(item.getAttribute('data-chapter'), 10);
          var vs = parseInt(item.getAttribute('data-verse'), 10);
          DB.removeFavorite(bk, ch, vs);
          self.showToast('Eliminado de favoritos');
          self.renderFavorites();
        });
      }
    });
  },

  renderNotes() {
    this.setTitle('Notas');
    this.currentView = 'notes';
    var self = this;

    var notes = DB.getNotes();

    if (notes.length === 0) {
      document.getElementById('main-content').innerHTML = '<div class="empty-state"><div class="empty-icon">&#128221;</div><div class="empty-text">No tienes notas.<br>Toca el icono de nota junto a un versículo para añadir una.</div></div>';
      return;
    }

    notes.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    var html = '<ul class="saved-list">';
    notes.forEach(function(note) {
      var book = DB.getBookById(note.bookId);
      var bookName = book ? book.name : 'Libro ' + note.bookId;
      html += '<li class="saved-item" data-book="' + note.bookId + '" data-chapter="' + note.chapter + '" data-verse="' + note.verse + '">';
      html += '<span class="saved-ref">' + self._escapeHtml(bookName) + ' ' + note.chapter + ':' + note.verse + '</span>';
      html += '<div style="flex:1;">';
      html += '<div class="saved-text">' + self._escapeHtml(note.text.substring(0, 100)) + (note.text.length > 100 ? '...' : '') + '</div>';
      html += '<div class="saved-note">' + self._escapeHtml(note.note) + '</div>';
      html += '</div>';
      html += '<button class="saved-remove" title="Eliminar nota">&times;</button>';
      html += '</li>';
    });
    html += '</ul>';

    document.getElementById('main-content').innerHTML = html;

    var items = document.querySelectorAll('.saved-item');
    items.forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.saved-remove')) return;
        var bk = parseInt(item.getAttribute('data-book'), 10);
        var ch = parseInt(item.getAttribute('data-chapter'), 10);
        self.navigate('read', { bookId: bk, chapter: ch });
      });

      var removeBtn = item.querySelector('.saved-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var bk = parseInt(item.getAttribute('data-book'), 10);
          var ch = parseInt(item.getAttribute('data-chapter'), 10);
          var vs = parseInt(item.getAttribute('data-verse'), 10);
          DB.removeNote(bk, ch, vs);
          self.showToast('Nota eliminada');
          self.renderNotes();
        });
      }
    });
  },

  renderSettings() {
    this.setTitle('Configuración');
    this.currentView = 'settings';
    var self = this;

    var isDark = document.body.classList.contains('dark');
    var fontSize = DB.getSetting('fontSize', 'medium');
    var currentFontSize = getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();

    var html = '<div class="settings-container">';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">Apariencia</div>';

    html += '<div class="settings-row">';
    html += '<div><div class="setting-label">Modo oscuro</div><div class="setting-desc">Tema oscuro para lectura nocturna</div></div>';
    html += '<label class="toggle-switch">';
    html += '<input type="checkbox" id="setting-dark-mode" ' + (isDark ? 'checked' : '') + '>';
    html += '<span class="toggle-slider"></span>';
    html += '</label>';
    html += '</div>';

    html += '<div class="settings-row">';
    html += '<div><div class="setting-label">Tamaño de letra</div><div class="setting-desc">Ajusta el tamaño del texto</div></div>';
    html += '<div class="font-size-controls">';
    html += '<button class="font-size-btn' + (fontSize === 'small' ? ' active' : '') + '" data-size="small">A</button>';
    html += '<button class="font-size-btn' + (fontSize === 'medium' ? ' active' : '') + '" data-size="medium">A</button>';
    html += '<button class="font-size-btn' + (fontSize === 'large' ? ' active' : '') + '" data-size="large">A</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">Información</div>';
    html += '<div class="settings-row">';
    html += '<div class="setting-label">Versión</div>';
    html += '<div style="color:var(--text-muted);">Biblia de Jerusalén</div>';
    html += '</div>';
    html += '<div class="settings-row">';
    html += '<div class="setting-label">Libros</div>';
    html += '<div style="color:var(--text-muted);">73 (Antiguo y Nuevo Testamento)</div>';
    html += '</div>';
    html += '<div class="settings-row">';
    html += '<div class="setting-label">Diccionario</div>';
    html += '<div style="color:var(--text-muted);">952 términos</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">Datos</div>';
    html += '<div class="settings-row">';
    html += '<div class="setting-label">Eliminar todos los favoritos</div>';
    html += '<button class="btn btn-secondary" id="clear-favs" style="font-size:0.8rem;color:var(--error);">Eliminar</button>';
    html += '</div>';
    html += '<div class="settings-row">';
    html += '<div class="setting-label">Eliminar todas las notas</div>';
    html += '<button class="btn btn-secondary" id="clear-notes" style="font-size:0.8rem;color:var(--error);">Eliminar</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    document.getElementById('main-content').innerHTML = html;

    var darkToggle = document.getElementById('setting-dark-mode');
    if (darkToggle) {
      darkToggle.addEventListener('change', function() {
        self.toggleTheme();
      });
    }

    var fontSizeBtns = document.querySelectorAll('.font-size-btn');
    fontSizeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var size = btn.getAttribute('data-size');
        self.setFontSize(size);
        fontSizeBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    var clearFavs = document.getElementById('clear-favs');
    if (clearFavs) {
      clearFavs.addEventListener('click', function() {
        if (confirm('¿Eliminar todos los favoritos? Esta acción no se puede deshacer.')) {
          try { localStorage.removeItem('biblia_favorites'); } catch(e) {}
          self.showToast('Favoritos eliminados');
        }
      });
    }

    var clearNotes = document.getElementById('clear-notes');
    if (clearNotes) {
      clearNotes.addEventListener('click', function() {
        if (confirm('¿Eliminar todas las notas? Esta acción no se puede deshacer.')) {
          try { localStorage.removeItem('biblia_notes'); } catch(e) {}
          self.showToast('Notas eliminadas');
        }
      });
    }
  },

  /* ---------- UI Helpers ---------- */
  showDrawer() {
    document.getElementById('sidebar-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
  },

  hideDrawer() {
    document.getElementById('sidebar-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
  },

  toggleTheme() {
    var body = document.body;
    body.classList.toggle('dark');
    var isDark = body.classList.contains('dark');
    DB.setSetting('darkMode', isDark);
    var themeBtn = document.getElementById('toolbar-theme-btn');
    if (themeBtn) {
      themeBtn.innerHTML = isDark ? '&#9789;' : '&#9788;';
    }
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#1a1210' : '#5c3d2e');
    }
  },

  _applyTheme() {
    var isDark = DB.getSetting('darkMode', false);
    if (isDark) {
      document.body.classList.add('dark');
    }
    var themeBtn = document.getElementById('toolbar-theme-btn');
    if (themeBtn) {
      themeBtn.innerHTML = isDark ? '&#9789;' : '&#9788;';
    }
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#1a1210' : '#5c3d2e');
    }
  },

  setFontSize(size) {
    var sizes = {
      small: '14px',
      medium: '16px',
      large: '19px'
    };
    var fontSize = sizes[size] || '16px';
    document.documentElement.style.setProperty('--font-size', fontSize);
    DB.setSetting('fontSize', size);
  },

  _applyFontSize() {
    var size = DB.getSetting('fontSize', 'medium');
    this.setFontSize(size);
  },

  showToast(message) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  },

  showLoading() {
    document.getElementById('loading-overlay').classList.add('visible');
  },

  hideLoading() {
    document.getElementById('loading-overlay').classList.remove('visible');
  },

  setTitle(title) {
    document.getElementById('toolbar-title').textContent = title;
    document.title = title + ' - Biblia de Jerusalén';
  },

  /* ---------- Utilities ---------- */
  _escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  },

  _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function(err) {
        console.warn('Clipboard write failed:', err);
      });
    } else {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch(e) {
        console.warn('execCommand copy failed:', e);
      }
      document.body.removeChild(textarea);
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
