#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform float uTimeScale;
uniform float uIterations;
uniform float uWaveAmplitude;
uniform float uOpacity;
uniform float uPosterizeLevels;

out vec4 fragColor;

void main() {
    // Normalize coordinates to centered, aspect-corrected space
    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);
    
    // Apply time scaling for animation control
    float scaledTime = uTime * uTimeScale;
    
    // Store original UV for vignette calculation
    vec2 originalUv = uv;
    
    // Iterative wave distortion - the core algorithm
    for(float i = 1.0; i < uIterations; i++) {
        uv.x += uWaveAmplitude / i * cos(i * 2.5 * uv.y + scaledTime);
        uv.y += uWaveAmplitude / i * cos(i * 1.5 * uv.x + scaledTime);
    }
    
    // Calculate color intensity based on distorted coordinates
    float intensity = abs(sin(scaledTime - uv.x - uv.y));
    
    // Apply subtle vignette effect
    float vignette = 1.0 - length(originalUv) * 0.15;
    intensity *= vignette;
    
    // Better intensity distribution using smoothstep remapping
    // This spreads values more evenly across the 0-1 range
    intensity = smoothstep(0.1, 0.9, intensity);
    
    // Posterize the intensity for clean color boundaries
    intensity = floor(intensity * uPosterizeLevels) / uPosterizeLevels;
    
    // Simple 6-color gradient mapping with equal segments
    vec3 finalColor;
    float segment = intensity * 5.0; // Map to 0-5 range
    
    if (segment < 1.0) {
        finalColor = mix(uColor1, uColor2, segment);
    } else if (segment < 2.0) {
        finalColor = mix(uColor2, uColor3, segment - 1.0);
    } else if (segment < 3.0) {
        finalColor = mix(uColor3, uColor4, segment - 2.0);
    } else if (segment < 4.0) {
        finalColor = mix(uColor4, uColor5, segment - 3.0);
    } else {
        finalColor = mix(uColor5, uColor6, segment - 4.0);
    }
    
    fragColor = vec4(finalColor, uOpacity);
} 