document.addEventListener('DOMContentLoaded', () => {
  const mainGrid = document.getElementById('mainGrid');
  const fblockGrid = document.getElementById('fblockGrid');
  const tableLegend = document.getElementById('tableLegend');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContainer = document.getElementById('modalContainer');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const nucleusTarget = document.getElementById('nucleusTarget');
  const sideFactPanel = document.getElementById('sideFactPanel');
  const atomCanvas = document.getElementById('atomCanvas');
  const svgConnectors = document.getElementById('svgConnectors');
  const wallpaperContainer = document.querySelector('.wallpaper-container');

  let activeCard = null;
  let atomAnimationId = null;
  let isSideOpen = false;
  let currentElement = null;

  // Helper to convert hex color to RGB string
  function hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // Helper to determine natural state at room temp
  function getElementState(n, s) {
    if (s === 'Hg' || s === 'Br') return 'Líquido (25°C)';
    const gasses = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86];
    if (gasses.includes(n)) return 'Gas (25°C)';
    return 'Sólido (25°C)';
  }

  // Populate Legend
  Object.keys(CATEGORIES_INFO).forEach(catKey => {
    const cat = CATEGORIES_INFO[catKey];
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.style.color = cat.color;
    item.innerText = cat.name;
    
    item.addEventListener('mouseenter', () => highlightCategory(catKey));
    item.addEventListener('mouseleave', () => resetHighlights());
    
    tableLegend.appendChild(item);
  });

  // Populate Main Grid and F-Block Grid
  ELEMENTS_DATA.forEach(el => {
    const card = document.createElement('div');
    card.className = 'element-card';
    const cat = CATEGORIES_INFO[el.cat] || { color: '#ffffff', name: 'Elemento' };
    
    card.style.setProperty('--cat-color', cat.color);
    card.style.setProperty('--cat-rgb', hexToRgb(cat.color));
    card.dataset.cat = el.cat;

    card.innerHTML = `
      <div class="atomic-num">${el.n}</div>
      <div class="symbol">${el.s}</div>
      <div class="name">${el.name}</div>
      <div class="mass">${el.mass}</div>
    `;

    card.addEventListener('click', () => openAtomModal(el, card));

    if (el.cat === 'lantanido' || el.cat === 'actinido') {
      card.style.gridColumn = el.col + 2;
      card.style.gridRow = el.row;
      fblockGrid.appendChild(card);
    } else {
      card.style.gridColumn = el.col;
      card.style.gridRow = el.row;
      mainGrid.appendChild(card);
    }
  });

  // Placeholders for 57-71 and 89-103
  const lanthPlaceholder = document.createElement('div');
  lanthPlaceholder.className = 'placeholder-card';
  lanthPlaceholder.id = 'box-57-71';
  lanthPlaceholder.style.gridColumn = 3;
  lanthPlaceholder.style.gridRow = 6;
  lanthPlaceholder.style.setProperty('--cat-color', CATEGORIES_INFO.lantanido.color);
  lanthPlaceholder.style.setProperty('--cat-rgb', hexToRgb(CATEGORIES_INFO.lantanido.color));
  lanthPlaceholder.innerText = '57-71';
  mainGrid.appendChild(lanthPlaceholder);

  const actinPlaceholder = document.createElement('div');
  actinPlaceholder.className = 'placeholder-card';
  actinPlaceholder.id = 'box-89-103';
  actinPlaceholder.style.gridColumn = 3;
  actinPlaceholder.style.gridRow = 7;
  actinPlaceholder.style.setProperty('--cat-color', CATEGORIES_INFO.actinido.color);
  actinPlaceholder.style.setProperty('--cat-rgb', hexToRgb(CATEGORIES_INFO.actinido.color));
  actinPlaceholder.innerText = '89-103';
  mainGrid.appendChild(actinPlaceholder);

  // SVG Connector line from 57-71 / 89-103 down to fblockGrid
  function drawConnectors() {
    requestAnimationFrame(() => {
      const box57 = lanthPlaceholder.getBoundingClientRect();
      const fblockFirst = fblockGrid.children[0]?.getBoundingClientRect();
      const connArea = document.querySelector('.connector-area');
      if (!connArea) return;
      const connRect = connArea.getBoundingClientRect();

      if (!box57 || !fblockFirst || box57.width === 0) return;

      const startX = box57.left - connRect.left + box57.width * 0.5;
      const targetX = fblockFirst.left - connRect.left;
      const midY = connRect.height * 0.5;

      svgConnectors.innerHTML = `
        <path d="M ${startX} 0 L ${startX} ${midY} L ${targetX} ${midY} L ${targetX} ${connRect.height}" 
              stroke="#607d8b" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.8"/>
      `;
    });
  }

  // Draw connectors after layout stabilization and on resize
  setTimeout(drawConnectors, 100);
  setTimeout(drawConnectors, 500);
  window.addEventListener('resize', drawConnectors);

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => drawConnectors());
    ro.observe(wallpaperContainer);
  }

  // Category Highlighting
  function highlightCategory(catKey) {
    document.querySelectorAll('.element-card').forEach(card => {
      if (card.dataset.cat !== catKey) {
        card.style.opacity = '0.12';
        card.style.filter = 'grayscale(90%)';
        card.style.transform = '';
      } else {
        card.style.opacity = '1';
        card.style.filter = 'none';
        card.style.transform = 'scale(1.22) translateY(-3px)';
        card.style.zIndex = '50';
      }
    });

    if (lanthPlaceholder) {
      if (catKey === 'lantanido') {
        lanthPlaceholder.style.opacity = '1';
        lanthPlaceholder.style.transform = 'scale(1.15) translateY(-2px)';
        lanthPlaceholder.style.zIndex = '50';
        lanthPlaceholder.style.filter = 'none';
      } else {
        lanthPlaceholder.style.opacity = '0.12';
        lanthPlaceholder.style.filter = 'grayscale(90%)';
        lanthPlaceholder.style.transform = '';
      }
    }

    if (actinPlaceholder) {
      if (catKey === 'actinido') {
        actinPlaceholder.style.opacity = '1';
        actinPlaceholder.style.transform = 'scale(1.15) translateY(-2px)';
        actinPlaceholder.style.zIndex = '50';
        actinPlaceholder.style.filter = 'none';
      } else {
        actinPlaceholder.style.opacity = '0.12';
        actinPlaceholder.style.filter = 'grayscale(90%)';
        actinPlaceholder.style.transform = '';
      }
    }
  }

  function resetHighlights() {
    document.querySelectorAll('.element-card').forEach(card => {
      card.style.opacity = '';
      card.style.filter = '';
      card.style.transform = '';
      card.style.zIndex = '';
    });

    [lanthPlaceholder, actinPlaceholder].forEach(ph => {
      if (ph) {
        ph.style.opacity = '';
        ph.style.filter = '';
        ph.style.transform = '';
        ph.style.zIndex = '';
      }
    });
  }

  // FLIP Card Morphing with Twin Square Side Panel Expansion
  function openAtomModal(el, clickedCard) {
    activeCard = clickedCard;
    currentElement = el;
    isSideOpen = false;
    modalContainer.classList.remove('side-open');

    const cat = CATEGORIES_INFO[el.cat] || { color: '#29b6f6', name: 'Elemento' };
    modalOverlay.style.setProperty('--modal-color', cat.color);

    // Initial position matching clicked element card
    const rect = clickedCard.getBoundingClientRect();
    modalContainer.style.transition = 'none';
    modalContainer.style.left = `${rect.left}px`;
    modalContainer.style.top = `${rect.top}px`;
    modalContainer.style.width = `${rect.width}px`;
    modalContainer.style.height = `${rect.height}px`;
    modalContainer.style.borderRadius = '3px';
    modalContainer.classList.remove('expanded');

    // Populate Mini Card Content
    document.getElementById('miniNum').innerText = el.n;
    document.getElementById('miniSymbol').innerText = el.s;
    document.getElementById('miniSymbol').style.color = cat.color;
    document.getElementById('miniName').innerText = el.name;
    document.getElementById('miniMass').innerText = el.mass;

    // Populate Full Modal Content
    document.getElementById('modalSymbol').innerText = el.s;
    document.getElementById('modalName').innerText = el.name;
    document.getElementById('modalCfg').innerText = el.cfg;
    document.getElementById('modalNum').innerText = el.n;
    document.getElementById('modalMass').innerText = el.mass + ' u';
    document.getElementById('modalCat').innerText = cat.name;

    // Populate Rich Side Panel Content
    document.getElementById('factWatermark').innerText = el.s;
    document.getElementById('factText').innerText = el.fact || "Elemento fascinante del sistema periódico de los elementos.";
    document.getElementById('factState').innerText = getElementState(el.n, el.s);
    document.getElementById('factGroupVal').innerText = cat.name;

    // Temporarily hide original static card behind morphing container
    activeCard.style.opacity = '0';

    // Activate backdrop overlay
    modalOverlay.classList.add('active');

    // Animate morphing expand into compact square window
    requestAnimationFrame(() => {
      setTimeout(() => {
        const baseSize = window.innerHeight * 0.45;
        const targetLeft = (window.innerWidth - baseSize) / 2;
        const targetTop = (window.innerHeight - baseSize) / 2;

        modalContainer.style.transition = 'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), width 0.45s cubic-bezier(0.16, 1, 0.3, 1), height 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.45s ease';
        modalContainer.style.left = `${targetLeft}px`;
        modalContainer.style.top = `${targetTop}px`;
        modalContainer.style.width = `${baseSize}px`;
        modalContainer.style.height = `${baseSize}px`;
        modalContainer.style.borderRadius = '10px';
        modalContainer.classList.add('expanded');
      }, 15);
    });

    startAtomOrbit(el, cat.color);
  }

  // Click Nucleus Target to Expand/Collapse Fun Fact Twin Square to the Right
  nucleusTarget.addEventListener('click', (e) => {
    e.stopPropagation();
    isSideOpen = !isSideOpen;

    const baseSize = window.innerHeight * 0.45;

    if (isSideOpen) {
      modalContainer.classList.add('side-open');
      const targetWidth = baseSize * 2;
      const targetLeft = Math.max((window.innerWidth - targetWidth) / 2, 20);

      modalContainer.style.width = `${targetWidth}px`;
      modalContainer.style.left = `${targetLeft}px`;
    } else {
      modalContainer.classList.remove('side-open');

      const targetLeft = (window.innerWidth - baseSize) / 2;
      modalContainer.style.width = `${baseSize}px`;
      modalContainer.style.left = `${targetLeft}px`;
    }
  });

  closeModalBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
  });

  function closeModal() {
    isSideOpen = false;
    modalContainer.classList.remove('side-open');

    if (activeCard) {
      const rect = activeCard.getBoundingClientRect();
      modalContainer.classList.remove('expanded');
      modalContainer.style.left = `${rect.left}px`;
      modalContainer.style.top = `${rect.top}px`;
      modalContainer.style.width = `${rect.width}px`;
      modalContainer.style.height = `${rect.height}px`;
      modalContainer.style.borderRadius = '3px';
    }

    setTimeout(() => {
      if (activeCard) activeCard.style.opacity = '';
      modalOverlay.classList.remove('active');
      if (atomAnimationId) cancelAnimationFrame(atomAnimationId);
    }, 450);
  }

  // High-DPI Crisp Bohr Atomic Orbit Renderer
  function startAtomOrbit(el, mainColor) {
    const ctx = atomCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const displaySize = 280;

    atomCanvas.width = displaySize * dpr;
    atomCanvas.height = displaySize * dpr;
    atomCanvas.style.width = `${displaySize}px`;
    atomCanvas.style.height = `${displaySize}px`;

    ctx.scale(dpr, dpr);

    const centerX = displaySize / 2;
    const centerY = displaySize / 2;

    const shells = el.shells || [1];
    const maxRadius = displaySize * 0.44;
    const baseRadius = 24;
    const radiusStep = (maxRadius - baseRadius) / Math.max(shells.length, 1);

    let angleOffsets = shells.map(() => Math.random() * Math.PI * 2);

    function renderFrame() {
      ctx.clearRect(0, 0, displaySize, displaySize);

      // Draw Glowing Central Nucleus
      const nucleusPulse = 14 + Math.sin(Date.now() * 0.005) * 2.0;
      const nGrad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, nucleusPulse * 1.8);
      nGrad.addColorStop(0, '#ffffff');
      nGrad.addColorStop(0.4, mainColor);
      nGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = nGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, nucleusPulse * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Core sphere
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, nucleusPulse * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Render Shell Orbits and Orbiting Electrons
      shells.forEach((electronCount, shellIdx) => {
        const radius = baseRadius + (shellIdx + 1) * radiusStep;
        const speed = (0.016 - shellIdx * 0.0018) * (shellIdx % 2 === 0 ? 1 : -1);
        angleOffsets[shellIdx] += speed;

        // Orbit ring line
        ctx.strokeStyle = mainColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // Orbiting Electrons
        for (let i = 0; i < electronCount; i++) {
          const angle = angleOffsets[shellIdx] + (i * (2 * Math.PI / electronCount));
          const ex = centerX + radius * Math.cos(angle);
          const ey = centerY + radius * Math.sin(angle);

          // Electron glow
          const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
          eGrad.addColorStop(0, '#ffffff');
          eGrad.addColorStop(0.5, mainColor);
          eGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = eGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, 6, 0, Math.PI * 2);
          ctx.fill();

          // Electron center dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      atomAnimationId = requestAnimationFrame(renderFrame);
    }

    if (atomAnimationId) cancelAnimationFrame(atomAnimationId);
    renderFrame();
  }

  // Fullscreen Button Action
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed', err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Native Wallpaper Engine Properties Listener
  window.wallpaperPropertyListener = {
    applyUserProperties: function(properties) {
      if (properties.iconoffset) {
        wallpaperContainer.classList.remove('offset-small', 'offset-large');
        if (properties.iconoffset.value === 'small') {
          wallpaperContainer.classList.add('offset-small');
        } else if (properties.iconoffset.value === 'large') {
          wallpaperContainer.classList.add('offset-large');
        }
        drawConnectors();
      }

      if (properties.neonintensity) {
        document.body.classList.remove('glow-low', 'glow-medium', 'glow-high');
        document.body.classList.add(`glow-${properties.neonintensity.value}`);
      }

      if (properties.showlegend) {
        if (properties.showlegend.value) {
          tableLegend.classList.remove('hidden');
        } else {
          tableLegend.classList.add('hidden');
        }
        drawConnectors();
      }
    }
  };
});
