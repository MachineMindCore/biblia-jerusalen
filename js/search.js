/**
 * SearchModule - full text search across all Bible verses.
 * Depends on: App, DB (global objects from app.js and db.js)
 */
const SearchModule = {
  _allResults: [],
  _displayedCount: 0,
  _pageSize: 100,
  _currentQuery: '',
  _currentExact: false,

  /**
   * Render the search interface with input, checkbox, and results area.
   */
  async render() {
    var main = App.getMainContent();
    if (!main) return;

    main.innerHTML = '';

    var html = '<div class="search-container">';

    // Search header
    html += '<div class="search-header">';
    html += '<h2>B&uacute;squeda</h2>';
    html += '</div>';

    // Search input area
    html += '<div class="search-input-area">';
    html += '<div class="search-input-row">';
    html += '<input type="text" class="search-input" id="search-input" placeholder="Buscar en la Biblia..." autocomplete="off">';
    html += '<button class="search-btn" id="search-btn">Buscar</button>';
    html += '</div>';
    html += '<div class="search-options">';
    html += '<label class="exact-checkbox-label">';
    html += '<input type="checkbox" id="exact-word-checkbox">';
    html += '<span>B&uacute;squeda exacta (palabra completa)</span>';
    html += '</label>';
    html += '</div>';
    html += '</div>';

    // Loading indicator (hidden by default)
    html += '<div class="search-loading" id="search-loading" style="display:none;">';
    html += '<div class="spinner"></div>';
    html += '<p>Buscando...</p>';
    html += '</div>';

    // Results area
    html += '<div class="search-results" id="search-results">';
    html += '<div class="search-placeholder">';
    html += '<p>Ingrese un t&eacute;rmino de b&uacute;squeda y presione Enter o el bot&oacute;n Buscar.</p>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    main.innerHTML = html;

    // Attach event listeners
    this._attachListeners(main);
  },

  /**
   * Perform the search and render results.
   * @param {string} query - Search query string
   * @param {boolean} exactWord - Whether to match exact word only
   */
  async performSearch(query, exactWord) {
    var main = App.getMainContent();
    if (!main) return;

    var searchInput = main.querySelector('#search-input');
    var searchLoading = main.querySelector('#search-loading');
    var resultsContainer = main.querySelector('#search-results');

    if (!query || query.trim().length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="search-placeholder"><p>Por favor ingrese un t&eacute;rmino de b&uacute;squeda.</p></div>';
      }
      return;
    }

    var trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="search-placeholder"><p>La b&uacute;squeda debe tener al menos 2 caracteres.</p></div>';
      }
      return;
    }

    this._currentQuery = trimmedQuery;
    this._currentExact = exactWord;

    // Show loading
    if (searchLoading) searchLoading.style.display = 'block';
    if (resultsContainer) resultsContainer.innerHTML = '';

    try {
      var results = await DB.search(trimmedQuery, exactWord);
      this._allResults = results || [];
      this._displayedCount = 0;

      if (searchLoading) searchLoading.style.display = 'none';

      if (!this._allResults || this._allResults.length === 0) {
        if (resultsContainer) {
          resultsContainer.innerHTML = '<div class="search-empty"><p>No se encontraron resultados para "<strong>' + App.escapeHtml(trimmedQuery) + '</strong>".</p><p>Intente con otra palabra o desactive la b&uacute;squeda exacta.</p></div>';
        }
        return;
      }

      // Render first page of results
      this._renderResultsBatch(resultsContainer);

    } catch (err) {
      console.error('SearchModule.performSearch error:', err);
      if (searchLoading) searchLoading.style.display = 'none';
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="search-empty"><p>Error al realizar la b&uacute;squeda: ' + App.escapeHtml(String(err.message)) + '</p></div>';
      }
    }
  },

  /**
   * Render a batch of search results (pagination).
   * @param {HTMLElement} container - Results container element
   */
  _renderResultsBatch(container) {
    if (!container) return;

    var results = this._allResults;
    var totalCount = results.length;
    var endIndex = Math.min(this._displayedCount + this._pageSize, totalCount);
    var batch = results.slice(this._displayedCount, endIndex);

    var html = '';

    // Show result count on first batch
    if (this._displayedCount === 0) {
      html += '<div class="search-result-count">' + totalCount + ' resultado' + (totalCount !== 1 ? 's' : '') + ' para "<strong>' + App.escapeHtml(this._currentQuery) + '</strong>"</div>';
    }

    for (var i = 0; i < batch.length; i++) {
      html += SearchModule._createResultItem(batch[i]);
    }

    // Append to container
    if (this._displayedCount === 0) {
      container.innerHTML = html;
    } else {
      container.insertAdjacentHTML('beforeend', html);
    }

    this._displayedCount = endIndex;

    // Show "Load more" button if there are more results
    if (this._displayedCount < totalCount) {
      var remaining = totalCount - this._displayedCount;
      container.insertAdjacentHTML('beforeend',
        '<div class="load-more-container">' +
        '<button class="load-more-btn" id="load-more-btn">Cargar m&aacute;s (' + remaining + ' restantes)</button>' +
        '</div>'
      );

      var loadMoreBtn = container.querySelector('#load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
          var loadMoreContainer = container.querySelector('.load-more-container');
          if (loadMoreContainer) loadMoreContainer.remove();
          SearchModule._renderResultsBatch(container);
        });
      }
    }
  },

  /**
   * Create HTML for a single search result item.
   * @param {Object} result - Search result { bookName, bookId, chapter, verse, text }
   * @returns {string} HTML string
   */
  _createResultItem(result) {
    var snippet = SearchModule.highlightText(result.text, this._currentQuery);
    return '<div class="search-result-item" data-book-id="' + result.bookId + '" data-chapter="' + result.chapter + '" data-verse="' + result.verse + '">' +
      '<div class="result-reference">' + App.escapeHtml(result.bookName) + ' ' + result.chapter + ':' + result.verse + '</div>' +
      '<div class="result-snippet">' + snippet + '</div>' +
    '</div>';
  },

  /**
   * Highlight search query matches in text using <mark> tags.
   * Case-insensitive matching. Uses accent normalization from DB.
   * @param {string} text - The text to search within
   * @param {string} query - The search query
   * @returns {string} HTML with <mark> wrapped matches
   */
  highlightText(text, query) {
    if (!text || !query) return App.escapeHtml(text || '');

    var escapedText = App.escapeHtml(text);
    var escapedQuery = App.escapeHtml(query);

    // Escape special regex characters in the query
    var regexSafe = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + regexSafe + ')', 'gi');

    return escapedText.replace(regex, '<mark>$1</mark>');
  },

  /**
   * Attach event listeners to the search UI.
   * @param {HTMLElement} main - Main content element
   */
  _attachListeners(main) {
    var searchInput = main.querySelector('#search-input');
    var searchBtn = main.querySelector('#search-btn');
    var exactCheckbox = main.querySelector('#exact-word-checkbox');
    var self = this;

    // Search button click
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        var query = searchInput ? searchInput.value : '';
        var exact = exactCheckbox ? exactCheckbox.checked : false;
        SearchModule.performSearch(query, exact);
      });
    }

    // Enter key in search input
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var query = searchInput.value;
          var exact = exactCheckbox ? exactCheckbox.checked : false;
          SearchModule.performSearch(query, exact);
        }
      });

      // Auto-focus the search input
      setTimeout(function() {
        searchInput.focus();
      }, 100);
    }

    // Result item clicks (event delegation)
    var resultsContainer = main.querySelector('#search-results');
    if (resultsContainer) {
      resultsContainer.addEventListener('click', function(e) {
        var item = e.target.closest('.search-result-item');
        if (!item) return;

        var bookId = parseInt(item.getAttribute('data-book-id'), 10);
        var chapter = parseInt(item.getAttribute('data-chapter'), 10);
        var verse = parseInt(item.getAttribute('data-verse'), 10);

        if (bookId && chapter) {
          App.navigate('#read/' + bookId + '/' + chapter);

          // After navigation, scroll to the specific verse
          setTimeout(function() {
            var verseEl = document.getElementById('verse-' + verse);
            if (verseEl) {
              verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight briefly
              verseEl.classList.add('verse-highlight');
              setTimeout(function() { verseEl.classList.remove('verse-highlight'); }, 3000);
            }
          }, 500);
        }
      });
    }
  }
};

// Make SearchModule globally available
window.SearchModule = SearchModule;
