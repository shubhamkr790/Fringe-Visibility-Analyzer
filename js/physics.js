/* ============================================
   PHYSICS ENGINE — Fringe Visibility Analyzer
   All physics computation: interference, visibility, 
   wavelength-to-RGB, coherence, unknown λ estimator
   ============================================ */

const Physics = (() => {
    'use strict';

    /**
     * Compute the interference intensity at position x.
     * I(x) = I1 + I2 + 2*sqrt(I1*I2)*cos(2*pi*x/d + phi)
     * where d = wavelength * screenDistance / slitSeparation
     */
    function intensityAt(x, I1, I2, fringeSpacing, phase) {
        const sqrtProduct = Math.sqrt(Math.max(I1, 0) * Math.max(I2, 0));
        return I1 + I2 + 2 * sqrtProduct * Math.cos((2 * Math.PI * x) / fringeSpacing + phase);
    }

    /**
     * Compute full intensity profile across N sample points.
     * Returns Float64Array of intensity values.
     */
    function computeIntensityProfile(I1, I2, wavelengthNm, phase, slitSepMm, screenDistCm, numPoints, widthMm) {
        const wavelengthMm = wavelengthNm * 1e-6; // nm to mm
        const screenDistMm = screenDistCm * 10;   // cm to mm
        const fringeSpacing = (wavelengthMm * screenDistMm) / slitSepMm; // mm
        const profile = new Float64Array(numPoints);
        const halfWidth = widthMm / 2;

        for (let i = 0; i < numPoints; i++) {
            const x = (i / (numPoints - 1)) * widthMm - halfWidth; // mm, centered
            profile[i] = intensityAt(x, I1, I2, fringeSpacing, phase);
        }

        return { profile, fringeSpacing };
    }

    /**
     * Michelson fringe visibility.
     * V = 2*sqrt(I1*I2) / (I1 + I2)
     * Also: V = 2r / (1 + r^2) where r = sqrt(I1/I2)
     */
    function visibility(I1, I2) {
        const sum = I1 + I2;
        if (sum < 1e-10) return 0;
        return (2 * Math.sqrt(Math.max(I1, 0) * Math.max(I2, 0))) / sum;
    }

    /**
     * Maximum intensity: I_max = I1 + I2 + 2*sqrt(I1*I2)
     */
    function iMax(I1, I2) {
        return I1 + I2 + 2 * Math.sqrt(Math.max(I1, 0) * Math.max(I2, 0));
    }

    /**
     * Minimum intensity: I_min = I1 + I2 - 2*sqrt(I1*I2)
     */
    function iMin(I1, I2) {
        return Math.max(0, I1 + I2 - 2 * Math.sqrt(Math.max(I1, 0) * Math.max(I2, 0)));
    }

    /**
     * Intensity ratio I1/I2, clamped to avoid division by zero.
     */
    function intensityRatio(I1, I2) {
        if (I2 < 0.01) return I1 < 0.01 ? 1 : Infinity;
        return I1 / I2;
    }

    /**
     * Compute fringe spacing in mm.
     * d = λ * L / a
     * λ in nm, L in cm, a in mm → d in mm
     */
    function fringeSpacingMm(wavelengthNm, screenDistCm, slitSepMm) {
        return (wavelengthNm * 1e-6 * screenDistCm * 10) / slitSepMm;
    }

    /**
     * Count visible fringes in a given width.
     */
    function fringeCount(wavelengthNm, screenDistCm, slitSepMm, widthMm) {
        const spacing = fringeSpacingMm(wavelengthNm, screenDistCm, slitSepMm);
        if (spacing < 1e-10) return 0;
        return Math.floor(widthMm / spacing);
    }

    /**
     * Compute visibility as a function of intensity ratio r = sqrt(I1/I2).
     * V(r) = 2r / (1 + r^2)
     * Returns array of {r, V} for plotting.
     */
    function visibilityVsRatio(numPoints = 200) {
        const data = [];
        for (let i = 0; i <= numPoints; i++) {
            const r = (i / numPoints) * 10; // ratio from 0 to 10
            const V = (r < 1e-10) ? 0 : (2 * r) / (1 + r * r);
            data.push({ r, V });
        }
        return data;
    }

    /**
     * Bruton's wavelength (nm) to RGB conversion.
     * Returns [r, g, b] each in 0-255.
     */
    function wavelengthToRGB(nm) {
        let r = 0, g = 0, b = 0;
        let factor;

        if (nm >= 380 && nm < 440) {
            r = -(nm - 440) / (440 - 380);
            g = 0;
            b = 1;
        } else if (nm >= 440 && nm < 490) {
            r = 0;
            g = (nm - 440) / (490 - 440);
            b = 1;
        } else if (nm >= 490 && nm < 510) {
            r = 0;
            g = 1;
            b = -(nm - 510) / (510 - 490);
        } else if (nm >= 510 && nm < 580) {
            r = (nm - 510) / (580 - 510);
            g = 1;
            b = 0;
        } else if (nm >= 580 && nm < 645) {
            r = 1;
            g = -(nm - 645) / (645 - 580);
            b = 0;
        } else if (nm >= 645 && nm <= 780) {
            r = 1;
            g = 0;
            b = 0;
        }

        // Intensity attenuation at edges of visible spectrum
        if (nm >= 380 && nm < 420) {
            factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
        } else if (nm >= 420 && nm <= 700) {
            factor = 1.0;
        } else if (nm > 700 && nm <= 780) {
            factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);
        } else {
            factor = 0;
        }

        // Apply gamma correction
        const gamma = 0.8;
        return [
            Math.round(255 * Math.pow(r * factor, gamma)),
            Math.round(255 * Math.pow(g * factor, gamma)),
            Math.round(255 * Math.pow(b * factor, gamma))
        ];
    }

    /**
     * Unknown wavelength estimator.
     * Given measured fringe spacing d (mm), slit separation a (mm), screen distance L (cm):
     * λ = d * a / L  (result in nm)
     */
    function estimateWavelength(fringeSpacingMm, slitSepMm, screenDistCm) {
        const screenDistMm = screenDistCm * 10;
        const wavelengthMm = (fringeSpacingMm * slitSepMm) / screenDistMm;
        return wavelengthMm * 1e6; // mm to nm
    }

    /**
     * Coherence length: Lc = λ² / Δλ
     * λ in nm, Δλ in nm → Lc in mm
     */
    function coherenceLength(wavelengthNm, linewidthNm) {
        if (linewidthNm < 1e-10) return Infinity;
        return (wavelengthNm * wavelengthNm) / (linewidthNm * 1e6); // result in mm
    }

    /**
     * Visibility limited by coherence.
     * V_coherence = exp(-π * (OPD / Lc)²) — simplified Gaussian model
     * For display purposes only.
     */
    function coherenceLimitedVisibility(opdMm, coherenceLengthMm) {
        if (coherenceLengthMm === Infinity) return 1;
        if (coherenceLengthMm < 1e-10) return 0;
        const ratio = opdMm / coherenceLengthMm;
        return Math.exp(-Math.PI * ratio * ratio);
    }

    return {
        intensityAt,
        computeIntensityProfile,
        visibility,
        iMax,
        iMin,
        intensityRatio,
        fringeSpacingMm,
        fringeCount,
        visibilityVsRatio,
        wavelengthToRGB,
        estimateWavelength,
        coherenceLength,
        coherenceLimitedVisibility
    };
})();
