/* ============================================
   UI MODULE — Fringe Visibility Analyzer
   Slider bindings, keyboard shortcuts, CSV export,
   unknown λ estimator, presets, features tour, clock
   ============================================ */

const UI = (() => {
    'use strict';

    // --- Live Clock ---
    function startClock() {
        const el = document.getElementById('liveClock');
        if (!el) return;
        const tick = () => {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
        };
        tick();
        setInterval(tick, 1000);
    }

    // --- Slider Bindings ---
    function bindSliders(state, onUpdate) {
        const sliders = {
            i1Slider: { key: 'I1', display: 'i1Value' },
            i2Slider: { key: 'I2', display: 'i2Value' },
            wavelengthSlider: { key: 'wavelength', display: 'wavelengthValue' },
            phaseSlider: { key: 'phase', display: 'phaseValue' },
            slitSepSlider: { key: 'slitSeparation', display: 'slitSepValue' },
            screenDistSlider: { key: 'screenDistance', display: 'screenDistValue' },
            linewidthSlider: { key: 'linewidth', display: 'linewidthValue' }
        };

        Object.entries(sliders).forEach(([id, cfg]) => {
            const slider = document.getElementById(id);
            if (!slider) return;
            slider.addEventListener('input', () => {
                state[cfg.key] = parseFloat(slider.value);
                updateSliderDisplay(cfg, state);
                onUpdate();
            });
        });
    }

    function updateSliderDisplay(cfg, state) {
        const el = document.getElementById(cfg.display);
        if (!el) return;
        const val = state[cfg.key];
        if (cfg.key === 'phase') {
            el.textContent = (val / Math.PI).toFixed(2) + 'π';
        } else if (cfg.key === 'wavelength') {
            el.textContent = val + ' nm';
        } else if (cfg.key === 'slitSeparation') {
            el.textContent = val.toFixed(2) + ' mm';
        } else if (cfg.key === 'screenDistance') {
            el.textContent = val + ' cm';
        } else if (cfg.key === 'linewidth') {
            el.textContent = val.toFixed(1) + ' nm';
        } else {
            el.textContent = val;
        }
    }

    function syncAllDisplays(state) {
        const configs = [
            { key: 'I1', display: 'i1Value' },
            { key: 'I2', display: 'i2Value' },
            { key: 'wavelength', display: 'wavelengthValue' },
            { key: 'phase', display: 'phaseValue' },
            { key: 'slitSeparation', display: 'slitSepValue' },
            { key: 'screenDistance', display: 'screenDistValue' },
            { key: 'linewidth', display: 'linewidthValue' }
        ];
        configs.forEach(cfg => updateSliderDisplay(cfg, state));

        // Sync slider positions
        const sliderMap = {
            i1Slider: 'I1', i2Slider: 'I2', wavelengthSlider: 'wavelength',
            phaseSlider: 'phase', slitSepSlider: 'slitSeparation',
            screenDistSlider: 'screenDistance', linewidthSlider: 'linewidth'
        };
        Object.entries(sliderMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.value = state[key];
        });
    }

    // --- Wavelength Color Preview ---
    function updateWavelengthPreview(wavelength) {
        const el = document.getElementById('wavelengthPreview');
        if (!el) return;
        const [r, g, b] = Physics.wavelengthToRGB(wavelength);
        el.style.backgroundColor = `rgb(${r},${g},${b})`;
    }

    // --- Ratio Display ---
    function updateRatioDisplay(I1, I2) {
        const el = document.getElementById('ratioValue');
        if (!el) return;
        const ratio = I2 > 0.01 ? (I1 / I2) : (I1 > 0.01 ? '∞' : '1.00');
        el.textContent = typeof ratio === 'number' ? ratio.toFixed(2) : ratio;
    }

    // --- Visibility Gauge Display ---
    function updateGaugeDisplay(V) {
        const valueEl = document.getElementById('visibilityValue');
        const qualityEl = document.getElementById('visibilityQuality');
        if (!valueEl) return;

        valueEl.textContent = V.toFixed(3);

        // Remove all classes
        valueEl.className = 'gauge-value';
        if (qualityEl) qualityEl.className = 'gauge-quality';

        let quality, qualityClass;
        if (V >= 0.95) { quality = '● Excellent'; qualityClass = 'excellent'; valueEl.classList.add('good'); }
        else if (V >= 0.7) { quality = '● Good'; qualityClass = 'good'; valueEl.classList.add('good'); }
        else if (V >= 0.3) { quality = '● Moderate'; qualityClass = 'moderate'; valueEl.classList.add('moderate'); }
        else { quality = '● Poor'; qualityClass = 'poor'; valueEl.classList.add('poor'); }

        if (qualityEl) {
            qualityEl.textContent = quality;
            qualityEl.classList.add(qualityClass);
        }
    }

    // --- Optimal Condition Indicator ---
    function updateOptimalIndicator(V) {
        const el = document.getElementById('optimalIndicator');
        if (!el) return;
        el.classList.toggle('visible', V >= 0.999);
    }

    // --- Measurement Table ---
    function updateMeasurements(state) {
        const V = Physics.visibility(state.I1, state.I2);
        const maxI = Physics.iMax(state.I1, state.I2);
        const minI = Physics.iMin(state.I1, state.I2);
        const ratio = Physics.intensityRatio(state.I1, state.I2);
        const fSpacing = Physics.fringeSpacingMm(state.wavelength, state.screenDistance, state.slitSeparation);
        const nFringes = Physics.fringeCount(state.wavelength, state.screenDistance, state.slitSeparation, 10);

        setTextById('measImax', maxI.toFixed(2));
        setTextById('measImin', minI.toFixed(2));
        setTextById('measRatio', ratio === Infinity ? '∞' : ratio.toFixed(3));
        setTextById('measFringeSpacing', (fSpacing * 1000).toFixed(1) + ' μm');
        setTextById('measFringeCount', nFringes);
    }

    // --- Fringe Counter ---
    function updateFringeCounter(state) {
        const el = document.getElementById('fringeCountDisplay');
        if (!el) return;
        const n = Physics.fringeCount(state.wavelength, state.screenDistance, state.slitSeparation, 10);
        el.textContent = n + ' fringes';
    }

    // --- Live Formula Display ---
    function updateLiveFormula(state) {
        const el = document.getElementById('liveFormulaContent');
        if (!el) return;
        const V = Physics.visibility(state.I1, state.I2);
        const sqrtProd = Math.sqrt(state.I1 * state.I2);
        el.innerHTML = `
            <div class="formula-line">V = 2√(I₁·I₂) / (I₁ + I₂)</div>
            <div class="formula-line">V = 2√(<span class="val">${state.I1}</span> × <span class="val">${state.I2}</span>) / (<span class="val">${state.I1}</span> + <span class="val">${state.I2}</span>)</div>
            <div class="formula-line">V = 2 × <span class="val">${sqrtProd.toFixed(2)}</span> / <span class="val">${(state.I1 + state.I2).toFixed(2)}</span></div>
            <div class="formula-line">V = <span class="result">${V.toFixed(4)}</span></div>
        `;
    }

    // --- Formula Bar ---
    function updateFormulaBar(state) {
        const el = document.getElementById('formulaBarContent');
        if (!el) return;
        const maxI = Physics.iMax(state.I1, state.I2);
        const minI = Physics.iMin(state.I1, state.I2);
        const V = Physics.visibility(state.I1, state.I2);
        el.innerHTML = `I(x) = <span class="formula-highlight">${state.I1}</span> + <span class="formula-highlight">${state.I2}</span> + 2√(${state.I1}·${state.I2})·cos(2πx/d + ${(state.phase / Math.PI).toFixed(2)}π)  →  I<sub>max</sub> = <span class="formula-warn">${maxI.toFixed(1)}</span>,  I<sub>min</sub> = <span class="formula-warn">${minI.toFixed(1)}</span>,  V = <span class="formula-highlight">${V.toFixed(4)}</span>`;
    }

    // --- Coherence Length Display ---
    function updateCoherence(state) {
        const el = document.getElementById('coherenceValue');
        if (!el) return;
        const Lc = Physics.coherenceLength(state.wavelength, state.linewidth);
        el.textContent = Lc === Infinity ? '∞' : Lc.toFixed(2) + ' mm';
    }

    // --- Canvas Tooltip ---
    function bindCanvasTooltip(canvas, state) {
        const tooltip = document.getElementById('canvasTooltip');
        if (!tooltip) return;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const pixelX = Math.round((e.clientX - rect.left) / rect.width * canvas.width);
            const pixelY = Math.round((e.clientY - rect.top) / rect.height * canvas.height);
            const intensity = Renderers.getIntensityAtPixel(canvas.width, pixelX, state);
            const maxI = Physics.iMax(state.I1, state.I2);
            const normI = maxI > 0 ? (intensity / maxI * 100).toFixed(1) : '0.0';

            tooltip.textContent = `I = ${intensity.toFixed(2)}  (${normI}%)  @  px ${pixelX}`;
            tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
            tooltip.style.top = (e.clientY - rect.top - 28) + 'px';
            tooltip.classList.add('visible');
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    }

    // --- Keyboard Shortcuts ---
    function bindKeyboard(state, onUpdate, onToggleAnimation, onReset) {
        let activeSlider = null;

        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('focus', () => { activeSlider = slider; });
        });

        document.addEventListener('keydown', (e) => {
            // Don't capture when typing in inputs
            if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

            switch (e.key) {
                case ' ':
                case 'Spacebar':
                    e.preventDefault();
                    onToggleAnimation();
                    break;
                case 'r':
                case 'R':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        onReset();
                    }
                    break;
                case 'ArrowUp':
                case 'ArrowRight':
                    if (activeSlider) {
                        e.preventDefault();
                        activeSlider.value = parseFloat(activeSlider.value) + parseFloat(activeSlider.step || 1);
                        activeSlider.dispatchEvent(new Event('input'));
                    }
                    break;
                case 'ArrowDown':
                case 'ArrowLeft':
                    if (activeSlider) {
                        e.preventDefault();
                        activeSlider.value = parseFloat(activeSlider.value) - parseFloat(activeSlider.step || 1);
                        activeSlider.dispatchEvent(new Event('input'));
                    }
                    break;
            }
        });
    }

    // --- Preset Scenarios ---
    function bindPresets(state, onUpdate, syncFn) {
        const presets = {
            presetEqual: { I1: 100, I2: 100, wavelength: 550, phase: 0, label: 'Equal Beams (V=1)' },
            presetRatio10: { I1: 100, I2: 10, wavelength: 550, phase: 0, label: '10:1 Ratio' },
            presetNearZero: { I1: 200, I2: 1, wavelength: 550, phase: 0, label: 'Near Zero V' },
            presetHeNe: { I1: 100, I2: 100, wavelength: 633, phase: 0, label: 'HeNe 632.8nm' }
        };

        Object.entries(presets).forEach(([id, preset]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.entries(preset).forEach(([k, v]) => {
                    if (k !== 'label') state[k] = v;
                });
                syncFn(state);
                onUpdate();

                // Highlight active preset button
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // --- Unknown Wavelength Estimator ---
    function bindEstimator() {
        const toggleBtn = document.getElementById('estimatorToggle');
        const panel = document.getElementById('estimatorPanel');
        const computeBtn = document.getElementById('estimatorCompute');
        const resultEl = document.getElementById('estimatorResultValue');

        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('visible');
            toggleBtn.textContent = panel.classList.contains('visible') ? '▲ Hide' : '▼ Estimate Unknown λ';
        });

        if (computeBtn) {
            computeBtn.addEventListener('click', () => {
                const fSpacing = parseFloat(document.getElementById('estFringeSpacing').value) || 0;
                const slitSep = parseFloat(document.getElementById('estSlitSep').value) || 0;
                const screenDist = parseFloat(document.getElementById('estScreenDist').value) || 0;

                if (fSpacing > 0 && slitSep > 0 && screenDist > 0) {
                    const lambda = Physics.estimateWavelength(fSpacing, slitSep, screenDist);
                    resultEl.textContent = lambda.toFixed(1) + ' nm';

                    // Color the result by estimated wavelength
                    const [r, g, b] = Physics.wavelengthToRGB(Math.max(380, Math.min(780, lambda)));
                    resultEl.style.color = `rgb(${r},${g},${b})`;
                    resultEl.style.textShadow = `0 0 10px rgba(${r},${g},${b},0.5)`;
                } else {
                    resultEl.textContent = '—';
                    resultEl.style.color = '';
                    resultEl.style.textShadow = '';
                }
            });
        }
    }

    // --- CSV Export ---
    function exportCSV(state) {
        const V = Physics.visibility(state.I1, state.I2);
        const maxI = Physics.iMax(state.I1, state.I2);
        const minI = Physics.iMin(state.I1, state.I2);
        const ratio = Physics.intensityRatio(state.I1, state.I2);
        const fSpacing = Physics.fringeSpacingMm(state.wavelength, state.screenDistance, state.slitSeparation);
        const nFringes = Physics.fringeCount(state.wavelength, state.screenDistance, state.slitSeparation, 10);
        const Lc = Physics.coherenceLength(state.wavelength, state.linewidth);

        let csv = 'Parameter,Value,Unit\n';
        csv += `I1,${state.I1},arb. units\n`;
        csv += `I2,${state.I2},arb. units\n`;
        csv += `Wavelength,${state.wavelength},nm\n`;
        csv += `Phase Offset,${(state.phase / Math.PI).toFixed(4)},π rad\n`;
        csv += `Slit Separation,${state.slitSeparation},mm\n`;
        csv += `Screen Distance,${state.screenDistance},cm\n`;
        csv += `Linewidth,${state.linewidth},nm\n`;
        csv += `Visibility (V),${V.toFixed(6)},\n`;
        csv += `I_max,${maxI.toFixed(4)},arb. units\n`;
        csv += `I_min,${minI.toFixed(4)},arb. units\n`;
        csv += `Intensity Ratio,${ratio === Infinity ? 'Infinity' : ratio.toFixed(4)},\n`;
        csv += `Fringe Spacing,${(fSpacing * 1000).toFixed(2)},μm\n`;
        csv += `Fringe Count,${nFringes},\n`;
        csv += `Coherence Length,${Lc === Infinity ? 'Infinity' : Lc.toFixed(4)},mm\n`;

        // Add intensity profile data
        csv += '\n\nIntensity Profile\n';
        csv += 'Sample Index,Position (mm),Intensity\n';
        const { profile } = Physics.computeIntensityProfile(
            state.I1, state.I2, state.wavelength, state.phase,
            state.slitSeparation, state.screenDistance, 200, 10
        );
        for (let i = 0; i < profile.length; i++) {
            const x = (i / (profile.length - 1)) * 10 - 5;
            csv += `${i},${x.toFixed(4)},${profile[i].toFixed(4)}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fringe_visibility_data_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- Animation Toggle ---
    function bindAnimationToggle(onToggle) {
        const btn = document.getElementById('animToggle');
        if (!btn) return;
        btn.addEventListener('click', onToggle);
    }

    function updateToggleUI(id, isActive) {
        const toggle = document.getElementById(id);
        if (toggle) toggle.classList.toggle('active', isActive);
    }

    // --- Special Modes ---
    function bindSpecialModes(onQuantum, onNoise, onLigo) {
        const qBtn = document.getElementById('quantumToggle');
        if (qBtn) qBtn.addEventListener('click', onQuantum);
        
        const nBtn = document.getElementById('noiseToggle');
        if (nBtn) nBtn.addEventListener('click', onNoise);

        const lBtn = document.getElementById('ligoBtn');
        if (lBtn) lBtn.addEventListener('click', onLigo);
    }

    // --- Features Tour ---
    function startTour() {
        const overlay = document.getElementById('tourOverlay');
        if (!overlay) return;

        const steps = [
            {
                element: '#controlPanel',
                title: 'Control Panel',
                text: 'Adjust beam intensities (I₁, I₂), wavelength, phase offset, and optical parameters. Use keyboard arrows for fine control.'
            },
            {
                element: '.canvas-wrapper',
                title: '2D Interference Pattern',
                text: 'Real-time physics-accurate rendering of interference fringes using the Bruton wavelength-to-RGB algorithm. Hover for intensity values.'
            },
            {
                element: '.gauge-container',
                title: 'Visibility Gauge',
                text: 'Analog-style gauge showing Michelson fringe visibility V = 2√(I₁·I₂)/(I₁+I₂). Color-coded by quality zone.'
            },
            {
                element: '#profileCanvas',
                title: '1D Intensity Profile',
                text: 'Cross-sectional intensity I(x) showing constructive/destructive interference with labeled I_max and I_min.'
            },
            {
                element: '#visChart',
                title: 'Visibility vs Ratio',
                text: 'Live Chart.js plot of V = 2r/(1+r²) with your current operating point marked. Shows how visibility degrades with unequal beams.'
            },
            {
                element: '#phasorCanvas',
                title: 'Phasor Diagram',
                text: 'E-field phasors E₁, E₂ and their resultant E_R. Geometric visualization of how phase offset affects interference.'
            },
            {
                element: '.preset-grid',
                title: 'Quick Presets',
                text: 'One-click scenarios: Equal Beams (V=1), 10:1 Ratio, Near Zero, HeNe Laser. Demonstrates key physics instantly.'
            },
            {
                element: '#estimatorToggle',
                title: 'Unknown λ Estimator',
                text: 'Reverse-calculation mode: input measured fringe spacing and source parameters to compute an unknown wavelength — mirrors real lab practice.'
            }
        ];

        let currentStep = 0;

        function showStep(idx) {
            const step = steps[idx];
            const target = document.querySelector(step.element);
            if (!target) return;

            const rect = target.getBoundingClientRect();
            const highlight = overlay.querySelector('.tour-highlight');
            const tooltip = overlay.querySelector('.tour-tooltip');
            const titleEl = overlay.querySelector('.tour-tooltip-title');
            const textEl = overlay.querySelector('.tour-tooltip-text');

            highlight.style.left = (rect.left - 4) + 'px';
            highlight.style.top = (rect.top - 4) + 'px';
            highlight.style.width = (rect.width + 8) + 'px';
            highlight.style.height = (rect.height + 8) + 'px';

            titleEl.textContent = step.title;
            textEl.textContent = step.text;

            // Position tooltip
            const tooltipX = rect.right + 16;
            const tooltipY = rect.top;
            tooltip.style.left = Math.min(tooltipX, window.innerWidth - 350) + 'px';
            tooltip.style.top = Math.min(tooltipY, window.innerHeight - 200) + 'px';

            // Update dots
            overlay.querySelectorAll('.tour-dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === idx);
            });
        }

        // Create dots
        const dotsContainer = overlay.querySelector('.tour-dots');
        dotsContainer.innerHTML = '';
        steps.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'tour-dot';
            dotsContainer.appendChild(dot);
        });

        overlay.classList.add('visible');
        showStep(0);

        const nextBtn = overlay.querySelector('.tour-btn-next');
        const prevBtn = overlay.querySelector('.tour-btn-prev');

        const nextHandler = () => {
            currentStep++;
            if (currentStep >= steps.length) {
                overlay.classList.remove('visible');
                nextBtn.removeEventListener('click', nextHandler);
                prevBtn.removeEventListener('click', prevHandler);
                return;
            }
            showStep(currentStep);
        };

        const prevHandler = () => {
            if (currentStep > 0) {
                currentStep--;
                showStep(currentStep);
            }
        };

        nextBtn.addEventListener('click', nextHandler);
        prevBtn.addEventListener('click', prevHandler);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
            }
        });
    }

    function bindTour() {
        const btn = document.getElementById('tourBtn');
        if (btn) btn.addEventListener('click', startTour);
    }

    function bindExport(state) {
        const btn = document.getElementById('exportBtn');
        if (btn) btn.addEventListener('click', () => exportCSV(state));
    }

    // --- Utility ---
    function setTextById(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    return {
        startClock,
        bindSliders,
        syncAllDisplays,
        updateWavelengthPreview,
        updateRatioDisplay,
        updateGaugeDisplay,
        updateOptimalIndicator,
        updateMeasurements,
        updateFringeCounter,
        updateLiveFormula,
        updateFormulaBar,
        updateCoherence,
        bindCanvasTooltip,
        bindKeyboard,
        bindPresets,
        bindEstimator,
        bindAnimationToggle,
        updateToggleUI,
        bindSpecialModes,
        bindTour,
        bindExport,
        exportCSV
    };
})();
