# Interactive Marbling Shader Implementation Outline for Cosmo Landing Page

## Overview

Implementation plan for adding a responsive, interactive WebGL marbling shader/graphic as a background effect behind the workspace selection tile on the Cosmo landing page.

## Project Context

- **Target**: Cosmo landing page (`#landing-page` in `src/renderer/index.html`)
- **Current State**: Simple landing page with workspace selection button
- **Goal**: Add sophisticated marbling animation background while maintaining performance and accessibility

## Technical Approach

### 1. Shader Technology Selection

#### Option A: WebGL with GLSL (Recommended)

- **Pros**: Wide browser support, mature ecosystem, extensive documentation
- **Cons**: More verbose setup, limited compute capabilities
- **Best For**: Production deployment, cross-browser compatibility

#### Option B: WebGPU with WGSL (Future-Forward)

- **Pros**: Modern API, compute shaders, better performance
- **Cons**: Limited browser support (Chrome only currently)
- **Best For**: Cutting-edge demos, future-proofing

**Recommendation**: Start with WebGL/GLSL for immediate deployment, with WebGPU migration path planned.

### 2. Marbling Simulation Techniques

#### Core Algorithms

1. **Mathematical Marbling** (Fast, Direct)

   - Closed-form transformations
   - No physics simulation needed
   - Based on Aubrey Jaffer's work
   - Perfect for background effects

2. **Fluid Simulation** (Rich, Dynamic)

   - BiMocq2 or Stable Fluids
   - Physics-based particle/velocity fields
   - More computationally expensive
   - Better for interactive effects

3. **Hybrid Approach** (Recommended)
   - Mathematical base patterns
   - Curl noise for organic movement
   - Procedural distortion fields
   - Balance of performance and visual quality

#### Specific Techniques

- **Curl Noise**: For turbulent, organic movement
- **Domain Warping**: For complex pattern generation
- **Signed Distance Fields (SDF)**: For shape creation and manipulation
- **Feedback Loops**: For evolving patterns over time

### 3. Implementation Architecture

#### File Structure

```
src/renderer/
├── shaders/
│   ├── marbling/
│   │   ├── vertex.glsl
│   │   ├── fragment.glsl
│   │   ├── noise.glsl (utility functions)
│   │   └── sdf.glsl (distance field functions)
├── js/
│   ├── marbling/
│   │   ├── MarblingRenderer.js (main class)
│   │   ├── ShaderLoader.js (utility)
│   │   └── MarblingConfig.js (parameters)
└── styles/
    └── marbling.css (canvas positioning)
```

#### Core Components

##### MarblingRenderer Class

```javascript
class MarblingRenderer {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2");
    this.config = { ...defaultConfig, ...config };
    this.uniforms = {};
    this.animationId = null;

    this.init();
  }

  async init() {
    await this.loadShaders();
    this.setupGeometry();
    this.setupUniforms();
    this.resize();
    this.start();
  }

  // Core methods...
}
```

### 4. Shader Implementation Details

#### Vertex Shader (Simple Fullscreen Quad)

```glsl
#version 300 es
in vec2 position;
out vec2 vUv;

void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
```

#### Fragment Shader (Marbling Logic)

```glsl
#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform float uAnimationSpeed;

in vec2 vUv;
out vec4 fragColor;

// Include noise functions
#include "noise.glsl"

// Include SDF functions
#include "sdf.glsl"

// Main marbling function
vec3 marbling(vec2 uv) {
    // 1. Base coordinate transformation
    vec2 coord = uv * 2.0 - 1.0;
    coord *= uResolution.y / uResolution.x; // aspect correction

    // 2. Time-based animation
    float t = uTime * uAnimationSpeed;

    // 3. Curl noise field generation
    vec2 curlField = curl(coord * 0.5 + t * 0.1);

    // 4. Domain warping
    coord += curlField * 0.3;

    // 5. Mouse interaction
    vec2 mousePos = (uMouse / uResolution) * 2.0 - 1.0;
    float mouseDistance = length(coord - mousePos);
    coord += (coord - mousePos) * uMouseInfluence / (mouseDistance + 1.0);

    // 6. Pattern generation
    float pattern1 = marble(coord * 2.0 + curlField);
    float pattern2 = marble(coord * 1.5 - curlField * 0.5);

    // 7. Color mapping
    vec3 color1 = vec3(0.2, 0.4, 0.8); // Blue tones
    vec3 color2 = vec3(0.8, 0.6, 0.3); // Warm tones
    vec3 color3 = vec3(0.1, 0.2, 0.3); // Dark base

    vec3 finalColor = mix(color3, color1, pattern1);
    finalColor = mix(finalColor, color2, pattern2 * 0.7);

    return finalColor;
}

void main() {
    vec3 color = marbling(vUv);

    // Subtle vignette
    float vignette = 1.0 - length(vUv - 0.5) * 0.8;
    color *= vignette;

    fragColor = vec4(color, 1.0);
}
```

### 5. Performance Considerations

#### Optimization Strategies

1. **Resolution Scaling**: Render at lower resolution, upscale with CSS
2. **Level of Detail**: Reduce complexity based on device capabilities
3. **Frame Rate Control**: Adaptive frame rate based on performance
4. **Shader Simplification**: Multiple shader variants for different devices

#### Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }

  update() {
    this.frameCount++;
    const currentTime = performance.now();

    if (currentTime - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Adjust quality based on FPS
      this.adjustQuality();
    }
  }

  adjustQuality() {
    if (this.fps < 30) {
      // Reduce quality
    } else if (this.fps > 55) {
      // Increase quality
    }
  }
}
```

### 6. Integration with Cosmo Landing Page

#### HTML Structure Modification

```html
<!-- Landing Page -->
<div id="landing-page" class="landing-page">
  <!-- New marbling canvas background -->
  <canvas id="marbling-canvas" class="marbling-background"></canvas>

  <!-- Existing content with updated styling -->
  <div class="landing-content">
    <h1>Welcome to Cosmo</h1>
    <p>Please select a workspace directory to begin</p>
    <button id="landing-workspace-btn" class="primary-btn">
      Select Workspace
    </button>
  </div>
</div>
```

#### CSS Integration

```css
.landing-page {
  position: relative;
  /* existing styles... */
}

.marbling-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  opacity: 0.3; /* Subtle background effect */
  filter: blur(1px); /* Slight blur for background feel */
}

.landing-content {
  position: relative;
  z-index: 2;
  /* ensure content appears above marbling */
  background: rgba(var(--surface-bg-elevated-rgb), 0.9);
  backdrop-filter: blur(8px);
  /* existing styles... */
}
```

#### JavaScript Integration

```javascript
// In app.js, modify the landing page initialization
class CosmoApp {
  constructor() {
    // existing code...
    this.marblingRenderer = null;
  }

  async init() {
    // existing code...

    // Initialize marbling when landing page is shown
    if (!this.workspacePath) {
      document.getElementById("landing-page").style.display = "flex";
      await this.initMarbling();
      // existing event listeners...
    }
  }

  async initMarbling() {
    const canvas = document.getElementById("marbling-canvas");
    if (canvas && !this.marblingRenderer) {
      this.marblingRenderer = new MarblingRenderer(canvas, {
        animationSpeed: 0.3,
        mouseInfluence: 0.2,
        colorScheme: "cosmo", // Custom color scheme
        quality: "auto", // Auto-adjust based on device
      });
    }
  }

  destroyMarbling() {
    if (this.marblingRenderer) {
      this.marblingRenderer.destroy();
      this.marblingRenderer = null;
    }
  }
}
```

### 7. Interactive Features

#### Mouse/Touch Interaction

- **Mouse Position**: Real-time cursor tracking for distortion effects
- **Click Ripples**: Expanding circles of distortion on click/tap
- **Drag Effects**: Trailing distortion following mouse movement
- **Velocity Influence**: Mouse movement speed affects pattern intensity

#### Animation Presets

- **Subtle**: Slow, gentle movement for minimal distraction
- **Dynamic**: More active patterns for engaging backgrounds
- **Interactive**: High responsiveness to user input
- **Ambient**: Very slow, meditative patterns

### 8. Accessibility & User Experience

#### Accessibility Considerations

- **Reduced Motion**: Respect `prefers-reduced-motion` media query
- **Contrast**: Ensure text readability over marbling background
- **Performance**: Graceful degradation on low-end devices
- **Color Accessibility**: Avoid problematic color combinations

#### UX Implementation

```css
@media (prefers-reduced-motion: reduce) {
  .marbling-background {
    animation-play-state: paused;
    opacity: 0.1;
  }
}

@media (max-width: 768px) {
  .marbling-background {
    opacity: 0.2; /* Reduce intensity on mobile */
  }
}
```

### 9. Configuration & Customization

#### MarblingConfig.js

```javascript
export const defaultConfig = {
  // Performance
  targetFPS: 60,
  maxPixelRatio: 2,
  autoQuality: true,

  // Visual
  colorScheme: {
    primary: [0.2, 0.4, 0.8],
    secondary: [0.8, 0.6, 0.3],
    background: [0.1, 0.2, 0.3],
  },
  opacity: 0.3,
  blur: 1,

  // Animation
  animationSpeed: 0.3,
  patternScale: 2.0,
  noiseOctaves: 4,

  // Interaction
  mouseInfluence: 0.2,
  touchRadius: 100,
  rippleDecay: 0.95,
};

export const presets = {
  subtle: { animationSpeed: 0.1, opacity: 0.2 },
  dynamic: { animationSpeed: 0.5, opacity: 0.4 },
  interactive: { mouseInfluence: 0.5, touchRadius: 150 },
};
```

### 10. Development Phases

#### Phase 1: Core Implementation (Week 1)

- [ ] Set up basic WebGL context and shader loading
- [ ] Implement simple marbling fragment shader
- [ ] Add basic time-based animation
- [ ] Integrate with landing page HTML/CSS

#### Phase 2: Enhancement (Week 2)

- [ ] Add mouse interaction
- [ ] Implement curl noise and domain warping
- [ ] Add multiple color schemes
- [ ] Performance optimization and device detection

#### Phase 3: Polish (Week 3)

- [ ] Accessibility features
- [ ] Mobile optimization
- [ ] Configuration system
- [ ] Error handling and fallbacks

#### Phase 4: Advanced Features (Week 4)

- [ ] Multiple marbling patterns/presets
- [ ] Advanced interaction modes
- [ ] WebGPU migration preparation
- [ ] Documentation and testing

### 11. Fallback Strategy

#### Progressive Enhancement

1. **No WebGL**: Static CSS gradient background
2. **Basic WebGL**: Simple animated gradient
3. **Full WebGL**: Complete marbling implementation
4. **WebGPU** (future): Enhanced performance and effects

#### Error Handling

```javascript
class MarblingRenderer {
  static isSupported() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!gl;
  }

  constructor(canvas, config) {
    if (!MarblingRenderer.isSupported()) {
      this.fallbackToCSS();
      return;
    }
    // ... normal initialization
  }

  fallbackToCSS() {
    this.canvas.style.background = `
      linear-gradient(45deg, 
        rgba(32, 64, 128, 0.3) 0%, 
        rgba(128, 96, 48, 0.3) 100%)
    `;
  }
}
```

### 12. Performance Targets

#### Target Specifications

- **Desktop**: 60 FPS on integrated graphics (Intel Iris, AMD Vega)
- **Mobile**: 30 FPS on mid-range devices (iPhone 12, Pixel 5)
- **Low-end**: Graceful degradation with static fallback

#### Memory Usage

- **GPU Memory**: < 50MB texture memory
- **RAM**: < 20MB JavaScript heap
- **Shader Compilation**: < 500ms initial load

### 13. Testing Strategy

#### Cross-Browser Testing

- Chrome/Edge (WebGL 2.0)
- Firefox (WebGL 2.0)
- Safari (WebGL 1.0 fallback)
- Mobile browsers

#### Performance Testing

- Frame rate monitoring
- GPU memory usage
- Battery impact on mobile
- Thermal throttling behavior

### 14. Future Enhancements

#### Potential Additions

- **Audio Reactivity**: Respond to system audio or microphone
- **Workspace Theme Integration**: Colors based on workspace content
- **Seasonal Variations**: Different patterns for time of year
- **User Customization**: Settings panel for personalization
- **WebGPU Migration**: Enhanced performance and compute shaders

## Aesthetic Variations & Alternative Implementations

### High-End Interactive Marbling Examples

#### Amanda Ghassaei's Digital Marbling

- **URL**: https://apps.amandaghassaei.com/marbling-experiment/
- **Description**: Physics-based marbling simulation using mathematical transformations
- **Key Features**: BiMocq2 fluid solver, curl noise, area-preserving transformations
- **Aesthetic**: Clean, scientific approach with traditional marbling patterns
- **Fit for Cosmo**: Professional, sophisticated look suitable for workspace branding
- **Implementation Notes**: Hybrid mathematical/physics approach, excellent for inspiration

#### Yuichiroh Arai Fluid Experiments

- **URL**: https://www.yuichiroharai.com/experiments/fluid/
- **Description**: Minimalist fluid interactions with pointer/webcam control
- **Key Features**: Real-time interaction, clean UI, subtle animations
- **Aesthetic**: Minimal, elegant, user-focused design
- **Fit for Cosmo**: Perfect aesthetic match for productivity-focused brand

### Advanced WebGPU Implementations

#### Hector Arellano's WebGPU Fluids

- **Reference**: Codrops article "A Journey into WebGPU Fluids"
- **Description**: Advanced particle-based fluid with marching cubes surface generation
- **Key Features**: 300K+ particles, real-time surface generation, subsurface scattering
- **Aesthetic**: High-end, cinematic quality with sophisticated materials
- **Fit for Cosmo**: Premium feel, could be adapted with subtler parameters for background use
- **Performance Note**: Requires high-end GPUs, good reference for future WebGPU migration

#### GPU Particle Systems

- **URL**: https://www.cake23.de/particle-emitter-drawing-animation.html
- **Description**: Basic GPU particle systems with drawing animation capabilities
- **Key Features**: Blur/gradient compositing, real-time particle spawning, FPS limiting
- **Aesthetic**: Abstract, organic, flowing motion with customizable intensity
- **Fit for Cosmo**: Could work well as subtle background texture when toned down

### Minimalist & Professional Approaches

#### Subtle Animated Gradients

- **Reference**: Professional motion graphics collections
- **Description**: Soft, slowly animated color transitions optimized for corporate use
- **Key Features**: Smooth blending, corporate-friendly palettes, subtle motion
- **Aesthetic**: Professional, calming, non-distracting
- **Fit for Cosmo**: Excellent for workspace environments - maintains focus while adding sophistication

#### Mathematical Marbling (Jonas Luebbers)

- **URL**: http://marbled-paper.glitch.me/
- **Description**: WebGL implementation of Mathematical Marbling techniques
- **Key Features**: Real-time pattern generation, interactive controls, educational interface
- **Aesthetic**: Clean, geometric, mathematically precise
- **Fit for Cosmo**: Good baseline for simpler, performance-optimized implementations

### Modern Web Animation Techniques

#### Award-Winning Website Animations

- **Reference**: Various Awwwards and design showcase sites
- **Key Techniques**: Scroll-triggered reveals, smooth transitions, micro-interactions
- **Features**: GSAP ScrollTrigger, Lenis smooth scrolling, WebGL integration
- **Aesthetic**: Modern, engaging, performance-conscious
- **Fit for Cosmo**: Great reference for implementation patterns and interaction design

#### Liquid Motion Effects

- **Description**: Organic fluid-inspired animations for web interfaces
- **Key Features**: Morphing shapes, color transitions, smooth transformations
- **Aesthetic**: Organic, flowing, contemporary
- **Fit for Cosmo**: Could provide subtle organic contrast to geometric workspace UI

### Color Palette & Brand Alignment Recommendations

#### Primary Recommendation: Subtle Professional Flow

Based on Cosmo's focus on productivity and workspace organization:

**Visual Characteristics:**

- Soft, slowly animated gradients in professional color palettes
- Low-contrast, muted tones that don't compete with UI elements
- Gentle, non-distracting motion that enhances rather than dominates
- Responsive to user interaction without being overwhelming

**Suggested Color Palettes:**

- **Deep Blue Series**: #1a365d → #2d5a87 → #4a90b8 (productivity, focus, trust)
- **Neutral Warm**: #f7f4f0 → #e8dcc0 → #d4c5a0 (cleanliness, warmth, organization)
- **Subtle Accent**: #6b8fb5 → #7ea3c7 → #91b7d9 (gentle highlights that complement)

#### Secondary Options for A/B Testing

**Option A: Organic Mathematical**

- Traditional marbling patterns with muted colors
- Slow, predictable transformations
- High sophistication, low distraction

**Option B: Abstract Geometric Flow**

- Angular fluid simulations with rounded edges
- Modern, tech-forward aesthetic
- Subtle particle systems with geometric constraints

**Option C: Gradient Noise Fields**

- Perlin/simplex noise-based color transitions
- Very subtle, almost subliminal movement
- Minimal performance impact, maximum compatibility

### Implementation Priority for Cosmo Brand

1. **Immediate**: Subtle gradient flows with professional color palette
2. **Phase 2**: Add gentle interactive response to mouse movement
3. **Phase 3**: Introduce very low-intensity particle effects
4. **Future**: Advanced mathematical marbling patterns for premium feel

### Performance vs. Aesthetics Balance

**For Cosmo's Use Case:**

- Prioritize performance and battery life for productivity users
- Maintain 60fps on integrated graphics
- Ensure background never interferes with workspace functionality
- Provide easy disable option for users who prefer minimal interfaces

**Recommended Complexity Level:**

- Start with simple animated gradients (Week 1 delivery)
- Add curl noise effects if performance allows (Week 2)
- Consider particle systems only after thorough mobile testing (Week 3+)

## Featured Implementation: Organic Wave Pattern Shader

### Overview

This implementation focuses on a specific, highly optimized shader technique that creates organic, flowing wave patterns using iterative coordinate transformations. It's perfect for Cosmo's brand as it provides sophisticated visual appeal while maintaining excellent performance.

### Core Shader Implementation

#### Fragment Shader (Organic Waves)

```glsl
#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uBaseColor;
uniform float uTimeScale;
uniform float uIterations;
uniform float uWaveAmplitude;
uniform float uMouseInfluence;

in vec2 vUv;
out vec4 fragColor;

void main() {
    // Normalize coordinates to centered, aspect-corrected space
    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);

    // Apply time scaling for animation control
    float scaledTime = uTime * uTimeScale;

    // Mouse interaction (optional)
    if (uMouseInfluence > 0.0) {
        vec2 mousePos = (2.0 * uMouse - uResolution.xy) / min(uResolution.x, uResolution.y);
        float mouseDistance = length(uv - mousePos);
        float mouseEffect = uMouseInfluence / (1.0 + mouseDistance * 2.0);
        scaledTime += mouseEffect;
    }

    // Store original UV for color calculation
    vec2 originalUv = uv;

    // Iterative wave distortion - the core algorithm
    for(float i = 1.0; i < uIterations; i++) {
        uv.x += uWaveAmplitude / i * cos(i * 2.5 * uv.y + scaledTime);
        uv.y += uWaveAmplitude / i * cos(i * 1.5 * uv.x + scaledTime);
    }

    // Calculate color intensity based on distorted coordinates
    float intensity = abs(sin(scaledTime - uv.x - uv.y));

    // Apply subtle vignette effect
    float vignette = 1.0 - length(originalUv) * 0.3;
    intensity *= vignette;

    // Final color calculation
    vec3 finalColor = uBaseColor * intensity;

    fragColor = vec4(finalColor, 1.0);
}
```

### JavaScript Integration

#### Enhanced MarblingRenderer for Organic Waves

```javascript
class OrganicWaveRenderer {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

    // Default configuration optimized for Cosmo brand
    this.config = {
      // Visual parameters
      baseColor: [0.2, 0.4, 0.7], // Professional blue
      timeScale: 0.08, // Slow, calming animation
      iterations: 8.0, // Balanced quality/performance
      waveAmplitude: 0.6, // Moderate wave intensity

      // Interaction
      mouseInfluence: 0.1, // Subtle mouse response

      // Performance
      targetFPS: 60,
      pixelRatio: Math.min(window.devicePixelRatio, 2),

      // Brand-specific presets
      ...config,
    };

    this.uniforms = {};
    this.program = null;
    this.animationId = null;
    this.startTime = Date.now();

    this.init();
  }

  async init() {
    if (!this.gl) {
      console.warn("WebGL not supported, falling back to CSS");
      this.fallbackToCSS();
      return;
    }

    await this.setupShaders();
    this.setupGeometry();
    this.setupUniforms();
    this.setupEventListeners();
    this.resize();
    this.start();
  }

  async setupShaders() {
    const vertexShaderSource = `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

    const fragmentShaderSource = `
            precision highp float;
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            uniform vec3 uBaseColor;
            uniform float uTimeScale;
            uniform float uIterations;
            uniform float uWaveAmplitude;
            uniform float uMouseInfluence;
            
            void main() {
                vec2 uv = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);
                float scaledTime = uTime * uTimeScale;
                
                // Mouse interaction
                if (uMouseInfluence > 0.0) {
                    vec2 mousePos = (2.0 * uMouse - uResolution.xy) / min(uResolution.x, uResolution.y);
                    float mouseDistance = length(uv - mousePos);
                    float mouseEffect = uMouseInfluence / (1.0 + mouseDistance * 2.0);
                    scaledTime += mouseEffect;
                }
                
                vec2 originalUv = uv;
                
                // Core wave algorithm
                for(float i = 1.0; i < uIterations; i++) {
                    uv.x += uWaveAmplitude / i * cos(i * 2.5 * uv.y + scaledTime);
                    uv.y += uWaveAmplitude / i * cos(i * 1.5 * uv.x + scaledTime);
                }
                
                float intensity = abs(sin(scaledTime - uv.x - uv.y));
                float vignette = 1.0 - length(originalUv) * 0.3;
                intensity *= vignette;
                
                vec3 finalColor = uBaseColor * intensity;
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
  }

  setupGeometry() {
    // Full-screen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(
      this.program,
      "position"
    );
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }

  setupUniforms() {
    this.uniforms = {
      uTime: this.gl.getUniformLocation(this.program, "uTime"),
      uResolution: this.gl.getUniformLocation(this.program, "uResolution"),
      uMouse: this.gl.getUniformLocation(this.program, "uMouse"),
      uBaseColor: this.gl.getUniformLocation(this.program, "uBaseColor"),
      uTimeScale: this.gl.getUniformLocation(this.program, "uTimeScale"),
      uIterations: this.gl.getUniformLocation(this.program, "uIterations"),
      uWaveAmplitude: this.gl.getUniformLocation(
        this.program,
        "uWaveAmplitude"
      ),
      uMouseInfluence: this.gl.getUniformLocation(
        this.program,
        "uMouseInfluence"
      ),
    };
  }

  setupEventListeners() {
    this.mousePos = [0, 0];

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos[0] = e.clientX - rect.left;
      this.mousePos[1] = rect.height - (e.clientY - rect.top); // Flip Y
    });

    window.addEventListener("resize", () => this.resize());
  }

  render() {
    const currentTime = (Date.now() - this.startTime) / 1000;

    this.gl.useProgram(this.program);

    // Update uniforms
    this.gl.uniform1f(this.uniforms.uTime, currentTime);
    this.gl.uniform2f(
      this.uniforms.uResolution,
      this.canvas.width,
      this.canvas.height
    );
    this.gl.uniform2f(this.uniforms.uMouse, this.mousePos[0], this.mousePos[1]);
    this.gl.uniform3f(this.uniforms.uBaseColor, ...this.config.baseColor);
    this.gl.uniform1f(this.uniforms.uTimeScale, this.config.timeScale);
    this.gl.uniform1f(this.uniforms.uIterations, this.config.iterations);
    this.gl.uniform1f(this.uniforms.uWaveAmplitude, this.config.waveAmplitude);
    this.gl.uniform1f(
      this.uniforms.uMouseInfluence,
      this.config.mouseInfluence
    );

    // Render
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    this.animationId = requestAnimationFrame(() => this.render());
  }

  // Utility methods...
  createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentSource
    );

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(
        "Program linking error:",
        this.gl.getProgramInfoLog(program)
      );
      return null;
    }

    return program;
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Shader compilation error:",
        this.gl.getShaderInfoLog(shader)
      );
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.config.pixelRatio;
    this.canvas.height = rect.height * this.config.pixelRatio;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    this.render();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Brand-specific presets
  static presets = {
    cosmoDefault: {
      baseColor: [0.2, 0.4, 0.7],
      timeScale: 0.08,
      iterations: 8.0,
      waveAmplitude: 0.6,
      mouseInfluence: 0.1,
    },

    cosmoSubtle: {
      baseColor: [0.15, 0.25, 0.4],
      timeScale: 0.05,
      iterations: 6.0,
      waveAmplitude: 0.4,
      mouseInfluence: 0.05,
    },

    cosmoEnergetic: {
      baseColor: [0.3, 0.5, 0.8],
      timeScale: 0.12,
      iterations: 10.0,
      waveAmplitude: 0.8,
      mouseInfluence: 0.2,
    },
  };
}
```

### Integration with Cosmo Landing Page

#### HTML Structure

```html
<!-- Add to src/renderer/index.html -->
<div id="landing-page" class="landing-container">
  <canvas id="organic-wave-canvas" class="organic-wave-background"></canvas>
  <div class="landing-content">
    <div class="workspace-selection">
      <!-- Existing workspace selection UI -->
    </div>
  </div>
</div>
```

#### CSS Styling

```css
/* Add to landing page styles */
.organic-wave-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  opacity: 0.6;
  pointer-events: none;
}

.landing-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* Accessibility and performance considerations */
@media (prefers-reduced-motion: reduce) {
  .organic-wave-background {
    opacity: 0.3;
    animation: none;
  }
}

@media (max-width: 768px) {
  .organic-wave-background {
    opacity: 0.4; /* Reduce intensity on mobile */
  }
}
```

#### Integration Code

```javascript
// Add to main renderer process
class CosmoApp {
  constructor() {
    this.organicWaveRenderer = null;
  }

  async initLandingPage() {
    const canvas = document.getElementById("organic-wave-canvas");
    if (canvas && !this.organicWaveRenderer) {
      // Use Cosmo's default preset
      this.organicWaveRenderer = new OrganicWaveRenderer(
        canvas,
        OrganicWaveRenderer.presets.cosmoDefault
      );
    }
  }

  showLandingPage() {
    document.getElementById("landing-page").style.display = "flex";
    this.initLandingPage();
  }

  hideLandingPage() {
    if (this.organicWaveRenderer) {
      this.organicWaveRenderer.stop();
    }
    document.getElementById("landing-page").style.display = "none";
  }
}
```

### Performance Characteristics

#### Why This Implementation is Perfect for Cosmo:

1. **Excellent Performance**: Simple algorithm, minimal GPU load
2. **Scalable Quality**: Adjustable iterations for different devices
3. **Professional Aesthetic**: Organic but controlled, sophisticated
4. **Brand Appropriate**: Calming, focus-enhancing rather than distracting
5. **Highly Customizable**: Easy to adjust colors, speed, intensity

#### Performance Metrics:

- **Desktop**: 60 FPS on integrated graphics
- **Mobile**: 30-60 FPS depending on device
- **Memory**: <10MB GPU memory usage
- **Battery Impact**: Minimal due to efficient algorithm

### Customization Options

#### Color Schemes for Different Moods:

```javascript
const colorSchemes = {
  focus: [0.2, 0.4, 0.7], // Deep blue for concentration
  calm: [0.15, 0.3, 0.45], // Muted blue-gray for relaxation
  energy: [0.3, 0.5, 0.8], // Brighter blue for motivation
  neutral: [0.25, 0.25, 0.3], // Gray for minimal distraction
};
```

This implementation provides the perfect balance of visual sophistication and performance optimization for Cosmo's productivity-focused brand identity.

## Implementation Resources

### Referenced Libraries & Frameworks

- **Three.js**: For WebGL abstraction (optional)
- **OGL**: Lightweight WebGL library alternative
- **glMatrix**: Mathematical operations
- **gpu.js**: GPU compute abstraction

### Shader References

- [Amanda Ghassaei's Digital Marbling](https://blog.amandaghassaei.com/2022/10/25/digital-marbling/)
- [Inigo Quilez SDF Functions](https://iquilezles.org/www/articles/distfunctions/distfunctions.htm)
- [Shadertoy Marbling Examples](https://www.shadertoy.com/results?query=marbling)
- [WebGL Fundamentals](https://webglfundamentals.org/)

### Performance References

- [PixelFree Studio WebGL Guide](https://blog.pixelfreestudio.com/how-to-use-glsl-shaders-in-webgl-for-advanced-3d-effects/)
- [Codrops WebGPU Tutorials](https://tympanus.net/codrops/tag/webgpu/)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

## Success Metrics

### Technical Success

- [ ] Maintains 60 FPS on target hardware
- [ ] Loads within 2 seconds
- [ ] No visual glitches or artifacts
- [ ] Graceful degradation on unsupported devices

### User Experience Success

- [ ] Enhances landing page visual appeal
- [ ] Doesn't interfere with workspace selection
- [ ] Passes accessibility audits
- [ ] Positive user feedback on visual quality

### Maintenance Success

- [ ] Clean, documented codebase
- [ ] Configurable parameters
- [ ] Easy to disable/modify
- [ ] Clear performance monitoring

This implementation plan provides a comprehensive roadmap for adding a sophisticated marbling shader background to the Cosmo landing page while maintaining performance, accessibility, and user experience standards.
