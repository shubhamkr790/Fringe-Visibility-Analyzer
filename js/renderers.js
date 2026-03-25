/* ============================================
   RENDERERS — Fringe Visibility Analyzer
   All visual rendering: 2D canvas, profile, gauge, 
   Chart.js, and phasor diagram
   ============================================ */

const Renderers = (() => {
    'use strict';

    /**
     * Render 2D interference fringe pattern on canvas.
     * Each column gets the computed intensity mapped to the spectral color.
     */
    function renderFringeCanvas(canvas, state) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        const { I1, I2, wavelength, phase, slitSeparation, screenDistance, isQuantumMode } = state;
        const [baseR, baseG, baseB] = Physics.wavelengthToRGB(wavelength);
        const wavelengthMm = wavelength * 1e-6;
        const screenDistMm = screenDistance * 10;
        const fringeSpacing = (wavelengthMm * screenDistMm) / slitSeparation;

        const maxIntensity = Physics.iMax(I1, I2);
        const widthMm = 10; // 10mm view width
        const halfWidth = widthMm / 2;

        if (isQuantumMode) {
            // --- Quantum Mode: Single Photon Rejection Sampling ---
            // Fade previous frame slightly to create motion blur/accumulation
            ctx.fillStyle = 'rgba(10, 12, 16, 0.15)'; 
            ctx.fillRect(0, 0, W, H);
            
            if (maxIntensity > 0) {
                // Photon color
                ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, 0.8)`;
                
                const numPhotons = 1000;
                let drawn = 0;
                let attempts = 0;
                
                while (drawn < numPhotons && attempts < numPhotons * 10) {
                    attempts++;
                    const px = Math.random() * W;
                    const x = (px / (W - 1)) * widthMm - halfWidth;
                    const intensity = Physics.intensityAt(x, I1, I2, fringeSpacing, phase);
                    
                    // Rejection sample against intensity
                    if (Math.random() * maxIntensity < intensity) {
                        const py = Math.random() * H;
                        
                        // Apply Gaussian vertical envelope
                        const yCenter = H / 2;
                        const ySigma = H * 0.4;
                        const envelope = Math.exp(-0.5 * Math.pow((py - yCenter) / ySigma, 2));
                        
                        if (Math.random() < 0.15 + 0.85 * envelope) {
                            ctx.fillRect(px, py, 1.5, 1.5); // draw photon
                            drawn++;
                        }
                    }
                }
            }
        } else {
            // --- Classical Mode: Continuous Wave Intensity ---
            const imageData = ctx.createImageData(W, H);
            const data = imageData.data;

            for (let col = 0; col < W; col++) {
                const x = (col / (W - 1)) * widthMm - halfWidth;
                const intensity = Physics.intensityAt(x, I1, I2, fringeSpacing, phase);
                const normalizedI = maxIntensity > 0 ? intensity / maxIntensity : 0;
                const clamped = Math.max(0, Math.min(1, normalizedI));

                // Apply intensity to spectral color
                const r = Math.round(baseR * clamped);
                const g = Math.round(baseG * clamped);
                const b = Math.round(baseB * clamped);

                for (let row = 0; row < H; row++) {
                    // Add slight vertical Gaussian envelope for realism
                    const yCenter = H / 2;
                    const ySigma = H * 0.4;
                    const yFactor = Math.exp(-0.5 * Math.pow((row - yCenter) / ySigma, 2));
                    const finalFactor = 0.15 + 0.85 * yFactor; // never fully dark at edges

                    const idx = (row * W + col) * 4;
                    data[idx] = Math.round(r * finalFactor);
                    data[idx + 1] = Math.round(g * finalFactor);
                    data[idx + 2] = Math.round(b * finalFactor);
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
        }

        // Draw center marker line
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Get intensity at a specific canvas pixel position for tooltip.
     */
    function getIntensityAtPixel(canvasWidth, pixelX, state) {
        const { I1, I2, wavelength, phase, slitSeparation, screenDistance } = state;
        const wavelengthMm = wavelength * 1e-6;
        const screenDistMm = screenDistance * 10;
        const fringeSpacing = (wavelengthMm * screenDistMm) / slitSeparation;
        const widthMm = 10;
        const halfWidth = widthMm / 2;
        const x = (pixelX / (canvasWidth - 1)) * widthMm - halfWidth;
        return Physics.intensityAt(x, I1, I2, fringeSpacing, phase);
    }

    /**
     * Render 1D intensity cross-section profile.
     */
    function renderIntensityProfile(canvas, state) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const { I1, I2, wavelength, phase, slitSeparation, screenDistance } = state;
        const { profile } = Physics.computeIntensityProfile(
            I1, I2, wavelength, phase, slitSeparation, screenDistance, W, 10
        );

        const maxI = Physics.iMax(I1, I2);
        const minI = Physics.iMin(I1, I2);
        const displayMax = maxI * 1.15 || 1;

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * H;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * W;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }

        // I_max line
        const ymaxLine = H - (maxI / displayMax) * H;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ymaxLine);
        ctx.lineTo(W, ymaxLine);
        ctx.stroke();
        ctx.setLineDash([]);

        // I_max label
        ctx.fillStyle = '#22C55E';
        ctx.font = '10px "JetBrains Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`I_max = ${maxI.toFixed(1)}`, 4, ymaxLine - 4);

        // I_min line
        const yminLine = H - (minI / displayMax) * H;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yminLine);
        ctx.lineTo(W, yminLine);
        ctx.stroke();
        ctx.setLineDash([]);

        // I_min label
        ctx.fillStyle = '#EF4444';
        ctx.fillText(`I_min = ${minI.toFixed(1)}`, 4, yminLine + 12);

        // Intensity curve
        const [r, g, b] = Physics.wavelengthToRGB(wavelength);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${r},${g},${b},0.5)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < W; i++) {
            const y = H - (profile[i] / displayMax) * H;
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill under curve
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.lineTo(W - 1, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Axis labels
        ctx.fillStyle = '#6B7280';
        ctx.font = '9px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('Position (x)', W / 2, H - 3);
        
        ctx.save();
        ctx.translate(10, H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('I(x)', 0, 0);
        ctx.restore();
    }

    /**
     * Render analog visibility gauge.
     */
    function renderVisibilityGauge(canvas, V) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const centerX = W / 2;
        const centerY = H * 0.85;
        const radius = Math.min(W, H) * 0.65;
        const startAngle = Math.PI * 1.15;
        const endAngle = Math.PI * -0.15;
        const totalAngle = endAngle - startAngle + 2 * Math.PI;

        // Gauge background arc
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();

        // Fill arc for current value
        const valAngle = startAngle + Math.max(0, Math.min(1, V)) * totalAngle;
        ctx.strokeStyle = '#3B82F6'; // Tech Blue
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, valAngle);
        ctx.stroke();

        // Tick marks
        for (let i = 0; i <= 10; i++) {
            const frac = i / 10;
            const angle = startAngle + frac * totalAngle;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const isMajor = i % 5 === 0;
            const tickInner = radius - (isMajor ? 20 : 14);
            const tickOuter = radius - 8;

            ctx.strokeStyle = isMajor ? '#9CA3AF' : '#4B5563';
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(centerX + cos * tickInner, centerY + sin * tickInner);
            ctx.lineTo(centerX + cos * tickOuter, centerY + sin * tickOuter);
            ctx.stroke();

            if (isMajor) {
                ctx.fillStyle = '#9CA3AF';
                ctx.font = '9px "JetBrains Mono"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const labelR = radius - 28;
                ctx.fillText(frac.toFixed(1), centerX + cos * labelR, centerY + sin * labelR);
            }
        }

        // Needle
        const needleAngle = startAngle + Math.max(0, Math.min(1, V)) * totalAngle;
        const needleLength = radius - 5;
        const needleColor = '#FFFFFF';

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(needleAngle);

        // Needle shadow/glow
        ctx.shadowColor = needleColor;
        ctx.shadowBlur = 10;

        ctx.strokeStyle = needleColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(needleLength, 0);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Needle center pivot
        ctx.fillStyle = needleColor;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Initialize and return the Chart.js visibility vs ratio chart.
     */
    function createVisibilityChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const theoreticalData = Physics.visibilityVsRatio(200);

        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'V = 2r/(1+r²)',
                        data: theoreticalData.map(d => ({ x: d.r, y: d.V })),
                        borderColor: 'rgba(59, 130, 246, 0.4)', // Tech Blue
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 1.5,
                        fill: true,
                        pointRadius: 0,
                        tension: 0.4,
                        order: 2
                    },
                    {
                        label: 'Current',
                        data: [{ x: 1, y: 1 }],
                        borderColor: '#FFFFFF',
                        backgroundColor: '#FFFFFF',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointStyle: 'circle',
                        pointBorderWidth: 1,
                        showLine: false,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 200 },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 10,
                        title: {
                            display: true,
                            text: 'I₁/I₂ Ratio',
                            color: '#6B7280',
                            font: { family: "'JetBrains Mono'", size: 10 }
                        },
                        ticks: {
                            color: '#6B7280',
                            font: { family: "'JetBrains Mono'", size: 9 }
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        min: 0,
                        max: 1.05,
                        title: {
                            display: true,
                            text: 'Visibility (V)',
                            color: '#6B7280',
                            font: { family: "'JetBrains Mono'", size: 10 }
                        },
                        ticks: {
                            color: '#6B7280',
                            font: { family: "'JetBrains Mono'", size: 9 },
                            stepSize: 0.2
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#9CA3AF',
                            font: { family: "'JetBrains Mono'", size: 9 },
                            boxWidth: 12,
                            padding: 8,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10,12,16,0.95)',
                        titleFont: { family: "'JetBrains Mono'", size: 10 },
                        bodyFont: { family: "'JetBrains Mono'", size: 10 },
                        borderColor: '#00D4AA',
                        borderWidth: 1,
                        padding: 8
                    }
                }
            }
        });
    }

    /**
     * Update chart's current point marker.
     */
    function updateVisibilityChart(chart, ratio, V) {
        chart.data.datasets[1].data = [{ x: Math.min(ratio, 10), y: V }];
        chart.update('none');
    }

    /**
     * Render phasor diagram showing E1, E2 vectors and resultant.
     */
    function renderPhasorDiagram(canvas, state) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const { I1, I2, phase } = state;
        const centerX = W / 2;
        const centerY = H / 2;
        const maxAmp = Math.sqrt(Math.max(I1, I2)) || 1;
        const scale = Math.min(W, H) * 0.35 / maxAmp;

        const E1 = Math.sqrt(Math.max(I1, 0));
        const E2 = Math.sqrt(Math.max(I2, 0));

        // E1 along x-axis (reference)
        const e1x = E1 * scale;
        const e1y = 0;

        // E2 at angle = phase
        const e2x = E2 * scale * Math.cos(phase);
        const e2y = -E2 * scale * Math.sin(phase); // negative because canvas y is inverted

        // Resultant
        const erx = e1x + e2x;
        const ery = e1y + e2y;

        // Draw reference circle
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxAmp * scale, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw axes
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(centerX - maxAmp * scale - 10, centerY);
        ctx.lineTo(centerX + maxAmp * scale + 10, centerY);
        ctx.moveTo(centerX, centerY - maxAmp * scale - 10);
        ctx.lineTo(centerX, centerY + maxAmp * scale + 10);
        ctx.stroke();

        // Draw E1 vector
        drawArrow(ctx, centerX, centerY, centerX + e1x, centerY + e1y, '#9CA3AF', 2);

        // Draw E2 vector from tip of E1
        drawArrow(ctx, centerX + e1x, centerY + e1y,
            centerX + e1x + e2x, centerY + e1y + e2y, '#D1D5DB', 2);

        // Draw resultant
        drawArrow(ctx, centerX, centerY, centerX + erx, centerY + ery, '#FFFFFF', 2.5);

        // Phase arc
        if (Math.abs(phase) > 0.05 && E1 > 0.1 && E2 > 0.1) {
            const arcRadius = 20;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX + e1x, centerY + e1y, arcRadius, 0, -phase, phase > 0);
            ctx.stroke();
        }

        // Labels
        ctx.font = '10px "JetBrains Mono"';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#9CA3AF';
        ctx.fillText('E₁', centerX + e1x / 2 - 5, centerY - 8);

        ctx.fillStyle = '#D1D5DB';
        ctx.fillText('E₂', centerX + e1x + e2x / 2 + 4, centerY + e1y + e2y / 2 - 5);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('E_R', centerX + erx / 2 + 4, centerY + ery / 2 + 14);
    }

    /**
     * Draw an arrow from (x1,y1) to (x2,y2).
     */
    function drawArrow(ctx, x1, y1, x2, y2, color, width) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return;

        const headLen = Math.min(10, len * 0.3);
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;

        // Shaft
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6),
                    y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6),
                    y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    return {
        renderFringeCanvas,
        getIntensityAtPixel,
        renderIntensityProfile,
        renderVisibilityGauge,
        createVisibilityChart,
        updateVisibilityChart,
        renderPhasorDiagram
    };
})();
