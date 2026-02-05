/**
 * PWR Nuclear Reactor Simulator
 * Educational simulation for high school students
 */

class ReactorSimulator {
    constructor() {
        // Reactor state
        this.state = {
            power: 100,           // Reactor power level (%)
            rodPosition: 225,     // Control rod position (0-228 steps)
            coreTemp: 315,        // Core temperature (°C)
            rcsPressure: 15.5,    // Primary coolant pressure (MPa)
            neutronFlux: 98.2,    // Neutron flux (%)

            // Steam Generator
            sgPressure: 6.89,     // SG pressure (MPa)
            sgTemp: 285,          // SG temperature (°C)
            sgFlow: 4732,         // Primary flow rate (kg/s)

            // Pressurizer
            przrLevel: 55,        // Pressurizer level (%)
            przrPressure: 15.5,   // Pressurizer pressure (MPa)

            // Secondary
            steamFlow: 1580,      // Steam flow (kg/s)
            turbinePower: 950,    // Electrical output (MWe)
            thermalPower: 2850,   // Thermal output (MWt)
            condenserVac: -95,    // Condenser vacuum (kPa)

            // Status
            isOnline: true,
            isScram: false,
            rodMode: 'AUTO'
        };

        // Physics constants
        this.physics = {
            rodWorth: 0.015,          // Reactivity per step
            tempCoeff: -0.0002,       // Temp coefficient (negative)
            heatTransfer: 0.95,       // Heat transfer efficiency
            responseTime: 0.1         // System response time factor
        };

        // Simulation timing
        this.simTime = 0;
        this.lastUpdate = Date.now();

        // Data history for charts
        this.history = {
            timestamps: [],
            power: [],
            coreTemp: [],
            rodPosition: [],
            neutronFlux: [],
            rcsPressure: [],
            sgPressure: [],
            maxPoints: 60
        };

        // Charts
        this.charts = {};

        // Initialize
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initCharts();
        this.startSimulation();
        this.createSteamBubbles();
    }

    cacheElements() {
        // Readout displays
        this.displays = {
            // Core
            neutronFlux: document.getElementById('neutronFlux'),
            coreTemp: document.getElementById('coreTemp'),
            rodPosition: document.getElementById('rodPosition'),
            rcsPressure: document.getElementById('rcsPressure'),

            // Steam Generator
            sgPressure: document.getElementById('sgPressure'),
            sgTemp: document.getElementById('sgTemp'),
            sgFlow: document.getElementById('sgFlow'),

            // Pressurizer
            przrLevel: document.getElementById('przrLevel'),
            przrPressure: document.getElementById('przrPressure'),

            // Secondary
            steamFlow: document.getElementById('steamFlow'),
            turbinePower: document.getElementById('turbinePower'),
            thermalPower: document.getElementById('thermalPower'),
            condenserVac: document.getElementById('condenserVac'),

            // Header
            simClock: document.getElementById('simClock'),
            masterStatus: document.getElementById('masterStatus')
        };

        // Controls
        this.controls = {
            rodSlider: document.getElementById('rodSlider'),
            rodSliderValue: document.getElementById('rodSliderValue'),
            rodInsert: document.getElementById('rodInsert'),
            rodWithdraw: document.getElementById('rodWithdraw'),
            rodStatus: document.getElementById('rodStatus'),
            scramBtn: document.getElementById('scramBtn')
        };

        // SVG elements
        this.svg = {
            controlRods: document.getElementById('controlRods'),
            pumpImpeller: document.getElementById('pumpImpeller'),
            steamBubbles: document.getElementById('steamBubbles'),
            coreGlow: document.querySelector('.core-glow'),
            turbineRotor: document.getElementById('turbineRotor')
        };
    }

    bindEvents() {
        // Rod slider
        this.controls.rodSlider.addEventListener('input', (e) => {
            this.setRodPosition(parseInt(e.target.value));
            this.state.rodMode = 'MANUAL';
            this.controls.rodStatus.textContent = 'MANUAL';
            this.controls.rodStatus.classList.add('manual');
        });

        // Rod buttons
        this.controls.rodInsert.addEventListener('mousedown', () => {
            this.rodMoveInterval = setInterval(() => this.moveRods(-1), 50);
        });

        this.controls.rodWithdraw.addEventListener('mousedown', () => {
            this.rodMoveInterval = setInterval(() => this.moveRods(1), 50);
        });

        ['mouseup', 'mouseleave'].forEach(event => {
            this.controls.rodInsert.addEventListener(event, () => {
                clearInterval(this.rodMoveInterval);
            });
            this.controls.rodWithdraw.addEventListener(event, () => {
                clearInterval(this.rodMoveInterval);
            });
        });

        // SCRAM button
        this.controls.scramBtn.addEventListener('click', () => {
            this.triggerScram();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                this.moveRods(5);
            } else if (e.key === 'ArrowDown') {
                this.moveRods(-5);
            } else if (e.key === 's' || e.key === 'S') {
                this.triggerScram();
            }
        });
    }

    moveRods(steps) {
        const newPosition = Math.max(0, Math.min(228, this.state.rodPosition + steps));
        this.setRodPosition(newPosition);
        this.state.rodMode = 'MANUAL';
        this.controls.rodStatus.textContent = 'MANUAL';
        this.controls.rodStatus.classList.add('manual');
    }

    setRodPosition(position) {
        this.state.rodPosition = position;
        this.controls.rodSlider.value = position;
        this.controls.rodSliderValue.textContent = position;
        this.updateControlRodGraphics();
    }

    updateControlRodGraphics() {
        const rods = this.svg.controlRods.querySelectorAll('.control-rod');

        // Rod position: 228 = fully withdrawn (out of core), 0 = fully inserted (in core)
        // When withdrawn: rods are short, sitting above the core
        // When inserted: rods extend down into the fuel zone

        const minHeight = 40;   // Height when fully withdrawn (rods above core)
        const maxHeight = 300;  // Height when fully inserted (rods deep in core)

        // Calculate insertion fraction: 0 = withdrawn, 1 = fully inserted
        const insertionFraction = (228 - this.state.rodPosition) / 228;
        const rodHeight = minHeight + insertionFraction * (maxHeight - minHeight);

        rods.forEach((rod, index) => {
            // Slight variation in rod positions for realism
            const variation = (index - 2) * 3;
            // Keep top of rod fixed, extend downward into core
            rod.setAttribute('y', 80 + variation);
            rod.setAttribute('height', rodHeight);
        });
    }

    triggerScram() {
        if (this.state.isScram) return;

        this.state.isScram = true;
        this.state.isOnline = false;
        this.state.rodMode = 'SCRAM';

        // Visual feedback
        this.displays.masterStatus.classList.add('alert');
        this.displays.masterStatus.querySelector('.status-text').textContent = 'REACTOR TRIP';
        this.displays.masterStatus.querySelector('.status-indicator').classList.add('offline');

        this.controls.rodStatus.textContent = 'SCRAM';
        this.controls.rodStatus.classList.remove('manual');
        this.controls.rodStatus.style.color = '#ff4444';
        this.controls.rodStatus.style.borderColor = '#ff4444';
        this.controls.rodStatus.style.background = 'rgba(255, 68, 68, 0.1)';

        // Rapid rod insertion animation
        const scramAnimation = () => {
            if (this.state.rodPosition > 0) {
                this.setRodPosition(Math.max(0, this.state.rodPosition - 10));
                requestAnimationFrame(scramAnimation);
            }
        };
        scramAnimation();

        // Flash SCRAM button
        this.controls.scramBtn.style.animation = 'none';
        this.controls.scramBtn.offsetHeight; // Trigger reflow
        this.controls.scramBtn.style.animation = 'scramFlash 0.5s ease infinite';

        // Update status bar
        document.querySelectorAll('.status-value').forEach(el => {
            if (!el.classList.contains('ok')) return;
            el.classList.remove('ok');
            el.classList.add('alert');
            el.textContent = 'TRIP';
        });
    }

    resetFromScram() {
        this.state.isScram = false;
        this.state.isOnline = true;
        this.state.rodMode = 'AUTO';

        this.displays.masterStatus.classList.remove('alert');
        this.displays.masterStatus.querySelector('.status-text').textContent = 'REACTOR ONLINE';
        this.displays.masterStatus.querySelector('.status-indicator').classList.remove('offline');

        this.controls.rodStatus.textContent = 'AUTO';
        this.controls.rodStatus.classList.remove('manual');
        this.controls.rodStatus.style.color = '';
        this.controls.rodStatus.style.borderColor = '';
        this.controls.rodStatus.style.background = '';

        this.controls.scramBtn.style.animation = '';

        document.querySelectorAll('.status-value').forEach(el => {
            el.classList.remove('alert');
            el.classList.add('ok');
        });
    }

    calculatePhysics(deltaTime) {
        const physicsApi = typeof window !== 'undefined' ? window.ReactorPhysics : null;
        if (!physicsApi || typeof physicsApi.stepPhysics !== 'function') {
            return;
        }

        physicsApi.stepPhysics(this.state, this.physics, deltaTime);

        // Turbine rotation speed based on power/scram state
        if (this.svg.turbineRotor) {
            if (this.state.isScram) {
                if (this.state.turbinePower < 50) {
                    this.svg.turbineRotor.style.animationPlayState = 'paused';
                } else {
                    this.svg.turbineRotor.style.animationDuration = '3s';
                }
            } else {
                this.svg.turbineRotor.style.animationPlayState = 'running';
                this.svg.turbineRotor.style.animationDuration = `${0.5 + (1 - this.state.power / 100) * 1.5}s`;
            }
        }
    }

    updateDisplays() {
        // Core parameters
        this.displays.neutronFlux.textContent = this.state.neutronFlux.toFixed(1);
        this.displays.coreTemp.textContent = Math.round(this.state.coreTemp);
        this.displays.rodPosition.textContent = this.state.rodPosition;
        this.displays.rcsPressure.textContent = this.state.rcsPressure.toFixed(1);

        // Steam generator
        this.displays.sgPressure.textContent = this.state.sgPressure.toFixed(2);
        this.displays.sgTemp.textContent = Math.round(this.state.sgTemp);
        this.displays.sgFlow.textContent = Math.round(this.state.sgFlow).toLocaleString();

        // Pressurizer
        this.displays.przrLevel.textContent = Math.round(this.state.przrLevel);
        this.displays.przrPressure.textContent = this.state.przrPressure.toFixed(1);

        // Secondary
        this.displays.steamFlow.textContent = Math.round(this.state.steamFlow).toLocaleString();
        this.displays.turbinePower.textContent = Math.round(this.state.turbinePower);
        if (this.displays.condenserVac) {
            this.displays.condenserVac.textContent = Math.round(this.state.condenserVac);
        }
        this.displays.thermalPower.textContent = Math.round(this.state.thermalPower);

        // Update clock
        const hours = Math.floor(this.simTime / 3600);
        const minutes = Math.floor((this.simTime % 3600) / 60);
        const seconds = Math.floor(this.simTime % 60);
        this.displays.simClock.textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update visual effects based on power
        this.updateVisualEffects();
    }

    updateVisualEffects() {
        // Minimal visual updates to prevent jitter
        // Animation speeds are now fixed in CSS - no dynamic changes
    }

    initCharts() {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded - graphs disabled');
            return;
        }

        // Common chart options for control room aesthetic
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#8aa4b4',
                        font: { family: 'IBM Plex Mono', size: 9 },
                        boxWidth: 12,
                        padding: 6
                    }
                }
            },
            scales: {
                x: {
                    display: false
                }
            }
        };

        const gridColor = '#1a3a4a';
        const tickColor = '#5a7a8a';

        // Chart 1: Power & Temperature (dual Y-axis)
        const ctxPowerTemp = document.getElementById('chartPowerTemp');
        if (ctxPowerTemp) {
            this.charts.powerTemp = new Chart(ctxPowerTemp, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Power %',
                            data: [],
                            borderColor: '#ff8c42',
                            backgroundColor: 'rgba(255, 140, 66, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Temp °C',
                            data: [],
                            borderColor: '#ff4444',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { display: false },
                        y: {
                            type: 'linear',
                            position: 'left',
                            min: 0,
                            max: 120,
                            grid: { color: gridColor },
                            ticks: { color: '#ff8c42', font: { size: 9 } },
                            title: { display: false }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            min: 150,
                            max: 400,
                            grid: { display: false },
                            ticks: { color: '#ff4444', font: { size: 9 } },
                            title: { display: false }
                        }
                    }
                }
            });
        }

        // Chart 2: Rod Position & Neutron Flux
        const ctxRodFlux = document.getElementById('chartRodFlux');
        if (ctxRodFlux) {
            this.charts.rodFlux = new Chart(ctxRodFlux, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Rod Steps',
                            data: [],
                            borderColor: '#4dabf7',
                            backgroundColor: 'rgba(77, 171, 247, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.1,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Flux %',
                            data: [],
                            borderColor: '#ffd43b',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { display: false },
                        y: {
                            type: 'linear',
                            position: 'left',
                            min: 0,
                            max: 228,
                            grid: { color: gridColor },
                            ticks: { color: '#4dabf7', font: { size: 9 } },
                            title: { display: false }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            max: 120,
                            grid: { display: false },
                            ticks: { color: '#ffd43b', font: { size: 9 } },
                            title: { display: false }
                        }
                    }
                }
            });
        }

        // Chart 3: System Pressures
        const ctxPressures = document.getElementById('chartPressures');
        if (ctxPressures) {
            this.charts.pressures = new Chart(ctxPressures, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'RCS MPa',
                            data: [],
                            borderColor: '#00ff88',
                            backgroundColor: 'rgba(0, 255, 136, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'SG MPa',
                            data: [],
                            borderColor: '#74c0fc',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { display: false },
                        y: {
                            min: 0,
                            max: 20,
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 9 } }
                        }
                    }
                }
            });
        }

        // Chart 4: Power vs Temperature (scatter - feedback visualization)
        const ctxFeedback = document.getElementById('chartFeedback');
        if (ctxFeedback) {
            this.charts.feedback = new Chart(ctxFeedback, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Operating Point',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.3)',
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    ...commonOptions,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            display: true,
                            min: 150,
                            max: 400,
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 8 } },
                            title: {
                                display: true,
                                text: 'Temp °C',
                                color: tickColor,
                                font: { size: 9 }
                            }
                        },
                        y: {
                            min: 0,
                            max: 120,
                            grid: { color: gridColor },
                            ticks: { color: tickColor, font: { size: 8 } },
                            title: {
                                display: true,
                                text: 'Power %',
                                color: tickColor,
                                font: { size: 9 }
                            }
                        }
                    }
                }
            });
        }

        // Bind toggle button
        const toggleBtn = document.getElementById('graphsToggle');
        const panel = document.getElementById('graphsPanel');
        const schematicArea = document.querySelector('.schematic-area');

        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                panel.classList.toggle('collapsed');
                if (schematicArea) {
                    schematicArea.classList.toggle('graphs-collapsed');
                }
            });
        }
    }

    updateHistory() {
        const h = this.history;

        // Add current values
        h.timestamps.push(this.simTime);
        h.power.push(this.state.power);
        h.coreTemp.push(this.state.coreTemp);
        h.rodPosition.push(this.state.rodPosition);
        h.neutronFlux.push(this.state.neutronFlux);
        h.rcsPressure.push(this.state.rcsPressure);
        h.sgPressure.push(this.state.sgPressure);

        // Trim to max points
        if (h.timestamps.length > h.maxPoints) {
            h.timestamps.shift();
            h.power.shift();
            h.coreTemp.shift();
            h.rodPosition.shift();
            h.neutronFlux.shift();
            h.rcsPressure.shift();
            h.sgPressure.shift();
        }
    }

    updateCharts() {
        if (!this.charts.powerTemp) return;

        const h = this.history;
        const labels = h.timestamps.map(() => '');

        // Chart 1: Power & Temperature
        if (this.charts.powerTemp) {
            this.charts.powerTemp.data.labels = labels;
            this.charts.powerTemp.data.datasets[0].data = h.power;
            this.charts.powerTemp.data.datasets[1].data = h.coreTemp;
            this.charts.powerTemp.update('none');
        }

        // Chart 2: Rod Position & Flux
        if (this.charts.rodFlux) {
            this.charts.rodFlux.data.labels = labels;
            this.charts.rodFlux.data.datasets[0].data = h.rodPosition;
            this.charts.rodFlux.data.datasets[1].data = h.neutronFlux;
            this.charts.rodFlux.update('none');
        }

        // Chart 3: System Pressures
        if (this.charts.pressures) {
            this.charts.pressures.data.labels = labels;
            this.charts.pressures.data.datasets[0].data = h.rcsPressure;
            this.charts.pressures.data.datasets[1].data = h.sgPressure;
            this.charts.pressures.update('none');
        }

        // Chart 4: Power vs Temperature scatter
        if (this.charts.feedback) {
            // Create scatter points from recent history
            const scatterData = [];
            for (let i = 0; i < h.power.length; i++) {
                scatterData.push({
                    x: h.coreTemp[i],
                    y: h.power[i]
                });
            }
            this.charts.feedback.data.datasets[0].data = scatterData;
            this.charts.feedback.update('none');
        }
    }

    createSteamBubbles() {
        // Create animated steam bubbles in the steam generator
        // The steamBubbles group is inside the steam-generator group (translate 460,80)
        // So coordinates here are RELATIVE to the steam generator
        // Secondary water: x=30-110, y=280-440 (relative to SG)
        // Bubbles should rise from bottom of water up through tube bundle into steam space

        const bubbleContainer = this.svg.steamBubbles;
        if (!bubbleContainer) return;

        const createBubble = () => {
            // Don't create bubbles if reactor is scrammed or power is too low
            if (this.state.isScram || this.state.power < 10) return;

            const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

            // X position: within the tube bundle (30-110 relative to SG)
            const x = 40 + Math.random() * 60;

            // Y position: start at bottom of secondary water (around 400-430)
            const y = 400 + Math.random() * 30;

            // Bubble size varies
            const r = 2 + Math.random() * 4;

            // Rise distance based on power level (more power = more vigorous boiling)
            const riseDistance = 200 + (this.state.power / 100) * 100;
            const duration = 1.5 + Math.random() * 1.5;

            bubble.setAttribute('cx', x);
            bubble.setAttribute('cy', y);
            bubble.setAttribute('r', r);
            bubble.setAttribute('fill', '#e9ecef');
            bubble.setAttribute('opacity', '0.5');

            // Custom animation for each bubble
            bubble.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;

            bubbleContainer.appendChild(bubble);

            // Trigger animation after a brief delay
            requestAnimationFrame(() => {
                bubble.style.transform = `translateY(-${riseDistance}px) scale(0.3)`;
                bubble.style.opacity = '0';
            });

            // Remove bubble after animation completes
            setTimeout(() => {
                bubble.remove();
            }, duration * 1000 + 100);
        };

        // Create bubbles periodically - rate depends on power level
        this.bubbleInterval = setInterval(() => {
            // More bubbles at higher power
            const bubbleCount = Math.floor(this.state.power / 15);
            for (let i = 0; i < bubbleCount; i++) {
                setTimeout(createBubble, Math.random() * 400);
            }
        }, 300);
    }

    startSimulation() {
        // Separate physics (60fps) from DOM updates (10fps) to prevent jitter
        let lastDisplayUpdate = 0;
        const displayUpdateInterval = 100; // Update displays every 100ms (10fps)

        const gameLoop = (timestamp) => {
            const now = Date.now();
            const deltaTime = (now - this.lastUpdate) / 1000;
            this.lastUpdate = now;

            // Update simulation time (accelerated)
            this.simTime += deltaTime * 10;

            // Calculate physics every frame
            this.calculatePhysics(deltaTime);

            // Only update DOM displays at 10fps to prevent layout thrashing
            if (timestamp - lastDisplayUpdate >= displayUpdateInterval) {
                lastDisplayUpdate = timestamp;
                this.updateDisplays();
                this.updateHistory();
                this.updateCharts();
            }

            // Continue loop
            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }
}

// Add SCRAM flash animation
const style = document.createElement('style');
style.textContent = `
    @keyframes scramFlash {
        0%, 100% { background: linear-gradient(135deg, #cc0000 0%, #990000 100%); }
        50% { background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); box-shadow: 0 0 50px rgba(255, 0, 0, 0.8); }
    }
`;
document.head.appendChild(style);

// Initialize simulator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.reactor = new ReactorSimulator();

    // Add reset capability (double-click SCRAM after trip)
    let scramClickCount = 0;
    document.getElementById('scramBtn').addEventListener('click', () => {
        if (window.reactor.state.isScram) {
            scramClickCount++;
            if (scramClickCount >= 3) {
                window.reactor.resetFromScram();
                scramClickCount = 0;
            }
        }
    });
});
