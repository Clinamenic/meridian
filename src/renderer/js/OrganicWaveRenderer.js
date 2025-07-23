class OrganicWaveRenderer {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

        // Simplified configuration for spherical topological texture
        this.config = {
            // Sphere and terrain parameters
            sphereRadius: 1.0,
            sphereSegments: 64,
            sphereRings: 32,
            elevationScale: 0.3,
            noiseOctaves: 5,
            noiseFrequency: 1.5,
            noisePersistence: 0.6,
            terrainSeed: 42,
            
            // Layer configuration
            layerThresholds: {
                oceanDeep: -0.8,
                oceanShallow: -0.3,
                beach: -0.05,
                lowland: 0.2,
                highland: 0.5,
                mountain: 0.75,
                peak: 0.9
            },
            
            // Terrain colors
            terrainColors: {
                oceanDeep: [0.05, 0.15, 0.35],
                oceanShallow: [0.1, 0.3, 0.6],
                beach: [0.8, 0.75, 0.6],
                lowland: [0.2, 0.5, 0.2],
                highland: [0.4, 0.35, 0.2],
                mountain: [0.3, 0.25, 0.2],
                peak: [0.85, 0.85, 0.9]
            },
            
            // Interaction
            enableDrag: true,
            dragSensitivity: 1.2,
            autoRotate: true,
            autoRotateSpeed: 0.3,
            
            // Viewport
            circularViewport: true,
            viewportRadius: 0.42,
            edgeSoftness: 0.02,
            
            // Animation
            elevationAnimation: {
                enabled: true,
                speed: 0.3,
                amplitude: 0.1
            },
            
            // Lighting and shading
            sphericalShading: {
                enabled: true,
                intensity: 0.3,
                lightDirection: [0.5, 1.0, 0.5]
            },
            
            // Apply user configuration
            ...config
        };

        // Core state
        this.uniforms = {};
        this.program = null;
        this.animationId = null;
        this.startTime = Date.now();
        this.isInitialized = false;

        // Sphere geometry and interaction
        this.sphereGeometry = null;
        this.sphereBuffers = null;
        this.rotationMatrix = new Float32Array(16);
        this.currentRotation = { x: 0, y: 0, z: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.lastFrameTime = performance.now();

        // Initialize
        this.initializeIdentityMatrix();
        this.init();
    }

    initializeIdentityMatrix() {
        this.rotationMatrix.set([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    async init() {
        if (!this.gl) {
            console.warn('WebGL not supported, falling back to CSS');
            this.fallbackToCSS();
            return;
        }

        try {
            this.setupShaders();
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

    setupShaders() {
        const vertexShaderSource = `#version 300 es
            in vec3 aPosition;
            in vec3 aNormal;
            in vec2 aUV;
            
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uRotationMatrix;
            uniform float uTime;
            uniform float uSphereRadius;
            uniform float uElevationScale;
            uniform float uNoiseOctaves;
            uniform float uNoiseFrequency;
            uniform float uNoisePersistence;
            uniform float uTerrainSeed;
            uniform bool uEnableElevationAnimation;
            uniform float uElevationAnimationSpeed;
            uniform float uElevationAnimationAmplitude;
            
            out vec3 vWorldPosition;
            out vec3 vNormal;
            out vec2 vUV;
            out float vElevation;
            out float vDepth;
            out float vOriginalElevation;
            
            // Improved noise function for better topological texture
            float hash(vec3 p) {
                p = fract(p * vec3(123.34, 456.21, 789.12));
                p += dot(p, p + 45.32);
                return fract((p.x + p.y) * p.z);
            }
            
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = hash(i);
                float b = hash(i + vec3(1.0, 0.0, 0.0));
                float c = hash(i + vec3(0.0, 1.0, 0.0));
                float d = hash(i + vec3(1.0, 1.0, 0.0));
                float e = hash(i + vec3(0.0, 0.0, 1.0));
                float f1 = hash(i + vec3(1.0, 0.0, 1.0));
                float g = hash(i + vec3(0.0, 1.0, 1.0));
                float h = hash(i + vec3(1.0, 1.0, 1.0));
                
                return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
                          mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
            }
            
            float multiOctaveNoise(vec3 pos, float octaves, float frequency, float persistence) {
                float total = 0.0;
                float amplitude = 1.0;
                float freq = frequency;
                float maxValue = 0.0;
                
                for (float i = 0.0; i < octaves; i++) {
                    total += noise(pos * freq) * amplitude;
                    maxValue += amplitude;
                    amplitude *= persistence;
                    freq *= 2.0;
                }
                
                // Apply additional smoothing for cleaner terrain
                float result = total / maxValue;
                result = smoothstep(0.0, 1.0, result);
                return result * 2.0 - 1.0; // Remap to [-1, 1] range
            }
            
            void main() {
                vec4 rotatedPos = uRotationMatrix * vec4(aPosition, 1.0);
                vec3 worldPosition = rotatedPos.xyz;
                vec3 rotatedNormal = (uRotationMatrix * vec4(aNormal, 0.0)).xyz;
                
                // No 3D displacement - keep the sphere surface flat for contour lines
                vec4 viewSpacePos = uViewMatrix * vec4(worldPosition, 1.0);
                float depth = abs(viewSpacePos.z);
                
                vec4 finalPosition = uProjectionMatrix * uViewMatrix * vec4(worldPosition, 1.0);
                
                vWorldPosition = worldPosition;
                vNormal = rotatedNormal;
                vUV = aUV;
                vElevation = 0.0; // Not used in contour mode
                vDepth = depth;
                gl_Position = finalPosition;
            }
        `;

        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec3 vWorldPosition;
            in vec3 vNormal;
            in vec2 vUV;
            in float vElevation;
            in float vDepth;
            in float vOriginalElevation;
            
            uniform vec2 uResolution;
            uniform float uTime;
            uniform float uNoiseOctaves;
            uniform float uNoiseFrequency;
            uniform float uNoisePersistence;
            uniform float uTerrainSeed;
            uniform bool uEnableElevationAnimation;
            uniform float uElevationAnimationSpeed;
            uniform float uElevationAnimationAmplitude;
            uniform bool uCircularMask;
            uniform float uViewportRadius;
            uniform float uEdgeSoftness;
            
            // Spherical shading uniforms
            uniform bool uSphericalShadingEnabled;
            uniform float uSphericalShadingIntensity;
            uniform vec3 uLightDirection;
            
            // Simple 4-color system uniforms
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            uniform float uThreshold1;
            uniform float uThreshold2;
            uniform float uThreshold3;
            
            out vec4 fragColor;
            
            // Improved noise function for better topological texture
            float hash(vec3 p) {
                p = fract(p * vec3(123.34, 456.21, 789.12));
                p += dot(p, p + 45.32);
                return fract((p.x + p.y) * p.z);
            }
            
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = hash(i);
                float b = hash(i + vec3(1.0, 0.0, 0.0));
                float c = hash(i + vec3(0.0, 1.0, 0.0));
                float d = hash(i + vec3(1.0, 1.0, 0.0));
                float e = hash(i + vec3(0.0, 0.0, 1.0));
                float f1 = hash(i + vec3(1.0, 0.0, 1.0));
                float g = hash(i + vec3(0.0, 1.0, 1.0));
                float h = hash(i + vec3(1.0, 1.0, 1.0));
                
                return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
                          mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
            }
            
            float multiOctaveNoise(vec3 pos, float octaves, float frequency, float persistence) {
                float total = 0.0;
                float amplitude = 1.0;
                float freq = frequency;
                float maxValue = 0.0;
                
                for (float i = 0.0; i < octaves; i++) {
                    total += noise(pos * freq) * amplitude;
                    maxValue += amplitude;
                    amplitude *= persistence;
                    freq *= 2.0;
                }
                
                return total / maxValue;
            }
            
            // Anti-aliased step function for smooth contour lines
            float aastep(float threshold, float value) {
                float afwidth = 0.7 * length(vec2(dFdx(value), dFdy(value)));
                return smoothstep(threshold - afwidth, threshold + afwidth, value);
            }
            
            // Calculate base terrain color based on elevation - SOLID POSTERIZED COLORS
            vec3 calculateTerrainColor(float elevation) {
                // Simple 4-zone system with solid colors, no gradients
                if (elevation < uThreshold1) {
                    return uColor1; // Darkest stratum
                } else if (elevation < uThreshold2) {
                    return uColor2; // Dark stratum
                } else if (elevation < uThreshold3) {
                    return uColor3; // Main theme color
                } else {
                    return uColor4; // Lightest stratum
                }
            }
            
            // Generate topographic contour lines with improved visibility
            float generateContourLines(vec3 worldPos) {
                vec3 noisePos = worldPos * uNoiseFrequency;
                
                // Add more dramatic animation to the terrain
                if (uEnableElevationAnimation) {
                    noisePos += vec3(
                        sin(uTime * uElevationAnimationSpeed) * uElevationAnimationAmplitude,
                        cos(uTime * uElevationAnimationSpeed * 1.3) * uElevationAnimationAmplitude,
                        sin(uTime * uElevationAnimationSpeed * 0.7) * uElevationAnimationAmplitude
                    );
                }
                
                float elevation = multiOctaveNoise(noisePos, uNoiseOctaves, 1.0, uNoisePersistence);
                elevation = (elevation + 1.0) * 0.5; // Remap to [0, 1]
                
                // Create more prominent contour lines
                float contourSpacing = 0.08; // Wider spacing for more visible contours
                float contourWidth = 0.004; // Thicker lines for better visibility
                
                // Generate multiple contour levels with varying intensity
                float contour = 0.0;
                for (float i = 0.0; i < 12.0; i++) {
                    float level = i * contourSpacing;
                    float line = aastep(level - contourWidth, elevation) - aastep(level + contourWidth, elevation);
                    
                    // Make every 4th contour line more prominent
                    if (mod(i, 4.0) == 0.0) {
                        line *= 1.5;
                    }
                    
                    contour = max(contour, line);
                }
                
                return contour;
            }
            
            float calculateCircularMask() {
                if (!uCircularMask) return 1.0;
                
                vec2 screenPos = gl_FragCoord.xy / uResolution;
                vec2 center = vec2(0.5);
                float distanceFromCenter = length(screenPos - center);
                
                return smoothstep(uViewportRadius + uEdgeSoftness, uViewportRadius, distanceFromCenter);
            }
            
            void main() {
                float mask = calculateCircularMask();
                if (mask < 0.001) discard;
                
                // Generate elevation and contour lines
                vec3 noisePos = vWorldPosition * uNoiseFrequency;
                if (uEnableElevationAnimation) {
                    noisePos += vec3(
                        sin(uTime * uElevationAnimationSpeed) * uElevationAnimationAmplitude,
                        cos(uTime * uElevationAnimationSpeed * 1.3) * uElevationAnimationAmplitude,
                        sin(uTime * uElevationAnimationSpeed * 0.7) * uElevationAnimationAmplitude
                    );
                }
                
                float elevation = multiOctaveNoise(noisePos, uNoiseOctaves, 1.0, uNoisePersistence);
                elevation = (elevation + 1.0) * 0.5; // Remap to [0, 1]
                
                // Generate contour lines
                float contourLines = generateContourLines(vWorldPosition);
                
                // Base terrain color
                vec3 terrainColor = calculateTerrainColor(elevation);
                
                // Add contour lines (dark lines on the terrain)
                vec3 contourColor = vec3(0.1, 0.1, 0.1); // Dark contour lines
                vec3 finalColor = mix(terrainColor, contourColor, contourLines * 0.8);
                
                // Apply circular mask
                finalColor *= mask;
                
                // Add spherical shading for 3D effect
                float shading = 1.0;
                if (uSphericalShadingEnabled) {
                    vec3 normalizedLightDir = normalize(uLightDirection);
                    vec3 normalizedNormal = normalize(vNormal);
                    float diffuse = max(dot(normalizedNormal, normalizedLightDir), 0.0);
                    shading = mix(1.0, diffuse, uSphericalShadingIntensity);
                }
                
                // Add subtle depth variation
                float depthVariation = 1.0 + (vDepth - 1.0) * 0.1;
                finalColor *= depthVariation * shading;
                finalColor = clamp(finalColor, 0.0, 1.0);
                
                fragColor = vec4(finalColor, 1.0);
            }
        `;

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (!this.program) {
            throw new Error('Failed to create shader program');
        }
    }

    setupGeometry() {
        // Generate proper sphere mesh with correct triangulation
        const radius = this.config.sphereRadius;
        const segments = this.config.sphereSegments;
        const rings = this.config.sphereRings;
        
        const vertices = [];
        const normals = [];
        const uvCoordinates = [];
        const indices = [];
        
        // Generate vertices in a proper sphere pattern
        for (let ring = 0; ring <= rings; ring++) {
            const phi = (ring * Math.PI) / rings;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            
            for (let segment = 0; segment <= segments; segment++) {
                const theta = (segment * 2 * Math.PI) / segments;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                
                const x = cosTheta * sinPhi;
                const y = cosPhi;
                const z = sinTheta * sinPhi;
                
                vertices.push(x * radius, y * radius, z * radius);
                normals.push(x, y, z);
                uvCoordinates.push(segment / segments, ring / rings);
            }
        }
        
        // Generate proper triangle indices
        for (let ring = 0; ring < rings; ring++) {
            for (let segment = 0; segment < segments; segment++) {
                const first = ring * (segments + 1) + segment;
                const second = first + segments + 1;
                
                // First triangle
                indices.push(first, second, first + 1);
                // Second triangle
                indices.push(second, second + 1, first + 1);
            }
        }
        
        // Create WebGL buffers
        this.sphereBuffers = {
            vertices: this.gl.createBuffer(),
            normals: this.gl.createBuffer(),
            uvCoordinates: this.gl.createBuffer(),
            indices: this.gl.createBuffer(),
            indexCount: indices.length
        };
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.vertices);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.normals);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.uvCoordinates);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(uvCoordinates), this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereBuffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
        
        // Setup vertex attributes
        const positionLocation = this.gl.getAttribLocation(this.program, 'aPosition');
        const normalLocation = this.gl.getAttribLocation(this.program, 'aNormal');
        const uvLocation = this.gl.getAttribLocation(this.program, 'aUV');
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.vertices);
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.normals);
        this.gl.enableVertexAttribArray(normalLocation);
        this.gl.vertexAttribPointer(normalLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sphereBuffers.uvCoordinates);
        this.gl.enableVertexAttribArray(uvLocation);
        this.gl.vertexAttribPointer(uvLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.sphereBuffers.indices);
    }

    setupUniforms() {
        this.uniforms = {
            uTime: this.gl.getUniformLocation(this.program, 'uTime'),
            uViewMatrix: this.gl.getUniformLocation(this.program, 'uViewMatrix'),
            uProjectionMatrix: this.gl.getUniformLocation(this.program, 'uProjectionMatrix'),
            uRotationMatrix: this.gl.getUniformLocation(this.program, 'uRotationMatrix'),
            uSphereRadius: this.gl.getUniformLocation(this.program, 'uSphereRadius'),
            uElevationScale: this.gl.getUniformLocation(this.program, 'uElevationScale'),
            uNoiseOctaves: this.gl.getUniformLocation(this.program, 'uNoiseOctaves'),
            uNoiseFrequency: this.gl.getUniformLocation(this.program, 'uNoiseFrequency'),
            uNoisePersistence: this.gl.getUniformLocation(this.program, 'uNoisePersistence'),
            uTerrainSeed: this.gl.getUniformLocation(this.program, 'uTerrainSeed'),
            uEnableElevationAnimation: this.gl.getUniformLocation(this.program, 'uEnableElevationAnimation'),
            uElevationAnimationSpeed: this.gl.getUniformLocation(this.program, 'uElevationAnimationSpeed'),
            uElevationAnimationAmplitude: this.gl.getUniformLocation(this.program, 'uElevationAnimationAmplitude'),
            
            // Layer thresholds
            uThresholdOceanDeep: this.gl.getUniformLocation(this.program, 'uThresholdOceanDeep'),
            uThresholdOceanShallow: this.gl.getUniformLocation(this.program, 'uThresholdOceanShallow'),
            uThresholdBeach: this.gl.getUniformLocation(this.program, 'uThresholdBeach'),
            uThresholdLowland: this.gl.getUniformLocation(this.program, 'uThresholdLowland'),
            uThresholdHighland: this.gl.getUniformLocation(this.program, 'uThresholdHighland'),
            uThresholdMountain: this.gl.getUniformLocation(this.program, 'uThresholdMountain'),
            uThresholdPeak: this.gl.getUniformLocation(this.program, 'uThresholdPeak'),
            
            // Terrain colors
            uColor1: this.gl.getUniformLocation(this.program, 'uColor1'),
            uColor2: this.gl.getUniformLocation(this.program, 'uColor2'),
            uColor3: this.gl.getUniformLocation(this.program, 'uColor3'),
            uColor4: this.gl.getUniformLocation(this.program, 'uColor4'),
            uThreshold1: this.gl.getUniformLocation(this.program, 'uThreshold1'),
            uThreshold2: this.gl.getUniformLocation(this.program, 'uThreshold2'),
            uThreshold3: this.gl.getUniformLocation(this.program, 'uThreshold3'),
            
            uResolution: this.gl.getUniformLocation(this.program, 'uResolution'),
            uCircularMask: this.gl.getUniformLocation(this.program, 'uCircularMask'),
            uViewportRadius: this.gl.getUniformLocation(this.program, 'uViewportRadius'),
            uEdgeSoftness: this.gl.getUniformLocation(this.program, 'uEdgeSoftness'),
            
            // Spherical shading uniforms
            uSphericalShadingEnabled: this.gl.getUniformLocation(this.program, 'uSphericalShadingEnabled'),
            uSphericalShadingIntensity: this.gl.getUniformLocation(this.program, 'uSphericalShadingIntensity'),
            uLightDirection: this.gl.getUniformLocation(this.program, 'uLightDirection')
        };
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        // Remove sphere rotation drag functionality - window dragging is handled by CSS
        // if (this.config.enableDrag) {
        //     this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        //     this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        //     this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        //     this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        // }
    }

    // Mouse event handlers removed - window dragging is now handled by CSS
    // onMouseDown(e) {
    //     // Sphere rotation drag functionality removed
    // }

    // onMouseMove(e) {
    //     // Sphere rotation drag functionality removed
    // }

    // onMouseUp(e) {
    //     // Sphere rotation drag functionality removed
    // }

    updateRotationMatrix() {
        const cosX = Math.cos(this.currentRotation.x);
        const sinX = Math.sin(this.currentRotation.x);
        const cosY = Math.cos(this.currentRotation.y);
        const sinY = Math.sin(this.currentRotation.y);
        
        this.rotationMatrix.set([
            cosY, 0, sinY, 0,
            sinX * sinY, cosX, -sinX * cosY, 0,
            -cosX * sinY, sinX, cosX * cosY, 0,
            0, 0, 0, 1
        ]);
    }

    render() {
        if (!this.isInitialized || !this.program) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = currentTime;

        // Auto-rotation (removed dragging dependency since we're using window dragging now)
        if (this.config.autoRotate) {
            this.currentRotation.y += this.config.autoRotateSpeed * deltaTime;
            this.updateRotationMatrix();
        }

        const elapsedTime = (Date.now() - this.startTime) / 1000;

        // Enable depth testing and blending
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        this.gl.useProgram(this.program);

        // Create view and projection matrices
        const viewMatrix = this.createViewMatrix();
        const projectionMatrix = this.createProjectionMatrix();

        // Update uniforms
        this.gl.uniform1f(this.uniforms.uTime, elapsedTime);
        this.gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
        this.gl.uniformMatrix4fv(this.uniforms.uViewMatrix, false, viewMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.uProjectionMatrix, false, projectionMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.uRotationMatrix, false, this.rotationMatrix);

        // Sphere and terrain parameters
        this.gl.uniform1f(this.uniforms.uSphereRadius, this.config.sphereRadius);
        this.gl.uniform1f(this.uniforms.uElevationScale, this.config.elevationScale);
        this.gl.uniform1f(this.uniforms.uNoiseOctaves, this.config.noiseOctaves);
        this.gl.uniform1f(this.uniforms.uNoiseFrequency, this.config.noiseFrequency);
        this.gl.uniform1f(this.uniforms.uNoisePersistence, this.config.noisePersistence);
        this.gl.uniform1f(this.uniforms.uTerrainSeed, this.config.terrainSeed);

        // Animation parameters
        this.gl.uniform1i(this.uniforms.uEnableElevationAnimation, this.config.elevationAnimation.enabled ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uElevationAnimationSpeed, this.config.elevationAnimation.speed);
        this.gl.uniform1f(this.uniforms.uElevationAnimationAmplitude, this.config.elevationAnimation.amplitude);

        // Layer thresholds
        this.gl.uniform1f(this.uniforms.uThresholdOceanDeep, this.config.layerThresholds.oceanDeep);
        this.gl.uniform1f(this.uniforms.uThresholdOceanShallow, this.config.layerThresholds.oceanShallow);
        this.gl.uniform1f(this.uniforms.uThresholdBeach, this.config.layerThresholds.beach);
        this.gl.uniform1f(this.uniforms.uThresholdLowland, this.config.layerThresholds.lowland);
        this.gl.uniform1f(this.uniforms.uThresholdHighland, this.config.layerThresholds.highland);
        this.gl.uniform1f(this.uniforms.uThresholdMountain, this.config.layerThresholds.mountain);
        this.gl.uniform1f(this.uniforms.uThresholdPeak, this.config.layerThresholds.peak);

        // Terrain colors
        const colors = this.config.terrainColors;
        const thresholds = this.config.elevationThresholds;
        this.gl.uniform3f(this.uniforms.uColor1, ...colors.color1);
        this.gl.uniform3f(this.uniforms.uColor2, ...colors.color2);
        this.gl.uniform3f(this.uniforms.uColor3, ...colors.color3);
        this.gl.uniform3f(this.uniforms.uColor4, ...colors.color4);
        this.gl.uniform1f(this.uniforms.uThreshold1, thresholds.threshold1);
        this.gl.uniform1f(this.uniforms.uThreshold2, thresholds.threshold2);
        this.gl.uniform1f(this.uniforms.uThreshold3, thresholds.threshold3);

        // Viewport configuration
        this.gl.uniform1i(this.uniforms.uCircularMask, this.config.circularViewport ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uViewportRadius, this.config.viewportRadius);
        this.gl.uniform1f(this.uniforms.uEdgeSoftness, this.config.edgeSoftness);

        // Spherical shading configuration
        this.gl.uniform1i(this.uniforms.uSphericalShadingEnabled, this.config.sphericalShading.enabled ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uSphericalShadingIntensity, this.config.sphericalShading.intensity);
        this.gl.uniform3f(this.uniforms.uLightDirection, ...this.config.sphericalShading.lightDirection);

        // Clear and render
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Draw sphere using indexed rendering
        this.gl.drawElements(this.gl.TRIANGLES, this.sphereBuffers.indexCount, this.gl.UNSIGNED_SHORT, 0);

        this.animationId = requestAnimationFrame(() => this.render());
    }

    createViewMatrix() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, -3, 1
        ]);
    }

    createProjectionMatrix() {
        const fovy = Math.PI / 4;
        const aspect = this.canvas.width / this.canvas.height;
        const near = 0.1;
        const far = 100.0;

        const f = 1.0 / Math.tan(fovy / 2);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0
        ]);
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
        this.canvas.width = rect.width * Math.min(window.devicePixelRatio, 2);
        this.canvas.height = rect.height * Math.min(window.devicePixelRatio, 2);

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

    static isSupported() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return !!gl;
    }
}

// Export for module usage
export { OrganicWaveRenderer }; 