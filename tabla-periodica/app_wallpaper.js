document.addEventListener('DOMContentLoaded', () => {
  const mainGrid = document.getElementById('mainGrid');
  const fblockGrid = document.getElementById('fblockGrid');
  const tableLegend = document.getElementById('tableLegend');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContainer = document.getElementById('modalContainer');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const nucleusTarget = document.getElementById('nucleusTarget');
  const atomCanvas = document.getElementById('atomCanvas');
  const pathEl = document.getElementById('connectorPath');
  const connArea = document.querySelector('.connector-area');

  let activeCard = null;
  let atomAnimationId = null;
  let isSideOpen = false;

  function hexToRgb(hex) {
    try {
      let c = (hex || '#ffffff').replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      const num = parseInt(c, 16);
      return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    } catch {
      return '100, 181, 246';
    }
  }

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

  // SVG Connector Line
  function drawConnectors() {
    try {
      if (!lanthPlaceholder || !fblockGrid || !pathEl || !connArea) return;
      const boxRect = lanthPlaceholder.getBoundingClientRect();
      const fblockFirst = fblockGrid.children[0]?.getBoundingClientRect();
      const connRect = connArea.getBoundingClientRect();

      if (!boxRect || !fblockFirst || boxRect.width === 0) return;

      const startX = boxRect.left - connRect.left + boxRect.width * 0.5;
      const targetX = fblockFirst.left - connRect.left;
      const midY = connRect.height * 0.5;

      pathEl.setAttribute('d', `M ${startX} 0 L ${startX} ${midY} L ${targetX} ${midY} L ${targetX} ${connRect.height}`);
    } catch (e) {
      console.error(e);
    }
  }

  setTimeout(drawConnectors, 50);
  setTimeout(drawConnectors, 300);
  window.addEventListener('resize', drawConnectors);

  // Highlight Category on Legend Hover
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

  // Bohr Atom Modal
  function openAtomModal(el, clickedCard) {
    activeCard = clickedCard;
    isSideOpen = false;
    modalContainer.classList.remove('side-open');

    const cat = CATEGORIES_INFO[el.cat] || { color: '#29b6f6', name: 'Elemento' };
    modalOverlay.style.setProperty('--modal-color', cat.color);

    const rect = clickedCard.getBoundingClientRect();
    modalContainer.style.transition = 'none';
    modalContainer.style.left = `${rect.left}px`;
    modalContainer.style.top = `${rect.top}px`;
    modalContainer.style.width = `${rect.width}px`;
    modalContainer.style.height = `${rect.height}px`;
    modalContainer.style.borderRadius = '4px';
    modalContainer.classList.remove('expanded');

    document.getElementById('miniNum').innerText = el.n;
    document.getElementById('miniSymbol').innerText = el.s;
    document.getElementById('miniSymbol').style.color = cat.color;
    document.getElementById('miniName').innerText = el.name;
    document.getElementById('miniMass').innerText = el.mass;

    document.getElementById('modalSymbol').innerText = el.s;
    document.getElementById('modalName').innerText = el.name;
    document.getElementById('modalCfg').innerText = el.cfg || '';
    document.getElementById('modalNum').innerText = el.n;
    document.getElementById('modalMass').innerText = (el.mass || '') + ' u';
    document.getElementById('modalCat').innerText = cat.name;

    document.getElementById('factWatermark').innerText = el.s;
    document.getElementById('factText').innerText = el.fact || "Elemento químico de la tabla periódica.";
    document.getElementById('factState').innerText = getElementState(el.n, el.s);
    document.getElementById('factGroupVal').innerText = cat.name;

    activeCard.style.opacity = '0';
    modalOverlay.classList.add('active');

    requestAnimationFrame(() => {
      setTimeout(() => {
        const baseSize = window.innerHeight * 0.46;
        const targetLeft = (window.innerWidth - baseSize) / 2;
        const targetTop = (window.innerHeight - baseSize) / 2;

        modalContainer.style.transition = 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1), top 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.4s ease';
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

  nucleusTarget.addEventListener('click', (e) => {
    e.stopPropagation();
    isSideOpen = !isSideOpen;
    const baseSize = window.innerHeight * 0.46;

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
      modalContainer.style.borderRadius = '4px';
    }

    setTimeout(() => {
      if (activeCard) activeCard.style.opacity = '';
      modalOverlay.classList.remove('active');
      if (atomAnimationId) cancelAnimationFrame(atomAnimationId);
    }, 400);
  }

  function startAtomOrbit(el, mainColor) {
    const ctx = atomCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const displaySize = 290;

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

      const nucleusPulse = 14 + Math.sin(Date.now() * 0.005) * 2.0;
      const nGrad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, nucleusPulse * 1.8);
      nGrad.addColorStop(0, '#ffffff');
      nGrad.addColorStop(0.4, mainColor);
      nGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = nGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, nucleusPulse * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, nucleusPulse * 0.55, 0, Math.PI * 2);
      ctx.fill();

      shells.forEach((electronCount, shellIdx) => {
        const radius = baseRadius + (shellIdx + 1) * radiusStep;
        const speed = (0.016 - shellIdx * 0.0018) * (shellIdx % 2 === 0 ? 1 : -1);
        angleOffsets[shellIdx] += speed;

        ctx.strokeStyle = mainColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        for (let i = 0; i < electronCount; i++) {
          const angle = angleOffsets[shellIdx] + (i * (2 * Math.PI / electronCount));
          const ex = centerX + radius * Math.cos(angle);
          const ey = centerY + radius * Math.sin(angle);

          const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
          eGrad.addColorStop(0, '#ffffff');
          eGrad.addColorStop(0.5, mainColor);
          eGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = eGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, 6, 0, Math.PI * 2);
          ctx.fill();

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
});
