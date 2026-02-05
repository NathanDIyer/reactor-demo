/**
 * Reactor physics step function
 * Shared by the simulator and the test suite
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ReactorPhysics = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    function stepPhysics(state, physics, deltaTime, options) {
        const opts = options || {};
        const rand = typeof opts.random === 'function' ? opts.random : Math.random;

        if (state.isScram) {
            // Decay heat and cooldown physics
            state.neutronFlux = Math.max(0.1, state.neutronFlux * 0.95);
            state.power = Math.max(1, state.power * 0.98);
            state.coreTemp = Math.max(150, state.coreTemp - 0.5);
            state.thermalPower = Math.max(50, state.power * 28.5);

            // Secondary system coasting down during scram
            state.steamFlow = Math.max(0, state.steamFlow * 0.95);
            state.turbinePower = Math.max(0, state.turbinePower * 0.96);
            state.condenserVac = Math.min(-50, state.condenserVac + 0.5);
        } else {
            // Normal operation physics

            // Calculate reactivity from rod position
            const rodReactivity = (state.rodPosition / 228) * physics.rodWorth;

            // Temperature feedback (negative coefficient)
            const tempFeedback = (state.coreTemp - 300) * physics.tempCoeff;

            // Net reactivity
            const netReactivity = rodReactivity + tempFeedback;

            // Power change based on reactivity
            const powerChange = netReactivity * state.power * physics.responseTime;
            state.power = Math.max(0, Math.min(120, state.power + powerChange));

            // Neutron flux follows power
            state.neutronFlux = state.power * 0.98 + rand() * 0.4 - 0.2;

            // Core temperature based on power
            const targetTemp = 280 + (state.power * 0.5);
            state.coreTemp += (targetTemp - state.coreTemp) * 0.1;

            // Thermal power
            state.thermalPower = state.power * 28.5;

            // Pressurizer adjustments
            const targetPressure = 15.0 + (state.coreTemp - 300) * 0.02;
            state.rcsPressure += (targetPressure - state.rcsPressure) * 0.05;
            state.przrPressure = state.rcsPressure;

            // Steam generator parameters
            state.sgPressure = 6.0 + (state.power / 100) * 1.5 + rand() * 0.1;
            state.sgTemp = 270 + (state.power / 100) * 20;
            state.sgFlow = 4000 + (state.power / 100) * 1000 + rand() * 50;

            // Secondary system
            state.steamFlow = 1400 + (state.power / 100) * 300;
            state.turbinePower = state.thermalPower * 0.33;
            state.condenserVac = -90 - (state.power / 100) * 8 + rand() * 2;

            // Pressurizer level
            state.przrLevel = 50 + (state.coreTemp - 300) * 0.5;
        }

        // Add small fluctuations for realism
        state.sgPressure += (rand() - 0.5) * 0.02;
        state.coreTemp += (rand() - 0.5) * 0.3;

        return state;
    }

    return {
        stepPhysics: stepPhysics
    };
});
