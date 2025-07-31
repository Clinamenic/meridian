// Preset configurations for different use cases
const PRESETS = {
    landing: {
        // Sphere and terrain parameters - Adjusted for better color distribution
        sphereRadius: 1.0,
        sphereSegments: 64,
        sphereRings: 32,
        elevationScale: 0.185,
        noiseOctaves: 3.5,        // Reduced for less complex noise
        noiseFrequency: 2.5,      // Reduced for larger features
        noisePersistence: 0.5,  // Increased for more variation
        terrainSeed: 4,
        
        // Terrain colors (4-color system) - Now using CSS variables
        terrainColors: {
            color1: '--theme-grade-7',  
            color2: '--theme-grade-11', 
            color3: '--theme-grade-15',  
            color4: '--theme-grade-18'  
        },
        
        // Elevation thresholds for 4-color system - Adjusted based on observed distribution
        elevationThresholds: {
            threshold1: 0.69,   // Below this = color1 (red) - 60% of terrain
            threshold2: 0.75,   // Below this = color2 (blue) - 20% of terrain
            threshold3: 0.82   // Below this = color3 (green) - 15% of terrain, above = color4 (purple) - 5% of terrain
        },
        
        // Interaction
        enableDrag: true,
        dragSensitivity: 1.2,
        autoRotate: true,
        autoRotateSpeed: 0.05, // Increased for more visible rotation
        
        // Viewport
        circularViewport: true,
        viewportRadius: 1.0,
        edgeSoftness: 0.0,
        
        // Animation - DISABLED for smooth rotation
        elevationAnimation: {
            enabled: false, // Disable to fix rotation issue
            speed: 0.4,
            amplitude: 0.15
        },
        
        // Lighting and shading
        sphericalShading: {
            enabled: true,
            intensity: 0.3,
            lightDirection: [0.5, 1.0, 0.5]
        },
        
        // Contour line configuration - aligned with elevation thresholds
        contourLines: {
            enabled: true,
            spacing: 0.0,         // Not used - lines are at exact thresholds
            width: 0.005,        // Very thin fixed width for boundary lines
            intensity: 0.5,       // Intensity of boundary lines
            color: '--theme-grade-12', // Color of contour lines (CSS variable)
            levels: 3,            // Number of threshold boundaries (3 thresholds)
            prominentEvery: 0     // Not used - all lines are equal
        },
        
        // Grain texture overlay configuration
        grainTexture: {
            enabled: true,        // Enable/disable grain texture
            intensity: 0.38,      // Strength of grain effect (0.0 - 1.0)
            scale: 1,          // Scale of grain pattern (higher = finer grain)
            speed: 0.01,           // Animation speed of grain movement
            contrast: 0.4,        // Contrast of grain pattern
            color: [0.9, 0.9, 0.9], // Grain color (dark gray by default)
            animated: true        // Whether grain should animate over time
        }
    },
    
    default: {
        // Sphere and terrain parameters
        sphereRadius: 1.0,
        sphereSegments: 64,
        sphereRings: 32,
        elevationScale: 0.3,
        noiseOctaves: 5,
        noiseFrequency: 1.5,
        noisePersistence: 0.6,
        terrainSeed: 42,
        
        // Terrain colors (4-color system) - Simplified to match landing preset
        terrainColors: {
            color1: '--theme-primary',
            color2: '--theme-primary',
            color3: '--theme-primary',
            color4: '--theme-primary'
        },
        
        // Elevation thresholds for 4-color system
        elevationThresholds: {
            threshold1: 0.3,  // Below this = color1
            threshold2: 0.5,  // Below this = color2
            threshold3: 0.8   // Below this = color3, above = color4
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
        
        // Contour line configuration - aligned with elevation thresholds
        contourLines: {
            enabled: true,
            spacing: 0.0,         // Not used - lines are at exact thresholds
            width: 0.010,         // Thickness of threshold boundary lines
            intensity: 0.8,       // Intensity of boundary lines
            color: '--theme-primary', // Color of contour lines
            levels: 3,            // Number of threshold boundaries (3 thresholds)
            prominentEvery: 0     // Not used - all lines are equal
        },
        
        // Grain texture overlay configuration
        grainTexture: {
            enabled: false,       // Disabled by default for main app
            intensity: 0.1,       // Lower intensity for main app
            scale: 40.0,          // Slightly coarser grain
            speed: 0.05,          // Slower animation
            contrast: 1.1,        // Lower contrast
            color: [0.05, 0.05, 0.05], // Very subtle grain
            animated: true
        }
    }
};

// Utility function to read CSS variables and convert HSL to RGB
function getCSSVariableAsRGB(cssVariableName) {
    try {
        // Create a temporary element to get computed styles
        const tempElement = document.createElement('div');
        tempElement.style.color = `var(${cssVariableName})`;
        document.body.appendChild(tempElement);
        
        // Get the computed style value (this resolves nested variables and calc() functions)
        const computedStyle = getComputedStyle(tempElement);
        const value = computedStyle.color;
        
        // Clean up
        document.body.removeChild(tempElement);
        
        console.log(`Reading CSS variable ${cssVariableName}: "${value}"`);
        
        if (!value) {
            console.warn(`CSS variable ${cssVariableName} not found, using fallback`);
            return [0.5, 0.5, 0.5]; // Fallback gray
        }
        
        // Parse RGB values (computed style returns rgb(r, g, b) format)
        if (value.startsWith('rgb(')) {
            const rgbMatch = value.match(/rgb\(([^)]+)\)/);
            if (rgbMatch) {
                const result = rgbMatch[1].split(',').map(v => parseFloat(v.trim()) / 255);
                // console.log(`RGB ${cssVariableName}: ${value} -> normalized: [${result.map(v => v.toFixed(3)).join(', ')}]`);
                return result;
            }
        }
        
        // Handle rgba values
        if (value.startsWith('rgba(')) {
            const rgbaMatch = value.match(/rgba\(([^)]+)\)/);
            if (rgbaMatch) {
                const parts = rgbaMatch[1].split(',').map(v => parseFloat(v.trim()));
                const result = [parts[0] / 255, parts[1] / 255, parts[2] / 255];
                // console.log(`RGBA ${cssVariableName}: ${value} -> normalized: [${result.map(v => v.toFixed(3)).join(', ')}]`);
                return result;
            }
        }
        
        // Handle hex values
        if (value.startsWith('#')) {
            const result = hexToRgb(value);
            // console.log(`Hex ${cssVariableName}: ${value} -> RGB: [${result.map(v => v.toFixed(3)).join(', ')}]`);
            return result;
        }
        
        console.warn(`Unsupported color format for ${cssVariableName}: ${value}`);
        return [0.5, 0.5, 0.5]; // Fallback gray
        
    } catch (error) {
        console.error(`Error reading CSS variable ${cssVariableName}:`, error);
        return [0.5, 0.5, 0.5]; // Fallback gray
    }
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    
    return [r + m, g + m, b + m];
}

// Convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
    ] : [0.5, 0.5, 0.5];
}

// Process color configuration to convert CSS variables to RGB values
function processColorConfig(colorConfig) {
    const processed = {};
    
    // console.log('Processing color config:', colorConfig);
    
    for (const [key, value] of Object.entries(colorConfig)) {
        if (typeof value === 'string' && value.startsWith('--')) {
            // It's a CSS variable, convert it
            processed[key] = getCSSVariableAsRGB(value);
            // console.log(`Processed ${key}: ${value} -> [${processed[key].map(v => v.toFixed(3)).join(', ')}]`);
        } else if (Array.isArray(value)) {
            // It's already an RGB array, use as is
            processed[key] = value;
            // console.log(`Using existing RGB for ${key}: [${value.map(v => v.toFixed(3)).join(', ')}]`);
        } else {
            console.warn(`Invalid color value for ${key}:`, value);
            processed[key] = [0.5, 0.5, 0.5]; // Fallback gray
        }
    }
    
    // console.log('Final processed colors:', processed);
    return processed;
}

class TopologyRenderer {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

        // Handle preset configuration
        let presetConfig = {};
        let userOverrides = {};
        
        if (typeof config === 'string') {
            // Config is a preset name
            presetConfig = PRESETS[config] || PRESETS.default;
        } else if (config.preset) {
            // Config has preset and overrides
            presetConfig = PRESETS[config.preset] || PRESETS.default;
            userOverrides = config.overrides || {};
        } else {
            // Config is direct overrides (backward compatibility)
            presetConfig = PRESETS.default;
            userOverrides = config;
        }

        // Merge preset with user overrides
        this.config = {
            ...presetConfig,
            ...userOverrides
        };
        
        // Process color configuration to convert CSS variables to RGB
        if (this.config.terrainColors) {
            this.config.terrainColors = processColorConfig(this.config.terrainColors);
        }
        
        // Process contour line color configuration
        if (this.config.contourLines && this.config.contourLines.color) {
            this.config.contourLines.color = getCSSVariableAsRGB(this.config.contourLines.color);
        }
        
        // Debug: Log the color values to verify they're being processed correctly
        console.log('=== COLOR DEBUG ===');
        console.log('Color 1 (red):', this.config.terrainColors.color1);
        console.log('Color 2 (blue):', this.config.terrainColors.color2);
        console.log('Color 3 (green):', this.config.terrainColors.color3);
        console.log('Color 4 (purple):', this.config.terrainColors.color4);
        console.log('Noise parameters:', {
            octaves: this.config.noiseOctaves,
            frequency: this.config.noiseFrequency,
            persistence: this.config.noisePersistence,
            seed: this.config.terrainSeed
        });
        console.log('==================');
        
        // Constructor diagnostics
        console.log('=== TOPOLOGY RENDERER INITIALIZATION ===');
        console.log('Canvas size:', canvas.width, 'x', canvas.height);
        console.log('WebGL context:', this.gl ? 'Available' : 'Not available');
        if (typeof config === 'string') {
            console.log('Using preset:', config);
        } else if (config.preset) {
            console.log('Using preset:', config.preset);
            console.log('With overrides:', Object.keys(userOverrides));
        } else {
            console.log('Using default preset with direct overrides');
        }
        console.log('Final config keys:', Object.keys(this.config));
        console.log('Auto-rotate:', this.config.autoRotate);
        console.log('Auto-rotate speed:', this.config.autoRotateSpeed);
        console.log('Elevation animation enabled:', this.config.elevationAnimation.enabled);
        console.log('Processed terrain colors:', this.config.terrainColors);
        console.log('Elevation thresholds:', this.config.elevationThresholds);
        console.log('==========================================');

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
            console.error('Failed to initialize TopologyRenderer:', error);
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
            uniform bool uDebugMode;
            
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
            uniform bool uDebugMode;
            uniform bool uCircularMask;
            uniform float uViewportRadius;
            uniform float uEdgeSoftness;
            
            // Spherical shading uniforms
            uniform bool uSphericalShadingEnabled;
            uniform float uSphericalShadingIntensity;
            uniform vec3 uLightDirection;
            
            // Rotation matrix for texture coordinates
            uniform mat4 uRotationMatrix;
            
            // Simple 4-color system uniforms
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            uniform float uThreshold1;
            uniform float uThreshold2;
            uniform float uThreshold3;
            
            // Contour line configuration uniforms - threshold-aligned
            uniform bool uContourLinesEnabled;
            uniform float uContourLinesWidth;
            uniform float uContourLinesIntensity;
            uniform vec3 uContourLinesColor;
            
            // Grain texture overlay uniforms
            uniform bool uGrainTextureEnabled;
            uniform float uGrainIntensity;
            uniform float uGrainScale;
            uniform float uGrainSpeed;
            uniform float uGrainContrast;
            uniform vec3 uGrainColor;
            uniform bool uGrainAnimated;
            
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
            
            // Grain noise function for static texture overlay
            float grainNoise(vec2 uv, float time) {
                // Create animated grain pattern using screen coordinates and time
                vec2 grainPos = uv * uGrainScale;
                
                // Add time-based animation if enabled
                if (uGrainAnimated) {
                    grainPos += vec2(
                        sin(time * uGrainSpeed * 1.1) * 0.5,
                        cos(time * uGrainSpeed * 0.9) * 0.5
                    );
                }
                
                // Generate noise using the hash function
                vec3 p = vec3(grainPos, time * uGrainSpeed * 0.1);
                float noise = hash(p);
                
                // Apply contrast and remap to [-1, 1] range
                noise = pow(noise, uGrainContrast);
                return noise * 2.0 - 1.0;
            }
            
            // Anti-aliased step function for smooth contour lines
            float aastep(float threshold, float value) {
                float afwidth = 0.7 * length(vec2(dFdx(value), dFdy(value)));
                return smoothstep(threshold - afwidth, threshold + afwidth, value);
            }
            
            // Constant-width step function for uniform contour lines
            float constantStep(float threshold, float value, float width) {
                return smoothstep(threshold - width, threshold + width, value);
            }
            
            // Calculate base terrain color based on elevation - SOLID POSTERIZED COLORS
            vec3 calculateTerrainColor(float elevation) {
                // Simple 4-zone system with solid colors, no gradients
                if (elevation < uThreshold1) {
                    return uColor1; // Red
                } else if (elevation < uThreshold2) {
                    return uColor2; // Blue
                } else if (elevation < uThreshold3) {
                    return uColor3; // Green
                } else {
                    return uColor4; // Purple
                }
            }
            
            // Generate topographic contour lines aligned with elevation thresholds
            float generateContourLines(vec3 noisePos) {
                float elevation = multiOctaveNoise(noisePos, uNoiseOctaves, uNoiseFrequency, uNoisePersistence);
                elevation = (elevation + 1.0) * 0.5; // Remap to [0, 1]
                
                // Use a very small fixed width for boundary lines
                // This creates thin, consistent boundary markers
                float boundaryWidth = uContourLinesWidth;
                
                // Check if we're exactly at any threshold boundary
                float line = 0.0;
                
                // Threshold 1 boundary
                if (abs(elevation - uThreshold1) < boundaryWidth) {
                    line = 1.0;
                }
                
                // Threshold 2 boundary  
                if (abs(elevation - uThreshold2) < boundaryWidth) {
                    line = 1.0;
                }
                
                // Threshold 3 boundary
                if (abs(elevation - uThreshold3) < boundaryWidth) {
                    line = 1.0;
                }
                
                return line;
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
                // Use the original sphere position (before rotation) for noise calculation
                // This ensures the texture rotates with the sphere instead of sliding over it
                vec3 originalPos = (inverse(uRotationMatrix) * vec4(vWorldPosition, 1.0)).xyz;
                vec3 noisePos = originalPos * uNoiseFrequency;
                
                // Debug: Log noise position changes (only for center pixel to avoid spam)
                if (uDebugMode && length(gl_FragCoord.xy - uResolution.xy * 0.5) < 10.0) {
                    // This would need to be handled differently in WebGL - just for reference
                }
                
                // Only animate noise position if elevation animation is enabled
                if (uEnableElevationAnimation) {
                    noisePos += vec3(
                        sin(uTime * uElevationAnimationSpeed) * uElevationAnimationAmplitude,
                        cos(uTime * uElevationAnimationSpeed * 1.3) * uElevationAnimationAmplitude,
                        sin(uTime * uElevationAnimationSpeed * 0.7) * uElevationAnimationAmplitude
                    );
                }
                
                float elevation = multiOctaveNoise(noisePos, uNoiseOctaves, uNoiseFrequency, uNoisePersistence);
                elevation = (elevation + 1.0) * 0.5; // Remap to [0, 1]
                
                // Generate contour lines using the same noise position as elevation
                float contourLines = 0.0;
                if (uContourLinesEnabled) {
                    contourLines = generateContourLines(noisePos);
                }
                
                // Base terrain color
                vec3 terrainColor = calculateTerrainColor(elevation);
                
                // Add contour lines (dark lines on the terrain)
                vec3 finalColor = terrainColor;
                if (uContourLinesEnabled && contourLines > 0.0) {
                    vec3 contourColor = uContourLinesColor; // Use configurable color
                    finalColor = mix(terrainColor, contourColor, contourLines * uContourLinesIntensity);
                }
                
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
                
                // Apply grain texture overlay
                if (uGrainTextureEnabled) {
                    vec2 screenUV = gl_FragCoord.xy / uResolution;
                    float grain = grainNoise(screenUV, uTime);
                    
                    // Blend grain with final color
                    vec3 grainColor = uGrainColor * (grain * 0.5 + 0.5); // Remap grain to [0, 1]
                    finalColor = mix(finalColor, grainColor, uGrainIntensity);
                }
                
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
            uDebugMode: this.gl.getUniformLocation(this.program, 'uDebugMode'),
            
            // Terrain colors (4-color system only)
            uColor1: this.gl.getUniformLocation(this.program, 'uColor1'),
            uColor2: this.gl.getUniformLocation(this.program, 'uColor2'),
            uColor3: this.gl.getUniformLocation(this.program, 'uColor3'),
            uColor4: this.gl.getUniformLocation(this.program, 'uColor4'),
            uThreshold1: this.gl.getUniformLocation(this.program, 'uThreshold1'),
            uThreshold2: this.gl.getUniformLocation(this.program, 'uThreshold2'),
            uThreshold3: this.gl.getUniformLocation(this.program, 'uThreshold3'),
            
            // Contour line configuration - threshold-aligned
            uContourLinesEnabled: this.gl.getUniformLocation(this.program, 'uContourLinesEnabled'),
            uContourLinesWidth: this.gl.getUniformLocation(this.program, 'uContourLinesWidth'),
            uContourLinesIntensity: this.gl.getUniformLocation(this.program, 'uContourLinesIntensity'),
            uContourLinesColor: this.gl.getUniformLocation(this.program, 'uContourLinesColor'),
            
            // Grain texture overlay uniforms
            uGrainTextureEnabled: this.gl.getUniformLocation(this.program, 'uGrainTextureEnabled'),
            uGrainIntensity: this.gl.getUniformLocation(this.program, 'uGrainIntensity'),
            uGrainScale: this.gl.getUniformLocation(this.program, 'uGrainScale'),
            uGrainSpeed: this.gl.getUniformLocation(this.program, 'uGrainSpeed'),
            uGrainContrast: this.gl.getUniformLocation(this.program, 'uGrainContrast'),
            uGrainColor: this.gl.getUniformLocation(this.program, 'uGrainColor'),
            uGrainAnimated: this.gl.getUniformLocation(this.program, 'uGrainAnimated'),
            
            uResolution: this.gl.getUniformLocation(this.program, 'uResolution'),
            uCircularMask: this.gl.getUniformLocation(this.program, 'uCircularMask'),
            uViewportRadius: this.gl.getUniformLocation(this.program, 'uViewportRadius'),
            uEdgeSoftness: this.gl.getUniformLocation(this.program, 'uEdgeSoftness'),
            
            // Spherical shading uniforms
            uSphericalShadingEnabled: this.gl.getUniformLocation(this.program, 'uSphericalShadingEnabled'),
            uSphericalShadingIntensity: this.gl.getUniformLocation(this.program, 'uSphericalShadingIntensity'),
            uLightDirection: this.gl.getUniformLocation(this.program, 'uLightDirection'),
            
            // Fragment shader rotation matrix
            uFragmentRotationMatrix: this.gl.getUniformLocation(this.program, 'uRotationMatrix')
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
        
        // Debug: Log rotation matrix changes (disabled for performance)
        // if (Math.floor(this.currentRotation.y * 10) % 60 === 0) {
        //     console.log('=== ROTATION MATRIX DIAGNOSTICS ===');
        //     console.log('Rotation Y (radians):', this.currentRotation.y.toFixed(3));
        //     console.log('cos(Y):', cosY.toFixed(3));
        //     console.log('sin(Y):', sinY.toFixed(3));
        //     console.log('Matrix[0] (cosY):', this.rotationMatrix[0].toFixed(3));
        //     console.log('Matrix[2] (sinY):', this.rotationMatrix[2].toFixed(3));
        //     console.log('Matrix[8] (-cosX*sinY):', this.rotationMatrix[8].toFixed(3));
        //     console.log('Matrix[10] (cosX*cosY):', this.rotationMatrix[10].toFixed(3));
        //     console.log('==================================');
        // }
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
            
            // Comprehensive rotation diagnostics (disabled for performance)
            // if (Math.floor(this.currentRotation.y * 10) % 30 === 0) { // Every 30 frames
            //     console.log('=== ROTATION DIAGNOSTICS ===');
            //     console.log('Rotation Y:', this.currentRotation.y.toFixed(3), 'radians');
            //     console.log('Rotation Y:', (this.currentRotation.y * 180 / Math.PI).toFixed(1), 'degrees');
            //     console.log('Auto-rotate speed:', this.config.autoRotateSpeed);
            //     console.log('Delta time:', deltaTime.toFixed(4), 'seconds');
            //     console.log('Frame rate:', (1 / deltaTime).toFixed(1), 'FPS');
            //     console.log('Rotation matrix Y component:', this.rotationMatrix[2].toFixed(3));
            //     console.log('===========================');
            // }
        }

        const elapsedTime = (Date.now() - this.startTime) / 1000;

        // Animation state diagnostics (disabled for performance)
        // if (Math.floor(elapsedTime * 10) % 50 === 0) { // Every 5 seconds
        //     console.log('=== ANIMATION STATE DIAGNOSTICS ===');
        //     console.log('Elapsed time:', elapsedTime.toFixed(1), 'seconds');
        //     console.log('Elevation animation enabled:', this.config.elevationAnimation.enabled);
        //     console.log('Elevation animation speed:', this.config.elevationAnimation.speed);
        //     console.log('Elevation animation amplitude:', this.config.elevationAnimation.amplitude);
        //     console.log('Auto-rotate enabled:', this.config.autoRotate);
        //     console.log('Auto-rotate speed:', this.config.autoRotateSpeed);
        //     console.log('Noise frequency:', this.config.noiseFrequency);
        //     console.log('Noise octaves:', this.config.noiseOctaves);
        //     console.log('Noise persistence:', this.config.noisePersistence);
        //     console.log('Terrain seed:', this.config.terrainSeed);
        //     console.log('==================================');
        // }

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
        this.gl.uniform1i(this.uniforms.uDebugMode, 1); // Enable debug mode
        
        // Shader uniform diagnostics (disabled for performance)
        // if (Math.floor(elapsedTime * 60) % 100 === 0) {
        //     console.log('=== SHADER UNIFORM DIAGNOSTICS ===');
        //     console.log('uEnableElevationAnimation:', this.config.elevationAnimation.enabled ? 1 : 0);
        //     console.log('uElevationAnimationSpeed:', this.config.elevationAnimation.speed);
        //     console.log('uElevationAnimationAmplitude:', this.config.elevationAnimation.amplitude);
        //     console.log('uTime:', elapsedTime.toFixed(3));
        //     console.log('uNoiseFrequency:', this.config.noiseFrequency);
        //     console.log('uNoiseOctaves:', this.config.noiseOctaves);
        //     console.log('uNoisePersistence:', this.config.noisePersistence);
        //     console.log('uTerrainSeed:', this.config.terrainSeed);
        //     console.log('Rotation matrix passed to fragment shader: YES');
        //     console.log('==================================');
        // }

        // Layer thresholds - simplified to only 4-color system
        this.gl.uniform1f(this.uniforms.uThreshold1, this.config.elevationThresholds.threshold1);
        this.gl.uniform1f(this.uniforms.uThreshold2, this.config.elevationThresholds.threshold2);
        this.gl.uniform1f(this.uniforms.uThreshold3, this.config.elevationThresholds.threshold3);

        // Terrain colors - simplified to only 4-color system
        const colors = this.config.terrainColors;
        this.gl.uniform3f(this.uniforms.uColor1, ...colors.color1);
        this.gl.uniform3f(this.uniforms.uColor2, ...colors.color2);
        this.gl.uniform3f(this.uniforms.uColor3, ...colors.color3);
        this.gl.uniform3f(this.uniforms.uColor4, ...colors.color4);

        // Contour line configuration - threshold-aligned
        this.gl.uniform1i(this.uniforms.uContourLinesEnabled, this.config.contourLines.enabled ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uContourLinesWidth, this.config.contourLines.width);
        this.gl.uniform1f(this.uniforms.uContourLinesIntensity, this.config.contourLines.intensity);
        this.gl.uniform3f(this.uniforms.uContourLinesColor, ...this.config.contourLines.color);

        // Viewport configuration
        this.gl.uniform1i(this.uniforms.uCircularMask, this.config.circularViewport ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uViewportRadius, this.config.viewportRadius);
        this.gl.uniform1f(this.uniforms.uEdgeSoftness, this.config.edgeSoftness);

        // Spherical shading configuration
        this.gl.uniform1i(this.uniforms.uSphericalShadingEnabled, this.config.sphericalShading.enabled ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uSphericalShadingIntensity, this.config.sphericalShading.intensity);
        this.gl.uniform3f(this.uniforms.uLightDirection, ...this.config.sphericalShading.lightDirection);
        
        // Grain texture overlay configuration
        this.gl.uniform1i(this.uniforms.uGrainTextureEnabled, this.config.grainTexture.enabled ? 1 : 0);
        this.gl.uniform1f(this.uniforms.uGrainIntensity, this.config.grainTexture.intensity);
        this.gl.uniform1f(this.uniforms.uGrainScale, this.config.grainTexture.scale);
        this.gl.uniform1f(this.uniforms.uGrainSpeed, this.config.grainTexture.speed);
        this.gl.uniform1f(this.uniforms.uGrainContrast, this.config.grainTexture.contrast);
        this.gl.uniform3f(this.uniforms.uGrainColor, ...this.config.grainTexture.color);
        this.gl.uniform1i(this.uniforms.uGrainAnimated, this.config.grainTexture.animated ? 1 : 0);
        
        // Pass rotation matrix to fragment shader for texture coordinate transformation
        this.gl.uniformMatrix4fv(this.uniforms.uFragmentRotationMatrix, false, this.rotationMatrix);

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

    // Get available presets
    static getPresets() {
        return Object.keys(PRESETS);
    }

    // Get preset configuration
    static getPresetConfig(presetName) {
        return PRESETS[presetName] || null;
    }
}

// Export for module usage
export { TopologyRenderer }; 