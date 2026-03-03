// ==UserScript==
// @name         One-Click Fab.com Free Item Claimer
// @namespace    https://github.com/joex92/Fab.com-Free-Item-Claimer
// @version      4.0
// @description  Automates claiming free products on Fab.com with auto-scrolling and batch processing.
// @author       JoeX92 & Gemini AI Pro
// @match        https://www.fab.com/search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fab.com
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // --- 1. Global State Machine ---
  let isRunning = false;
  let isPaused = false;
  let shouldStop = false;
  let autoScrollEnabled = false;

  // --- 2. UI Helpers (Logging & ETA) ---
  function uiLog(message) {
    console.log(message); // Keep it in the real console just in case
    const logBox = document.getElementById('fab-automation-log');
    if (logBox) {
      const msgLine = document.createElement('div');
      msgLine.innerText = `> ${message}`;
      msgLine.style.marginBottom = '4px';
      logBox.appendChild(msgLine);
      
      // Keep only the last 4 messages so the box doesn't grow infinitely
      while (logBox.children.length > 4) {
        logBox.removeChild(logBox.firstChild);
      }
      logBox.scrollTop = logBox.scrollHeight; // Auto-scroll to bottom
    }
  }

  function updateETA(itemsLeft) {
    const etaText = document.getElementById('fab-automation-eta');
    if (!etaText) return;
    
    if (itemsLeft === 0) {
      etaText.innerText = "ETA: Calculating...";
      return;
    }

    // Our script sleeps for a max of ~4 seconds per item (1.5 + 0.5 + 2.0)
    const estimatedSeconds = itemsLeft * 4; 
    const mins = Math.floor(estimatedSeconds / 60);
    const secs = estimatedSeconds % 60;
    
    etaText.innerText = `ETA: ~${mins}m ${secs < 10 ? '0' : ''}${secs}s (${itemsLeft} items left)`;
  }

  // --- 3. Smart Sleep ---
  async function smartSleep(ms) {
    let elapsed = 0;
    while (elapsed < ms) {
      if (shouldStop) throw new Error("Automation Stopped by User");
      await new Promise(r => setTimeout(r, 100));
      if (!isPaused) elapsed += 100;
    }
  }

  // --- 4. Robust DOM Scraper ---
  function getUnprocessedFreeItems() {
    const cartBtns = document.querySelectorAll('button[aria-label="Add listing to cart"]:not([data-fab-processed="true"])');
    const freeItems = [];

    cartBtns.forEach(btn => {
      let current = btn.parentElement;
      let cardContainer = null;
      
      while (current && current !== document.body) {
        if (current.querySelector('a[href^="/listings/"]')) {
          cardContainer = current;
          break;
        }
        current = current.parentElement;
      }

      if (cardContainer) {
        const text = cardContainer.textContent.replace(/\s+/g, ' ').trim();
        if (text.includes('From Free') || text.match(/\bFree$/i)) {
          freeItems.push({ card: cardContainer, button: btn });
        } else {
          btn.setAttribute('data-fab-processed', 'true');
        }
      }
    });
    
    return freeItems;
  }

  // --- 5. Batch Automation Logic ---
  async function startAutomation() {
    isRunning = true;
    shouldStop = false;
    isPaused = false;
    
    document.getElementById('fab-automation-controls').style.display = 'flex';
    document.getElementById('fab-automation-log').innerHTML = ''; // Clear previous logs
    uiLog("🚀 Automation Started!");

    try {
      while (true) {
        if (shouldStop) throw new Error("Automation Stopped by User");

        const batch = getUnprocessedFreeItems();
        
        if (batch.length > 0) {
          uiLog(`Found ${batch.length} new free items.`);
          
          for (let i = 0; i < batch.length; i++) {
            if (shouldStop) throw new Error("Automation Stopped by User");
            
            updateETA(batch.length - i);
            uiLog(`Processing item ${i + 1} of ${batch.length}...`);
            
            const { button } = batch[i];
            button.setAttribute('data-fab-processed', 'true');
            
            button.click();
            await smartSleep(1500);

            const checkTierIsFree = (tierName) => {
              const labels = Array.from(document.querySelectorAll('label'));
              const targetLabel = labels.find(label => label.textContent.trim() === tierName);
              if (targetLabel) {
                const container = targetLabel.closest('div:has(input[type="radio"])') || targetLabel.closest('.fabkit-FormField-root');
                if (container && container.textContent.includes('Free')) return targetLabel;
              }
              return null;
            };

            const proFreeLabel = checkTierIsFree('Professional');
            const personalFreeLabel = checkTierIsFree('Personal');
            let selectedLabel = proFreeLabel || personalFreeLabel;

            if (selectedLabel) {
              selectedLabel.click();
              await smartSleep(500);

              const allButtons = Array.from(document.querySelectorAll('button'));
              const addToLibraryBtn = allButtons.find(btn => btn.textContent.trim() === 'Add to My Library');

              if (addToLibraryBtn && !addToLibraryBtn.disabled) {
                addToLibraryBtn.click();
                uiLog(`Successfully claimed!`);
              } else {
                document.querySelector('button[aria-label="Close"]')?.click();
              }
            } else {
              document.querySelector('button[aria-label="Close"]')?.click();
            }

            await smartSleep(2000); 
          }
        } else {
          updateETA(0);
          if (autoScrollEnabled) {
            uiLog("Scrolling to load more items...");
            let oldHeight = document.body.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
            
            await smartSleep(2500); 
            
            let newHeight = document.body.scrollHeight;
            if (newHeight === oldHeight) {
              uiLog("Reached the absolute bottom.");
              break; 
            }
          } else {
            uiLog("Visible items processed. Auto-scroll OFF.");
            break; 
          }
        }
      }
      uiLog("🎉 Finished processing!");

    } catch (error) {
      uiLog(`🛑 ${error.message || error}`);
      document.querySelector('button[aria-label="Close"]')?.click();
    } finally {
      isRunning = false;
      // We don't hide the controls immediately anymore so you can read the final message.
      // Instead, we change the Stop button to "Close Panel"
      const stopBtn = document.getElementById('fab-stop-btn');
      if (stopBtn) {
        stopBtn.innerHTML = '<span class="fabkit-Button-label">Close Panel</span>';
        stopBtn.onclick = () => {
          document.getElementById('fab-automation-controls').style.display = 'none';
          stopBtn.innerHTML = '<span class="fabkit-Button-label">Stop</span>'; // Reset for next time
        };
      }
    }
  }

  // --- 6. UI Injection ---
  function createAutomationUI() {
    if (document.getElementById('fab-automation-controls')) return;

    const anchorElement = document.querySelector('li[data-name="search.widgets.style"]');
    if (!anchorElement) return; 

    const toolbar = anchorElement.closest('ul').parentElement;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'fabkit-Button-root fabkit-Button--sm fabkit-Button--menu';
    toggleBtn.innerHTML = '<span class="fabkit-Button-label">Auto-Scroll: OFF</span>';
    toggleBtn.onclick = () => {
      autoScrollEnabled = !autoScrollEnabled;
      toggleBtn.querySelector('span').innerText = `Auto-Scroll: ${autoScrollEnabled ? 'ON' : 'OFF'}`;
    };
    toolbar.appendChild(toggleBtn);

    const claimBtn = document.createElement('button');
    claimBtn.className = 'fabkit-Button-root fabkit-Button--sm fabkit-Button--primary'; 
    claimBtn.style.marginLeft = '8px';
    claimBtn.innerHTML = '<span class="fabkit-Button-label">Claim Free Products</span>';
    claimBtn.onclick = () => {
      if (!isRunning) startAutomation();
    };
    toolbar.appendChild(claimBtn);

    // --- Floating Dashboard ---
    const floatingBox = document.createElement('div');
    floatingBox.id = 'fab-automation-controls';
    floatingBox.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999; 
      display: none; flex-direction: column; gap: 10px; padding: 16px; 
      border-radius: 12px; width: 320px;
      background: var(--fabkit-color-surface-elevated, #1a1a1a); 
      box-shadow: 0 12px 32px rgba(0,0,0,0.8); border: 1px solid #444;
      font-family: ui-sans-serif, system-ui, sans-serif;
    `;

    // 1. ETA Display
    const etaText = document.createElement('div');
    etaText.id = 'fab-automation-eta';
    etaText.style.cssText = 'color: #a0a0a0; font-size: 13px; font-weight: 600;';
    etaText.innerText = 'ETA: Calculating...';
    floatingBox.appendChild(etaText);

    // 2. Terminal/Log Box
    const logBox = document.createElement('div');
    logBox.id = 'fab-automation-log';
    logBox.style.cssText = `
      background: #000; color: #4ade80; padding: 8px 12px; border-radius: 6px;
      font-family: monospace; font-size: 12px; height: 75px; 
      overflow-y: hidden; border: 1px solid #333;
    `;
    floatingBox.appendChild(logBox);

    // 3. Buttons Row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: space-between; margin-top: 4px;';

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'fabkit-Button-root fabkit-Button--md fabkit-Button--menu';
    pauseBtn.style.flex = '1';
    pauseBtn.innerHTML = '<span class="fabkit-Button-label">Pause</span>';
    pauseBtn.onclick = () => {
      if (!isRunning) return; // Prevent pausing if it's already finished
      isPaused = !isPaused;
      pauseBtn.querySelector('span').innerText = isPaused ? 'Resume' : 'Pause';
      pauseBtn.style.color = isPaused ? '#ffb300' : ''; 
      if (isPaused) uiLog("⏸ Paused by user.");
      else uiLog("▶ Resumed...");
    };

    const stopBtn = document.createElement('button');
    stopBtn.id = 'fab-stop-btn';
    stopBtn.className = 'fabkit-Button-root fabkit-Button--md fabkit-Button--primary';
    stopBtn.style.cssText = 'flex: 1; background-color: #d32f2f; border-color: #d32f2f;';
    stopBtn.innerHTML = '<span class="fabkit-Button-label">Stop</span>';
    stopBtn.onclick = () => {
      shouldStop = true;
      isPaused = false; 
    };

    btnRow.appendChild(pauseBtn);
    btnRow.appendChild(stopBtn);
    floatingBox.appendChild(btnRow);

    document.body.appendChild(floatingBox);
  }

  // --- 7. Initialization ---
  setInterval(createAutomationUI, 2000);

})();
