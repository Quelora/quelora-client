/**
 * @typedef {Object} QuoteSelector
 * @property {() => void} destroy - Removes all listeners and UI elements.
 * @property {() => void} hideAndDeselect - Hides UI and removes text selection.
 */

/**
 * Enables text selection with handles and a popup menu for quoting.
 *
 * @param {(selectedText: string, author?: string) => void} quoteCallback - Function executed on "Quote" click.
 * @returns {QuoteSelector} An object with a `destroy` method for cleanup.
 */
export function enableQuoteSelection(quoteCallback) {
  // --- 1. DYNAMIC CSS STYLES (Max Z-Index & Selection Force) ---
  const MAX_Z_INDEX = '2147483647'; 

  const css = `
    /* Force text selection on the target container */
    .comment-text, .comment-text * {
      user-select: text !important;
      -webkit-user-select: text !important;
      touch-action: manipulation;
    }

    /* --- ELEGANT QUOTE HANDLE STYLES --- */
    .quote-handle {
      position: absolute;
      width: 14px;
      height: 22px;
      background-color: var(--quelora-primary-color, #1fa8f5); 
      border-radius: 4px; 
      cursor: col-resize;
      z-index: ${MAX_Z_INDEX};
      user-select: none;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2), inset 0 1px 1px var(--quelora-follow-button-shadow); 
      transform: scaleY(1.1);
    }
    .quote-handle::after {
      content: '';
      position: absolute;
      top: -3px; 
      left: 3px; 
      width: 8px; 
      height: 4px;
      background-color: var(--quelora-primary-color, #1fa8f5);
      border-radius: 2px;
    }
    /* --------------------------------- */

    .quote-popup {
      position: absolute;
      background-color: var(--quelora-secondary-color, #404040); 
      color: var(--quelora-primary-text-color, #fefefe);
      border-radius: var(--quelora-follow-button-radius, 18px); 
      padding: var(--spacing-xs, 4px); 
      display: flex;
      gap: var(--spacing-xs, 4px);
      z-index: ${MAX_Z_INDEX};
      user-select: none;
      box-shadow: var(--quelora-shadow, 0 2px 8px rgba(0,0,0,0.3)); 
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }
    .quote-popup button {
      border: none;
      padding: 6px 12px;
      border-radius: var(--quelora-follow-button-radius, 18px); 
      cursor: pointer;
      font-size: var(--font-size-md, 14px);
      transition: background-color 0.2s, color 0.2s;
    }
    
    .quote-popup button.quote-button {
      background-color: var(--quelora-success-color, #3897f0);
      color: var(--quelora-background-color, #313131);
      font-weight: bold;
    }
    .quote-popup button.quote-button:hover {
      opacity: 0.9;
    }
    
    .quote-popup button.close-button {
      background-color: var(--quelora-background-color, #313131);
      color: var(--quelora-text-color, #dbdbdb);
    }
    .quote-popup button.close-button:hover {
      background-color: var(--quelora-light-background-color, #202020);
    }
  `;
  const styleElement = document.createElement('style');
  document.head.appendChild(styleElement);
  
  setTimeout(() => {
    styleElement.textContent = css;
  }, 0);

  // --- 2. UI ELEMENTS CREATION ---
  const startHandle = document.createElement('div');
  startHandle.className = 'quote-handle';
  startHandle.style.display = 'none';

  const endHandle = document.createElement('div');
  endHandle.className = 'quote-handle';
  endHandle.style.display = 'none';

  const popup = document.createElement('div');
  popup.className = 'quote-popup';
  popup.style.display = 'none';

  const quoteButton = document.createElement('button');
  quoteButton.textContent = 'Citar';
  quoteButton.className = 'quote-button t';

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&#10005;'; // The 'X' symbol
  closeButton.className = 'close-button';
  closeButton.style.fontSize = '12px';

  popup.appendChild(quoteButton);
  popup.appendChild(closeButton);
  document.body.appendChild(startHandle);
  document.body.appendChild(endHandle);
  document.body.appendChild(popup);

  // Get the element that handles the internal scroll
  const scrollContainer = document.querySelector('#quelora-comments .drawer-content');
  
  // Get the element that contains the input bar (for exclusion logic)
  const commentBarContainer = document.querySelector('.comment-bar-container'); 
  
  let activeRange = null;
  let isDraggingHandle = false;

  // --- 3. POSITIONING & UTILITY FUNCTIONS ---
  
  /**
   * Checks if a node is part of a valid comment thread (inside .comment-text AND inside .community-threads).
   * @param {Node} node 
   * @returns {HTMLElement | null} The closest .community-threads element, or null.
   */
  function isValidTarget(node) {
      const commentTextEl = node.closest('.comment-text');
      if (!commentTextEl) return null;
      
      const threadEl = commentTextEl.closest('.community-threads');
      return threadEl;
  }
  
  /**
   * Attempts to select the word nearest to the given coordinates (clientX, clientY).
   * Returns the closest .community-threads element if successful, otherwise null.
   */
  function selectWordAtPoint(clientX, clientY) {
    const selection = window.getSelection();
    selection.removeAllRanges();

    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (!pos || !pos.offsetNode) return null;

    const targetNode = pos.offsetNode;
    
    // VERIFICACION 1: Verificar el contenedor .community-threads
    const threadContainer = isValidTarget(targetNode.parentElement);
    if (!threadContainer) return null;

    const textContent = targetNode.textContent;
    let offset = pos.offset;

    let start = offset;
    while (start > 0 && !/\s/.test(textContent[start - 1])) {
      start--;
    }

    let end = offset;
    while (end < textContent.length && !/\s/.test(textContent[end])) {
      end++;
    }

    if (start === end) {
      if (offset < textContent.length) end = offset + 1; 
      else return null;
    }

    try {
      const range = document.createRange();
      range.setStart(targetNode, start);
      range.setEnd(targetNode, end);
      selection.addRange(range);
      return threadContainer;
    } catch (e) {
      return null;
    }
  }

  function updateUIPosition() {
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().trim() === "") {
      hideUI();
      return;
    }

    const range = selection.getRangeAt(0);
    
    // VERIFICACION 1: Asegurarse de que esté en un hilo válido
    const startThread = isValidTarget(range.startContainer.parentElement);
    const endThread = isValidTarget(range.endContainer.parentElement);

    if (!startThread || !endThread || startThread !== endThread) {
        hideUI();
        return;
    }

    activeRange = range.cloneRange(); 
    const rects = activeRange.getClientRects();
    
    if (rects.length === 0) {
        hideUI();
        return;
    }

    const startRect = rects[0];
    const endRect = rects[rects.length - 1];
    
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position handles
    startHandle.style.left = `${startRect.left + scrollX - startHandle.offsetWidth}px`;
    startHandle.style.top = `${startRect.top + scrollY}px`;
    endHandle.style.left = `${endRect.right + scrollX}px`;
    endHandle.style.top = `${endRect.bottom + scrollY - endHandle.offsetHeight}px`;

    // Position popup
    const popupLeft = startRect.left + scrollX + (endRect.right - startRect.left) / 2 - popup.offsetWidth / 2;
    const popupTop = startRect.top + scrollY - popup.offsetHeight - 10;
    
    popup.style.left = `${popupLeft}px`;
    popup.style.top = `${popupTop}px`;

    showUI();
  }

  /**
   * Hides the selector handles and the quote popup.
   * This function does NOT deselect the text.
   */
  function hideUI() {
    startHandle.style.display = 'none';
    endHandle.style.display = 'none';
    popup.style.display = 'none';
    activeRange = null;
  }

  function showUI() {
    startHandle.style.display = 'block';
    endHandle.style.display = 'block';
    popup.style.display = 'flex';
  }
  
  /**
   * Hides the selector handles and the popup, and also removes the current text selection.
   */
  function hideAndDeselect() {
      window.getSelection().removeAllRanges(); // Deselect the text
      hideUI(); // Hide the handles and the popup
  }
  
  // --- 4. EVENT HANDLERS ---

  // Main listener for simple click/touch activation
  const handleActivation = (e) => {
    // 🛑 CRITICAL FIX: If the click is inside the quote UI or comment bar, exit.
    if (e.target.closest('.quote-handle, .quote-popup') || (commentBarContainer && commentBarContainer.contains(e.target))) {
        return;
    }
    
    const selection = window.getSelection();
    
    // Use a small delay for touch systems
    setTimeout(() => {
        if (selection.isCollapsed) {
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);

            if (selectWordAtPoint(clientX, clientY)) {
                updateUIPosition(); 
            } else {
                hideAndDeselect(); 
            }
        } else {
            const range = selection.getRangeAt(0);
            if (isValidTarget(range.startContainer.parentElement)) {
                updateUIPosition();
            } else {
                hideAndDeselect();
            }
        }
    }, 50);
  };
  
  // Handler for content scroll: HIDES THE UI
  const handleScroll = () => {
    if (activeRange) {
        hideUI(); // Only hide UI, selection might still be useful
    }
  };


  // Logic for dragging the handles
  const handleDrag = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHandle = true;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      isDraggingHandle = false;
      return;
    }
    
    activeRange = activeRange || selection.getRangeAt(0);

    const onMove = (moveEvent) => {
      const clientX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
      const clientY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);
      
      if (clientX === undefined || clientY === undefined) return;

      const pos = document.caretPositionFromPoint(clientX, clientY);
      
      if (!pos || !pos.offsetNode) return;
      
      try {
        if (isValidTarget(pos.offsetNode.parentElement)) {
             if (handle === startHandle) {
               activeRange.setStart(pos.offsetNode, pos.offset);
             } else {
               activeRange.setEnd(pos.offsetNode, pos.offset);
             }
        }
        
        selection.removeAllRanges();
        selection.addRange(activeRange);
        updateUIPosition();

      } catch (error) {
        // Ignore boundary errors
      }
    };

    const onUp = () => {
      isDraggingHandle = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      updateUIPosition(); 
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove); 
    document.addEventListener('touchend', onUp);     
  };
  
  // --- Event Assignment ---

  // Listeners for click/touch activation
  document.addEventListener('mouseup', handleActivation);
  document.addEventListener('touchend', handleActivation);

  // Listener for scroll: HIDES the UI immediately!
  if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
  }

  // Native selection listener
  document.addEventListener('selectionchange', () => {
    if (!isDraggingHandle) updateUIPosition();
  });

  // Handle drag events (mouse and touch)
  startHandle.addEventListener('mousedown', (e) => handleDrag(e, startHandle));
  startHandle.addEventListener('touchstart', (e) => handleDrag(e, startHandle)); 

  endHandle.addEventListener('mousedown', (e) => handleDrag(e, endHandle));
  endHandle.addEventListener('touchstart', (e) => handleDrag(e, endHandle)); 


  // Prevent UI interaction from cancelling selection (stop propagation)
  [startHandle, endHandle, popup].forEach(el => {
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); });
      el.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

  quoteButton.addEventListener('click', () => {
    if (activeRange) {
      const selectedText = activeRange.toString();
      
      let author = undefined;
      
      // Buscamos el elemento que contiene el texto seleccionado (.comment-text)
      const commentTextEl = activeRange.startContainer.parentElement?.closest('.comment-text');
      
      // 🎯 MODIFICACIÓN CLAVE: Subimos al CONTENEDOR INMEDIATO del comentario
      // que contendría tanto .comment-text como .comment-header, pero sin llegar a .community-threads.
      // Se asume que el contenedor del comentario está **directamente por encima** de .comment-text
      // dentro de la estructura general de la lista. Buscaremos el primer ancestro
      // que **NO** sea .comment-text y que **SÍ** esté dentro de .community-threads.
      
      let commentContainer = null;
      if (commentTextEl) {
          let current = commentTextEl.parentElement;
          const threadRoot = commentTextEl.closest('.community-threads');

          // Subir hasta encontrar el contenedor del comentario individual
          while (current && current !== threadRoot) {
              // Si el contenedor actual tiene el comment-header, es probablemente el contenedor del comentario
              // Esta es una heurística fuerte para encontrar el contenedor del item.
              if (current.querySelector('.comment-header')) {
                  commentContainer = current;
                  break;
              }
              current = current.parentElement;
          }
          
          // Fallback: Si no lo encontramos así, simplemente usamos el contenedor más cercano al .comment-text
          // que esté dentro de .community-threads, y esperamos que esté lo suficientemente cerca.
          if (!commentContainer) {
             commentContainer = commentTextEl.closest('.community-threads > *'); // Primer hijo de community-threads
          }
          
          if (commentContainer) {
              // Buscar el autor SOLO DENTRO del contenedor del comentario (commentContainer)
              const authorEl = commentContainer.querySelector('.comment-header .comment-author');
              if (authorEl) {
                  author = authorEl.textContent.trim();
              }
          }
      }

      if (typeof quoteCallback === 'function') {
        // Pasamos el texto y el autor
        quoteCallback(selectedText, author);
      }
      hideAndDeselect(); 
    }
  });

  closeButton.addEventListener('click', () => {
    hideAndDeselect(); 
  });

  // --- 5. CLEANUP FUNCTION ---
  function destroy() {
    document.removeEventListener('mouseup', handleActivation);
    document.removeEventListener('touchend', handleActivation);
    
    if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
    }

    if (styleElement.parentNode) document.head.removeChild(styleElement);
    if (startHandle.parentNode) document.body.removeChild(startHandle);
    if (endHandle.parentNode) document.body.removeChild(endHandle);
    if (popup.parentNode) document.body.removeChild(popup);
  }

  return { destroy, hideAndDeselect  };
}