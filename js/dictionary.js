/**
 * DictionaryModule - Biblical dictionary with alphabet index and search.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const DictionaryModule = {
  _allTerms: [],
  _currentLetter: null,
  _expandedTerms: {},

  /**
   * Render the dictionary interface with alphabet index bar,
   * search input, and the first letter's terms displayed by default.
   */
  async render() {
    var main = App.getMainContent();
    if (!main) return;

    App.showLoading();
    main.innerHTML = '';

    try {
      // DB.dictionaryIndex is a preloaded property: { "A": ["ABAD", ...], "B": [...], ... }
      var index = DB.dictionaryIndex;
      if (!index) {
        main.innerHTML = '<div class="error-state"><p>Error al cargar el diccionario.</p></div>';
        App.hideLoading();
        return;
      }

      var availableLetters = Object.keys(index).filter(function(letter) {
        return index[letter] && index[letter].length > 0;
      }).sort();

      if (availableLetters.length === 0) {
        main.innerHTML = '<div class="error-state"><p>No se encontraron t&eacute;rminos en el diccionario.</p></div>';
        App.hideLoading();
        return;
      }

      // Load all terms using DB.getDictionaryTerms() with no letter filter
      this._allTerms = DB.getDictionaryTerms(null) || [];

      var html = '<div class="dictionary-container">';

      // Header
      html += '<div class="dictionary-header">';
      html += '<h2>Diccionario B&iacute;blico</h2>';
      html += '</div>';

      // Search input
      html += '<div class="dictionary-search-area">';
      html += '<input type="text" class="dictionary-search-input" id="dict-search-input" placeholder="Buscar t&eacute;rmino..." autocomplete="off">';
      html += '</div>';

      // Alphabet index bar
      html += DictionaryModule.renderLetterIndex(availableLetters);

      // Terms container
      html += '<div class="dictionary-terms-container" id="dict-terms-container">';
      html += '</div>';

      html += '</div>';
      main.innerHTML = html;

      // Attach listeners
      DictionaryModule._attachListeners(main);

      // Load first letter's terms by default
      if (availableLetters.length > 0) {
        DictionaryModule.filterByLetter(availableLetters[0]);
        // Highlight first letter
        var firstLetterBtn = main.querySelector('.dict-letter-btn[data-letter="' + availableLetters[0] + '"]');
        if (firstLetterBtn) firstLetterBtn.classList.add('active');
      }

    } catch (err) {
      console.error('DictionaryModule.render error:', err);
      main.innerHTML = '<div class="error-state"><p>Error al cargar el diccionario: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    } finally {
      App.hideLoading();
    }
  },

  /**
   * Render the horizontal scrollable alphabet index bar.
   * @param {string[]} availableLetters - Array of letters that have dictionary terms
   * @returns {string} HTML string
   */
  renderLetterIndex(availableLetters) {
    if (!availableLetters || availableLetters.length === 0) return '';

    var html = '<div class="dict-letter-index" id="dict-letter-index">';
    for (var i = 0; i < availableLetters.length; i++) {
      var letter = availableLetters[i];
      html += '<button class="dict-letter-btn" data-letter="' + letter + '">' + letter + '</button>';
    }
    html += '</div>';
    return html;
  },

  /**
   * Render a list of dictionary terms.
   * Each term is expandable/collapsible to show/hide the definition.
   * @param {Object[]} terms - Array of term objects { id, name, info, letter }
   * @param {HTMLElement} [container] - Container to render into (defaults to #dict-terms-container)
   */
  renderTerms(terms, container) {
    if (!container) {
      container = document.getElementById('dict-terms-container');
    }
    if (!container) return;

    if (!terms || terms.length === 0) {
      container.innerHTML = '<div class="dict-empty-state"><p>No se encontraron t&eacute;rminos.</p></div>';
      return;
    }

    var html = '<div class="dict-terms-list">';
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var isExpanded = this._expandedTerms[term.id] || false;
      html += DictionaryModule._createTermItem(term, isExpanded);
    }
    html += '</div>';
    html += '<div class="dict-term-count">' + terms.length + ' t&eacute;rmino' + (terms.length !== 1 ? 's' : '') + '</div>';
    container.innerHTML = html;
  },

  /**
   * Create HTML for a single dictionary term item.
   * @param {Object} term - Term object { id, name, info, letter }
   * @param {boolean} isExpanded - Whether the definition is visible
   * @returns {string} HTML string
   */
  _createTermItem(term, isExpanded) {
    var expandedClass = isExpanded ? ' expanded' : '';
    var infoHtml = term.info || 'Sin definici&oacute;n disponible.';
    return '<div class="dict-term-item' + expandedClass + '" data-term-id="' + term.id + '">' +
      '<div class="dict-term-header">' +
        '<span class="dict-term-name">' + App.escapeHtml(term.name) + '</span>' +
        '<span class="dict-term-toggle">' + (isExpanded ? '&#9660;' : '&#9654;') + '</span>' +
      '</div>' +
      '<div class="dict-term-info"' + (isExpanded ? '' : ' style="display:none;"') + '>' +
        '<p>' + infoHtml + '</p>' +
      '</div>' +
    '</div>';
  },

  /**
   * Filter terms by starting letter and render them.
   * @param {string} letter - Single uppercase letter (e.g., "A")
   */
  filterByLetter(letter) {
    this._currentLetter = letter;

    var container = document.getElementById('dict-terms-container');
    if (!container) return;

    // Show loading
    container.innerHTML = '<div class="dict-loading"><div class="spinner"></div><p>Cargando...</p></div>';

    try {
      // Use preloaded terms if available, otherwise fetch from DB
      var filteredTerms;
      if (this._allTerms && this._allTerms.length > 0) {
        filteredTerms = this._allTerms.filter(function(t) {
          return t.letter && t.letter.toUpperCase() === letter.toUpperCase();
        });
      } else {
        // Fallback: fetch from DB
        filteredTerms = DB.getDictionaryTerms(letter);
      }

      // Sort terms alphabetically
      filteredTerms.sort(function(a, b) {
        return (a.name || '').localeCompare(b.name || '', 'es');
      });

      DictionaryModule.renderTerms(filteredTerms, container);

      // Update active letter button
      var letterBtns = document.querySelectorAll('.dict-letter-btn');
      for (var i = 0; i < letterBtns.length; i++) {
        if (letterBtns[i].getAttribute('data-letter') === letter) {
          letterBtns[i].classList.add('active');
        } else {
          letterBtns[i].classList.remove('active');
        }
      }

      // Scroll the letter index to show the active letter
      var activeBtn = document.querySelector('.dict-letter-btn[data-letter="' + letter + '"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } catch (err) {
      console.error('DictionaryModule.filterByLetter error:', err);
      container.innerHTML = '<div class="dict-empty-state"><p>Error: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    }
  },

  /**
   * Search dictionary terms by query and render results.
   * @param {string} query - Search query string
   */
  async searchTerms(query) {
    var container = document.getElementById('dict-terms-container');
    if (!container) return;

    if (!query || query.trim().length === 0) {
      // If query is empty, revert to current letter view
      if (this._currentLetter) {
        this.filterByLetter(this._currentLetter);
      }
      return;
    }

    var trimmedQuery = query.trim();

    container.innerHTML = '<div class="dict-loading"><div class="spinner"></div><p>Buscando...</p></div>';

    try {
      var results = DB.searchDictionary(trimmedQuery);

      if (!results || results.length === 0) {
        container.innerHTML = '<div class="dict-empty-state"><p>No se encontraron t&eacute;rminos para "<strong>' + App.escapeHtml(trimmedQuery) + '</strong>".</p></div>';
        return;
      }

      // Sort results
      results.sort(function(a, b) {
        return (a.name || '').localeCompare(b.name || '', 'es');
      });

      DictionaryModule.renderTerms(results, container);

      // Clear active letter highlight
      var letterBtns = document.querySelectorAll('.dict-letter-btn');
      for (var i = 0; i < letterBtns.length; i++) {
        letterBtns[i].classList.remove('active');
      }
      this._currentLetter = null;

    } catch (err) {
      console.error('DictionaryModule.searchTerms error:', err);
      container.innerHTML = '<div class="dict-empty-state"><p>Error al buscar: ' + App.escapeHtml(String(err.message)) + '</p></div>';
    }
  },

  /**
   * Attach event listeners to the dictionary UI.
   * @param {HTMLElement} main - Main content element
   */
  _attachListeners(main) {
    // Letter index button clicks (event delegation)
    var letterIndex = main.querySelector('#dict-letter-index');
    if (letterIndex) {
      letterIndex.addEventListener('click', function(e) {
        var btn = e.target.closest('.dict-letter-btn');
        if (!btn) return;
        var letter = btn.getAttribute('data-letter');
        if (letter) {
          DictionaryModule.filterByLetter(letter);
        }
      });
    }

    // Search input - debounced search
    var searchInput = main.querySelector('#dict-search-input');
    if (searchInput) {
      var debounceTimer;
      searchInput.addEventListener('input', function(e) {
        var query = e.target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          DictionaryModule.searchTerms(query);
        }, 300);
      });

      // Also handle Enter key for immediate search
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          DictionaryModule.searchTerms(searchInput.value);
        }
      });

      // Focus the search input
      setTimeout(function() {
        searchInput.focus();
      }, 200);
    }

    // Term expand/collapse (event delegation)
    var termsContainer = main.querySelector('#dict-terms-container');
    if (termsContainer) {
      termsContainer.addEventListener('click', function(e) {
        var header = e.target.closest('.dict-term-header');
        if (!header) return;

        var termItem = header.closest('.dict-term-item');
        if (!termItem) return;

        var termId = parseInt(termItem.getAttribute('data-term-id'), 10);
        var infoDiv = termItem.querySelector('.dict-term-info');
        var toggleSpan = termItem.querySelector('.dict-term-toggle');

        if (infoDiv) {
          var isVisible = infoDiv.style.display !== 'none';
          if (isVisible) {
            infoDiv.style.display = 'none';
            if (toggleSpan) toggleSpan.innerHTML = '&#9654;';
            termItem.classList.remove('expanded');
            DictionaryModule._expandedTerms[termId] = false;
          } else {
            infoDiv.style.display = 'block';
            if (toggleSpan) toggleSpan.innerHTML = '&#9660;';
            termItem.classList.add('expanded');
            DictionaryModule._expandedTerms[termId] = true;
          }
        }
      });
    }
  }
};

// Make DictionaryModule globally available
window.DictionaryModule = DictionaryModule;
