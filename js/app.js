/* ============================================
   APP — Fringe Visibility Analyzer
   Main entry: state management, initialization,
   master update pipeline, animation loop
   ============================================ */

(() => {
    'use strict';

    // --- Application State ---
    const AppState = {
        // Beam parameters
        I1: 100,
        I2: 100,

        // Wave parameters
        wavelength: 550,    // nm
        phase: 0,           // radians

        // Optical setup
        slitSeparation: 0.5, // mm
        screenDistance: 100,  // cm

        // Coherence
        linewidth: 1.0,     // nm (Δλ)

        // Animation & Modes
        isAnimating: false,
        animationId: null,
        phaseStep: 0.02,     // rad/frame
        
        isQuantumMode: false,
        isNoiseMode: false,
        ligoOffset: 0,
        ligoStartTime: 0
    };

    // --- Canvas references ---
    let fringeCanvas, profileCanvas, gaugeCanvas, phasorCanvas;
    let visibilityChart;

    // --- Master Update Pipeline ---
    function update() {
        // Inject temporary offsets (LIGO/Noise)
        const savedPhase = AppState.phase;
        let noise = 0;
        if (AppState.isNoiseMode) {
            noise = (Math.random() - 0.5) * 0.2; // random phase jitter
        }
        AppState.phase = savedPhase + AppState.ligoOffset + noise;

        const V = Physics.visibility(AppState.I1, AppState.I2);
        const ratio = Physics.intensityRatio(AppState.I1, AppState.I2);

        // Render all 5 outputs
        Renderers.renderFringeCanvas(fringeCanvas, AppState);
        Renderers.renderIntensityProfile(profileCanvas, AppState);
        Renderers.renderVisibilityGauge(gaugeCanvas, V);
        Renderers.updateVisibilityChart(visibilityChart, ratio, V);
        Renderers.renderPhasorDiagram(phasorCanvas, AppState);

        // Restore true phase
        AppState.phase = savedPhase;

        // Dynamic Neon Glow on Canvas wrapper
        const wrapper = fringeCanvas.parentElement;
        if (wrapper) {
            const [r, g, b] = Physics.wavelengthToRGB(AppState.wavelength);
            const V_clamped = Math.max(0, Math.min(1, V));
            wrapper.style.boxShadow = `0 0 30px rgba(${r},${g},${b},${0.4 * V_clamped + 0.1}), inset 0 0 30px rgba(0,0,0,0.5)`;
            wrapper.style.borderColor = `rgba(${r},${g},${b},${0.5 * V_clamped + 0.2})`;
        }

        // Update all UI displays
        UI.updateGaugeDisplay(V);
        UI.updateOptimalIndicator(V);
        UI.updateRatioDisplay(AppState.I1, AppState.I2);
        UI.updateWavelengthPreview(AppState.wavelength);
        UI.updateMeasurements(AppState);
        UI.updateFringeCounter(AppState);
        UI.updateLiveFormula(AppState);
        UI.updateFormulaBar(AppState);
        UI.updateCoherence(AppState);
    }

    // --- Animation Loop ---
    function animationLoop(timestamp) {
        let shouldUpdate = false;

        if (AppState.isAnimating) {
            AppState.phase += AppState.phaseStep;
            if (AppState.phase > 2 * Math.PI) AppState.phase -= 2 * Math.PI;
            shouldUpdate = true;

            const form = document.getElementById('phaseSlider');
            if (form) form.value = AppState.phase;
            const phaseVal = document.getElementById('phaseValue');
            if (phaseVal) phaseVal.textContent = (AppState.phase / Math.PI).toFixed(2) + 'π';
        }

        if (AppState.ligoStartTime > 0) {
            const t = (timestamp - AppState.ligoStartTime) / 1000;
            if (t < 2.0) { // 2 second event duration
                AppState.ligoOffset = Math.sin(t * 30) * Math.exp(-t * 2) * 1.5;
                shouldUpdate = true;
            } else {
                AppState.ligoOffset = 0;
                AppState.ligoStartTime = 0;
                shouldUpdate = true; 
            }
        }

        if (AppState.isQuantumMode) {
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            update();
        }

        if (AppState.isAnimating || AppState.ligoStartTime > 0 || AppState.isQuantumMode) {
            AppState.animationId = requestAnimationFrame(animationLoop);
        } else {
            AppState.animationId = null;
        }
    }

    function toggleAnimation() {
        AppState.isAnimating = !AppState.isAnimating;
        UI.updateToggleUI('animToggle', AppState.isAnimating);
        const ind = document.getElementById('animationIndicator');
        if (ind) ind.classList.toggle('visible', AppState.isAnimating);

        if (AppState.isAnimating && !AppState.animationId) {
            AppState.animationId = requestAnimationFrame(animationLoop);
        }
    }

    function triggerLigo() {
        AppState.ligoStartTime = performance.now();
        if (!AppState.animationId) {
            AppState.animationId = requestAnimationFrame(animationLoop);
        }
    }

    function toggleQuantum() {
        AppState.isQuantumMode = !AppState.isQuantumMode;
        UI.updateToggleUI('quantumToggle', AppState.isQuantumMode);
        if (AppState.isQuantumMode && !AppState.animationId) {
            AppState.animationId = requestAnimationFrame(animationLoop);
        } else if (!AppState.isQuantumMode) {
            update(); // final clear render
        }
    }

    function toggleNoise() {
        AppState.isNoiseMode = !AppState.isNoiseMode;
        UI.updateToggleUI('noiseToggle', AppState.isNoiseMode);
        update();
    }

    function resetAll() {
        AppState.I1 = 100;
        AppState.I2 = 100;
        AppState.wavelength = 550;
        AppState.phase = 0;
        AppState.slitSeparation = 0.5;
        AppState.screenDistance = 100;
        AppState.linewidth = 1.0;

        AppState.isQuantumMode = false;
        AppState.isNoiseMode = false;
        AppState.ligoOffset = 0;
        AppState.ligoStartTime = 0;

        if (UI.updateToggleUI) {
            UI.updateToggleUI('quantumToggle', false);
            UI.updateToggleUI('noiseToggle', false);
        }

        if (AppState.isAnimating) {
            AppState.isAnimating = false;
            if (UI.updateToggleUI) UI.updateToggleUI('animToggle', false);
            const ind = document.getElementById('animationIndicator');
            if (ind) ind.classList.remove('visible');
        }

        if (AppState.animationId) {
            cancelAnimationFrame(AppState.animationId);
            AppState.animationId = null;
        }

        UI.syncAllDisplays(AppState);
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        update();
    }

    // --- Canvas Resizing ---
    function resizeCanvases() {
        const dpr = window.devicePixelRatio || 1;

        // Fringe canvas
        const fringeWrapper = fringeCanvas.parentElement;
        fringeCanvas.width = fringeWrapper.clientWidth * dpr;
        fringeCanvas.height = fringeWrapper.clientHeight * dpr;

        // Profile canvas
        const profileWrapper = profileCanvas.parentElement;
        profileCanvas.width = profileWrapper.clientWidth * dpr;
        profileCanvas.height = profileWrapper.clientHeight * dpr;

        // Gauge canvas
        gaugeCanvas.width = 200 * dpr;
        gaugeCanvas.height = 120 * dpr;
        const gctx = gaugeCanvas.getContext('2d');
        gctx.scale(dpr, dpr);

        // Phasor canvas
        const phasorWrapper = phasorCanvas.parentElement;
        phasorCanvas.width = phasorWrapper.clientWidth * dpr;
        phasorCanvas.height = phasorWrapper.clientHeight * dpr;

        update();
    }

    // --- Initialization ---
    function init() {
        // Get canvas elements
        fringeCanvas = document.getElementById('fringeCanvas');
        profileCanvas = document.getElementById('profileCanvas');
        gaugeCanvas = document.getElementById('gaugeCanvas');
        phasorCanvas = document.getElementById('phasorCanvas');

        // Create Chart.js chart
        visibilityChart = Renderers.createVisibilityChart('visChart');

        // Bind all UI interactions
        UI.bindSliders(AppState, update);
        UI.bindKeyboard(AppState, update, toggleAnimation, resetAll);
        UI.bindPresets(AppState, update, UI.syncAllDisplays);
        UI.bindEstimator();
        UI.bindAnimationToggle(toggleAnimation);
        UI.bindSpecialModes(toggleQuantum, toggleNoise, triggerLigo);
        UI.bindCanvasTooltip(fringeCanvas, AppState);
        UI.bindTour();
        UI.bindExport(AppState);
        UI.startClock();

        // Sync all displays and initial render
        UI.syncAllDisplays(AppState);
        resizeCanvases();

        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resizeCanvases, 150);
        });
    }

    // --- Boot ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
