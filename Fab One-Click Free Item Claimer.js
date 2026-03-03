// ==UserScript==
// @name         Fab.com Free Item Claimer
// @namespace    https://github.com/joex92/Fab.com-Free-Item-Claimer
// @version      3.1
// @description  Automates claiming free products on Fab.com with auto-scrolling and batch processing.
// @author       JoeX92 & Gemini AI
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

  // --- 2. Smart Sleep ---
  async function smartSleep(ms) {
    let elapsed = 0;
    while (elapsed < ms) {
      if (shouldStop) throw new Error("Automation Stopped by User");
      await new Promise(r => setTimeout(r, 100));
      if (!isPaused) elapsed += 100;
    }
  }

  // --- 3. Robust DOM Scraper ---
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

  // --- 4. Batch Automation Logic ---
  async function startAutomation() {
    isRunning = true;
    shouldStop = false;
    isPaused = false;
    
    document.getElementById('fab-automation-controls').style.display = 'flex';
    console.log("🚀 Batch Automation Started!");

    try {
      while (true) {
        if (shouldStop) throw new Error("Automation Stopped by User");

        const batch = getUnprocessedFreeItems();
        
        if (batch.length > 0) {
          console.log(`Found a batch of ${batch.length} new free items. Processing...`);
          
          for (let i = 0; i < batch.length; i++) {
            if (shouldStop) throw new Error("Automation Stopped by User");
            
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
                console.log(`  -> Item claimed!`);
              } else {
                document.querySelector('button[aria-label="Close"]')?.click();
              }
            } else {
              document.querySelector('button[aria-label="Close"]')?.click();
            }

            await smartSleep(2000); 
          }
        } else {
          if (autoScrollEnabled) {
            console.log("Batch finished. Scrolling to find more items...");
            let oldHeight = document.body.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
            
            await smartSleep(2500); 
            
            let newHeight = document.body.scrollHeight;
            if (newHeight === oldHeight) {
              console.log("Reached the absolute bottom of the page. No more items to load.");
              break; 
            }
          } else {
            console.log("All visible items processed. Auto-scroll is OFF, so we are done here.");
            break; 
          }
        }
      }
      console.log("🎉 Finished processing all available items!");

    } catch (error) {
      console.log(`🛑 ${error.message || error}`);
      document.querySelector('button[aria-label="Close"]')?.click();
    } finally {
      isRunning = false;
      document.getElementById('fab-automation-controls').style.display = 'none';
    }
  }

  // --- 5. UI Injection ---
  function createAutomationUI() {
    if (document.getElementById('fab-automation-controls')) return;

    const anchorElement = document.querySelector('li[data-name="search.widgets.style"]');
    if (!anchorElement) return; // Fails silently if the SPA hasn't rendered this yet

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

    const floatingBox = document.createElement('div');
    floatingBox.id = 'fab-automation-controls';
    floatingBox.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999; 
      display: none; gap: 10px; padding: 12px; border-radius: 8px;
      background: var(--fabkit-color-surface-elevated, #1a1a1a); 
      box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 1px solid #333;
    `;

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'fabkit-Button-root fabkit-Button--md fabkit-Button--menu';
    pauseBtn.innerHTML = '<span class="fabkit-Button-label">Pause</span>';
    pauseBtn.onclick = () => {
      isPaused = !isPaused;
      pauseBtn.querySelector('span').innerText = isPaused ? 'Resume' : 'Pause';
      pauseBtn.style.color = isPaused ? '#ffb300' : ''; 
    };

    const stopBtn = document.createElement('button');
    stopBtn.className = 'fabkit-Button-root fabkit-Button--md fabkit-Button--primary';
    stopBtn.style.backgroundColor = '#d32f2f'; 
    stopBtn.style.borderColor = '#d32f2f';
    stopBtn.innerHTML = '<span class="fabkit-Button-label">Stop</span>';
    stopBtn.onclick = () => {
      shouldStop = true;
      isPaused = false; 
    };

    floatingBox.appendChild(pauseBtn);
    floatingBox.appendChild(stopBtn);
    document.body.appendChild(floatingBox);
  }

  // --- 6. Initialization ---
  // Poll every 2 seconds to handle dynamic SPA page loads
  setInterval(createAutomationUI, 2000);

})();
