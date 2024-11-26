// sketch.js

let basicShader;
let basicShader2;
let shaderTexture, shaderTexture2;
let alp1 = 255,
    alp2 = 255;
let maxAlp = 80,
    minAlp = 30;

let fmSynth, filter, filter2, lfo, lfoResonance; // Tone.js components
let fmSynthPlaying = false;
let noiseSynth;
let autoFilter;

let textGraphics;

let state = "main"; // Variable to manage states: "main" or "overlay"

let overlayParticlesGraphics; // New p5.Graphics for overlay particles
let particles = []; // Array to hold particles

function preload() {
    basicShader = loadShader('shader.vert', 'shader.frag');
    basicShader2 = loadShader('shader.vert', 'shader2.frag');
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
    canvas.parent('p5-container'); // Attach canvas to the container
    let seed = random() * 999999;
    randomSeed(seed);
    noiseSeed(seed);

    shaderTexture = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture.noStroke();
    shaderTexture.pixelDensity(1);

    shaderTexture2 = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture2.noStroke();
    shaderTexture2.pixelDensity(1);

    textGraphics = createGraphics(windowWidth, windowHeight);
    textGraphics.pixelDensity(1);

    // Initialize the overlay particles graphics buffer
    overlayParticlesGraphics = createGraphics(windowWidth, windowHeight);
    overlayParticlesGraphics.pixelDensity(1);
    overlayParticlesGraphics.clear(); // Ensure it's transparent

    // Position the overlay particles canvas over the HTML overlay
    let overlayCanvas = overlayParticlesGraphics.canvas;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.zIndex = '11'; // Above the overlay but below the back button
    overlayCanvas.style.pointerEvents = 'none'; // Allow clicks to pass through
    document.body.appendChild(overlayCanvas);

    pixelDensity(1);
    noCursor();

    setupToneJS(); // Tone.js setup

    // Event listener for the back button
    document.getElementById('back-button').addEventListener('click', () => {
        state = "main";
        document.getElementById('overlay').style.display = 'none';

        // Hide the overlay particles canvas
        overlayParticlesGraphics.canvas.style.display = 'none';

        // Resume animation and sound
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }

        if (!fmSynthPlaying) {
            let note = "D2";
            fmSynth.triggerAttack(note);
            fmSynthPlaying = true;
        }

        if (!noiseSynth.started) {
            noiseSynth.start(); // Start the noise synth
        }
    });
}

function draw() {
    background(0); // Clear the canvas

    if (state === "main") {
        // Main state: animation and sound are active

        basicShader.setUniform('u_pixelDensity', pixelDensity());
        basicShader.setUniform("uTexture0", shaderTexture);
        basicShader.setUniform('u_resolution', [width, height]);
        basicShader.setUniform('u_time', millis() / 1000.0);
        basicShader.setUniform('u_speed', 1.0);
        basicShader.setUniform('u_windSpeed', 1.0);
        basicShader.setUniform('u_mouse', [mouseX, height - mouseY]);
        basicShader.setUniform('u_middle', [width, height]);

        basicShader2.setUniform('u_pixelDensity', pixelDensity());
        basicShader2.setUniform("uTexture0", shaderTexture);
        basicShader2.setUniform('u_resolution', [width, height]);
        basicShader2.setUniform('u_time', millis() / 1000.0);
        basicShader2.setUniform('u_speed', 1.0);
        basicShader2.setUniform('u_windSpeed', 1.0);
        basicShader2.setUniform('u_mouse', [mouseX, height - mouseY]);
        basicShader2.setUniform('u_middle', [width, height]);

        shaderTexture.shader(basicShader);
        shaderTexture.rect(0, 0, width, height);

        shaderTexture2.shader(basicShader2);
        shaderTexture2.rect(0, 0, width, height);

        translate(-width / 2, -height / 2);

        // Adjust mouse coordinates for WEBGL mode
        let mx = mouseX - width / 2;
        let my = mouseY - height / 2;
        let d = dist(mx, my, 0, 0);

        if (d > maxAlp) {
            alp1 = 255;
            alp2 = 0;
        } else if (d < maxAlp && d > minAlp) {
            alp1 = map(d, maxAlp, minAlp, 255, 0);
            alp2 = map(d, maxAlp, minAlp, 0, 255);
        } else {
            alp1 = 0;
            alp2 = 255;
        }

        tint(255, alp1);
        image(shaderTexture, 0, 0);

        tint(255, alp2);
        image(shaderTexture2, 0, 0);

        let textOpacity;
        if (d <= 50) {
            textOpacity = map(d, 50, 0, 0, 255);
        } else {
            textOpacity = 0;
        }

        // Clear the text graphics buffer
        textGraphics.clear();

        // Set text properties on the textGraphics buffer
        textGraphics.fill(255, textOpacity);
        textGraphics.textFont('monospace');
        textGraphics.textAlign(CENTER, CENTER);
        textGraphics.textSize(15); // Adjust size as needed

        // Draw the text at the center of the textGraphics buffer
        textGraphics.text('Enter', textGraphics.width / 2, textGraphics.height / 2);

        image(textGraphics, 0, 0);

        // Hide the overlay particles canvas
        overlayParticlesGraphics.canvas.style.display = 'none';

        updateLFOResonance(); // Update lfoResonance frequency with mouseX
    } else if (state === "overlay") {
        // Show the overlay particles canvas
        overlayParticlesGraphics.canvas.style.display = 'block';

        // Update and draw particles and blurred circle
        updateOverlayGraphics();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight, WEBGL);
    shaderTexture.resizeCanvas(windowWidth, windowHeight, WEBGL);
    shaderTexture2.resizeCanvas(windowWidth, windowHeight, WEBGL);
    textGraphics.resizeCanvas(windowWidth, windowHeight);
    overlayParticlesGraphics.resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
    if (key == 's') {
        saveCanvas('LucidDream_DistCollective', 'png');
    }
}

// --- Overlay Graphics Functions ---

function updateOverlayGraphics() {
    // Clear the overlay particles graphics buffer
    overlayParticlesGraphics.clear();

    // Draw the blurred circle at the center
    drawBlurredCircle();

    // Update and draw particles
    updateParticles();
}

function drawBlurredCircle() {
    let pg = overlayParticlesGraphics;
    let centerX = windowWidth / 2;
    let centerY = windowHeight / 2;
    let maxRadius = 30; // Adjust as needed
    let maxI = 20; // Number of circles to draw

    for (let i = 0; i <= maxI; i++) {
        let radius = map(i, 0, maxI, maxRadius, 0);
        let alpha = map(i, 0, maxI, 0, 255);
        pg.noStroke();
        pg.fill(255, alpha);
        pg.ellipse(centerX, centerY, radius * 2, radius * 2);
    }
}

// --- Particle System Functions ---

class Particle {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        this.speed = random(1, 3);
        this.vel.mult(this.speed);
        this.acc = createVector(0, 0);
        this.lifespan = 255;
    }

    update() {
        // Apply flow field effect using Perlin noise
        let angle = noise(this.pos.x * 0.008, this.pos.y * 0.008) * TWO_PI * 4;
        let flow = p5.Vector.fromAngle(angle);
        flow.mult(0.05);
        this.acc.add(flow);

        // Attractor/Repulsor interaction with mouse
        let mouse = createVector(mouseX, mouseY);
        let dir = p5.Vector.sub(mouse, this.pos);
        let distance = dir.mag();
        dir.normalize();

        let maxDistance = 30;
        let force = 2;
        let forceMagnitude = map(distance, 0, maxDistance, force, 0);
        forceMagnitude = constrain(forceMagnitude, 0, force);

        // Set to negative for repulsion, positive for attraction
        let attractorStrength = -1; // Negative for repulsion, positive for attraction

        dir.mult(forceMagnitude * attractorStrength);
        this.acc.add(dir);

        this.vel.add(this.acc);
        this.pos.add(this.vel);
        this.acc.mult(0);

        this.lifespan -= 2;
    }

    display(pg) {
        pg.noStroke();
        pg.fill(255, this.lifespan);
        pg.ellipse(this.pos.x, this.pos.y, 4);
    }

    isDead() {
        return this.lifespan <= 0;
    }
}

function updateParticles() {
    // Add new particles
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(windowWidth / 2, windowHeight / 2));
    }

    // Update and display particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.display(overlayParticlesGraphics);

        // Remove dead particles
        if (p.isDead() || p.pos.x < 0 || p.pos.x > windowWidth || p.pos.y < 0 || p.pos.y > windowHeight) {
            particles.splice(i, 1);
        }
    }
}

// --- Tone.js Functions ---
function setupToneJS() {
    // FM Synthesizer
    fmSynth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 20,
        oscillator: {
            type: "sine",
        },
        modulation: {
            type: "sawtooth",
        },
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.6,
            release: 0.8,
        },
        modulationEnvelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.5,
        },
    });

    const distortion = new Tone.Distortion(2.8);

    // Filters with randomized cutoff
    filter = new Tone.Filter({
        type: "lowpass",
        frequency: 400, // Initial frequency
        rolloff: -24,
        Q: 10,
    });

    filter2 = new Tone.Filter({
        type: "lowpass",
        frequency: 1000, // Initial frequency
        rolloff: -24,
        Q: 5,
    });

    const cheby = new Tone.Chebyshev(101);

    const crusher = new Tone.BitCrusher(2);
    // Connect fmSynth through filter to destination
    fmSynth.connect(distortion);
    distortion.connect(crusher);

    crusher.connect(cheby);
    cheby.connect(filter);
    filter.toDestination();

    // LFO to modulate the filter's frequency
    lfo = new Tone.LFO({
        frequency: "0.1n",
        min: 100,
        max: 1000,
    }).start();

    lfo.connect(filter.frequency);

    // LFO to modulate filter's resonance (Q factor)
    lfoResonance = new Tone.LFO({
        frequency: "1n",
        min: 0.5,
        max: 8,
    }).start();

    lfoResonance.connect(filter.Q);

    // Create the noise synth
    noiseSynth = new Tone.Noise("white"); // Create white noise synth
    noiseSynth.volume.value = -12; // Set volume of the noise synth

    fmSynth.volume.value = -12;

    // Create AutoFilter effect
    autoFilter = new Tone.AutoFilter({
        frequency: "4n",
        baseFrequency: 200,
        resonance: 0,
        octaves: 2,
    });

    // Connect the noise synth through autoFilter and filter2 to destination
    autoFilter.toDestination();
    noiseSynth.connect(autoFilter);
    autoFilter.start();
    autoFilter.connect(filter2);
    filter2.toDestination();

    // Start Tone.js transport
    Tone.Transport.start();
}

function mousePressed() {
    if (state === "main") {
        // Adjust mouse coordinates for WEBGL mode
        let mx = mouseX - width / 2;
        let my = mouseY - height / 2;
        let d = dist(mx, my, 0, 0);

        if (d <= 50) {
            // Clicked on the "Enter" text area
            state = "overlay";
            document.getElementById('overlay').style.display = 'block';

            // Initialize the particle system
            particles = [];

            // Stop the animation and sound
            if (Tone.Transport.state === 'started') {
                Tone.Transport.stop();
            }

            if (fmSynthPlaying) {
                fmSynth.triggerRelease();
                fmSynthPlaying = false;
            }

            if (noiseSynth && noiseSynth.state === "started") {
                noiseSynth.stop();
            }

            // Show the overlay particles canvas
            overlayParticlesGraphics.canvas.style.display = 'block';
        } else {
            // Start the fmSynth note indefinitely after first click
            if (!fmSynthPlaying) {
                let note = "D2";
                fmSynth.triggerAttack(note);
                fmSynthPlaying = true;
            }

            // Start the noiseSynth
            if (noiseSynth && noiseSynth.state !== "started") {
                noiseSynth.start(); // Start the noise synth
            }
        }
    }
}



function updateLFOResonance() {
    // Adjust mouse coordinates for WEBGL mode
    let mx = mouseX - width / 2;
    let my = mouseY - height / 2;
    let d = dist(mx, my, 0, 0);
    let maxDist = max(width, height);

    let minFre = 2000;
    let maxFre = 4000;

    // Map distance to LFO frequencies
    let lfoFrequency = map(d, 0, maxDist, random(30, 50), 0.01);
    let filterFreq = map(d, 0, maxDist, maxFre, minFre);
    let lfoFrequency2 = map(d, maxDist, 0, 0.01, 20);

    // Update the LFO frequencies
    lfoResonance.frequency.value = lfoFrequency;
    autoFilter.frequency.value = lfoFrequency2;
    filter2.frequency.value = filterFreq;

    filter2.Q.value = map(mouseX, 0, width, 10, 0);
    fmSynth.harmonicity.value = map(mouseX, 0, width, 3, 3.1);
    fmSynth.modulationIndex.value = map(mouseY, 0, height, 40, 0);

    let nMax = 5;

    let modulatedVolSynth;
    let modulatedVolNoise;

    modulatedVolSynth = constrain(map(sin(millis() / (d / 100)), -1, 1, -10, -5), -50, 0);

    modulatedVolNoise = map(noise(mx / 1, my / 1), 0, 1, random(-40, -10), nMax);

    fmSynth.volume.value = modulatedVolSynth;

    noiseSynth.volume.value = modulatedVolNoise;

    // Adjust LFO min and max values based on distance
    if (d < 50) {
        lfo.min = map(d, 0, 60, 60, 30);
        lfo.max = 60;
        filter2.frequency.value = map(d, 0, 50, 100, 0);
        noiseSynth.volume.value = map(d, 0, 50, -5, -100);
    } else {
        lfo.min = 120;
        lfo.max = map(d, 50, maxDist, 200, 2000);
    }
}
