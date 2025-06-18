class OrganicWaveRenderer {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

        // Default configuration optimized for Meridian brand with theme colors
        this.config = {
            // Visual parameters - Meridian theme colors
            baseColor: [0.31, 0.98, 0.62],      // Theme primary: #4ffa9f (mint green)
            secondaryColor: [1.0, 1.0, 0.94],   // Ivory: #fffff0
            timeScale: 0.06,                     // Slow, calming animation
            iterations: 8.0,                     // Balanced quality/performance
            waveAmplitude: 0.5,                  // Moderate wave intensity
            opacity: 0.7,                        // Subtle background presence
            posterizeLevels: 6.0,                // Clean color boundaries

            // Performance
            targetFPS: 60,
            pixelRatio: Math.min(window.devicePixelRatio, 2),

            // Brand-specific presets
            ...config
        };

        this.uniforms = {};
        this.program = null;
        this.animationId = null;
        this.startTime = Date.now();
        this.isInitialized = false;

        this.init();
    }

    async init() {
        if (!this.gl) {
            console.warn('WebGL not supported, falling back to CSS');
            this.fallbackToCSS();
            return;
        }

        try {
            await this.setupShaders();
            this.setupGeometry();
            this.setupUniforms();
            this.setupEventListeners();
            this.resize();
            this.isInitialized = true;
            this.start();
        } catch (error) {
            console.error('Failed to initialize OrganicWaveRenderer:', error);
            this.fallbackToCSS();
        }
    }

    async setupShaders() {
        const vertexShaderSource = `#version 300 es
            in vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        // Load fragment shader from file
        const fragmentShaderSource = await this.loadShaderFile('/shaders/organic-waves.glsl');

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (!this.program) {
            throw new Error('Failed to create shader program');
        }
    }

    async loadShaderFile(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load shader: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.warn('Failed to load external shader, using inline version');
            // Fallback to inline shader
            return `#version 300 es
                precision highp float;
                
                uniform float uTime;
                uniform vec2 uResolution;
                uniform vec3 uBaseColor;
                uniform vec3 uSecondaryColor;
                uniform float uTimeScale;
                uniform float uIterations;
                uniform float uWaveAmplitude;
                uniform float uOpacity;
                uniform float uPosterizeLevels;
                
                out vec4 fragColor;
                
                void main() {
                    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);
                    float scaledTime = uTime * uTimeScale;
                    
                    vec2 originalUv = uv;
                    
                    for(float i = 1.0; i < uIterations; i++) {
                        uv.x += uWaveAmplitude / i * cos(i * 3.5 * uv.y + scaledTime);
                        uv.y += uWaveAmplitude / i * cos(i * 3.5 * uv.x + scaledTime);
                    }
                    
                    float intensity = abs(sin(scaledTime - uv.x - uv.y));
                    float vignette = 1.0 - length(originalUv) * 1.15;
                    intensity *= vignette;
                    
                    // Remap intensity to favor theme color but include some ivory
                    intensity = 0.15 + intensity * 1.4;
                    
                    // Posterize the intensity for clean color boundaries
                    intensity = floor(intensity * uPosterizeLevels) / uPosterizeLevels;
                    
                    // Create darker theme color variation for more color richness
                    vec3 darkThemeColor = uBaseColor * 0.7;
                    
                    // Four-way color mixing for balanced theme colors and ivory
                    vec3 finalColor;
                    if (intensity < 0.33) {
                        // Dark theme to regular theme (lower third)
                        finalColor = mix(darkThemeColor, uBaseColor, intensity * 3.0);
                    } else if (intensity < 0.75) {
                        // Regular theme to light theme (middle section)
                        vec3 lightThemeColor = mix(uBaseColor, uSecondaryColor, 0.4);
                        finalColor = mix(uBaseColor, lightThemeColor, (intensity - 0.33) * 2.4);
                    } else {
                        // Light theme to ivory (upper section - limited ivory)
                        vec3 lightThemeColor = mix(uBaseColor, uSecondaryColor, 0.4);
                        finalColor = mix(lightThemeColor, uSecondaryColor, (intensity - 0.75) * 4.0);
                    }
                    
                    fragColor = vec4(finalColor, uOpacity);
                }
            `;
        }
    }

    setupGeometry() {
        // Full-screen quad
        const vertices = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]);

        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        const positionLocation = this.gl.getAttribLocation(this.program, 'position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    setupUniforms() {
        this.uniforms = {
            uTime: this.gl.getUniformLocation(this.program, 'uTime'),
            uResolution: this.gl.getUniformLocation(this.program, 'uResolution'),
            uBaseColor: this.gl.getUniformLocation(this.program, 'uBaseColor'),
            uSecondaryColor: this.gl.getUniformLocation(this.program, 'uSecondaryColor'),
            uTimeScale: this.gl.getUniformLocation(this.program, 'uTimeScale'),
            uIterations: this.gl.getUniformLocation(this.program, 'uIterations'),
            uWaveAmplitude: this.gl.getUniformLocation(this.program, 'uWaveAmplitude'),
            uOpacity: this.gl.getUniformLocation(this.program, 'uOpacity'),
            uPosterizeLevels: this.gl.getUniformLocation(this.program, 'uPosterizeLevels')
        };
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        // Handle reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.handleReducedMotion(mediaQuery);
        mediaQuery.addEventListener('change', (e) => this.handleReducedMotion(e));
    }

    handleReducedMotion(mediaQuery) {
        if (mediaQuery.matches) {
            this.config.timeScale = 0.02; // Much slower animation
            this.config.opacity = 0.4; // Reduce visual intensity
        } else {
            // Restore original values
            this.config.timeScale = 0.06;
            this.config.opacity = 0.7;
        }
    }

    render() {
        if (!this.isInitialized || !this.program) return;

        const currentTime = (Date.now() - this.startTime) / 1000;

        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        this.gl.useProgram(this.program);

        // Update uniforms
        this.gl.uniform1f(this.uniforms.uTime, currentTime);
        this.gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
        this.gl.uniform3f(this.uniforms.uBaseColor, ...this.config.baseColor);
        this.gl.uniform3f(this.uniforms.uSecondaryColor, ...this.config.secondaryColor);
        this.gl.uniform1f(this.uniforms.uTimeScale, this.config.timeScale);
        this.gl.uniform1f(this.uniforms.uIterations, this.config.iterations);
        this.gl.uniform1f(this.uniforms.uWaveAmplitude, this.config.waveAmplitude);
        this.gl.uniform1f(this.uniforms.uOpacity, this.config.opacity);
        this.gl.uniform1f(this.uniforms.uPosterizeLevels, this.config.posterizeLevels);

        // Clear and render
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.animationId = requestAnimationFrame(() => this.render());
    }

    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.config.pixelRatio;
        this.canvas.height = rect.height * this.config.pixelRatio;

        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    start() {
        if (!this.animationId) {
            this.render();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    fallbackToCSS() {
        this.canvas.style.background = `
            linear-gradient(45deg, 
                rgba(79, 250, 159, 0.4) 0%, 
                rgba(255, 255, 240, 0.8) 50%,
                rgba(79, 250, 159, 0.2) 100%)
        `;
        this.canvas.style.backgroundSize = '400% 400%';
        this.canvas.style.animation = 'gradientShift 12s ease-in-out infinite';

        // Add CSS animation if not already present
        if (!document.querySelector('#organic-wave-fallback-styles')) {
            const style = document.createElement('style');
            style.id = 'organic-wave-fallback-styles';
            style.textContent = `
                @keyframes gradientShift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Static method to check WebGL support
    static isSupported() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return !!gl;
    }

    // Brand-specific presets
    static presets = {
        meridianDefault: {
            baseColor: [0.31, 0.98, 0.62],      // Theme primary: #4ffa9f
            secondaryColor: [1.0, 1.0, 0.94],   // Ivory: #fffff0
            timeScale: 0.06,
            iterations: 8.0,
            waveAmplitude: 0.5,
            opacity: 0.7,
            posterizeLevels: 6.0
        },

        meridianSubtle: {
            baseColor: [0.31, 0.98, 0.62],      // Theme primary: #4ffa9f
            secondaryColor: [1.0, 1.0, 0.94],   // Ivory: #fffff0
            timeScale: 0.04,
            iterations: 6.0,
            waveAmplitude: 0.3,
            opacity: 0.5,
            posterizeLevels: 4.0
        },

        meridianEnergetic: {
            baseColor: [0.31, 0.98, 0.62],      // Theme primary: #4ffa9f
            secondaryColor: [1.0, 1.0, 0.94],   // Ivory: #fffff0
            timeScale: 0.08,
            iterations: 10.0,
            waveAmplitude: 0.7,
            opacity: 0.8,
            posterizeLevels: 8.0
        }
    };
} 