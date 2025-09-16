# Landing Page Configuration Refactor Plan

## Current State Analysis

### Configuration Distribution

Currently, aesthetic parameters are distributed across two files:

1. **`landing.js`** - Landing-specific overrides

   - Sphere radius, elevation scale, noise parameters
   - Terrain colors (4-color system)
   - Elevation thresholds
   - Animation settings (elevation animation)
   - Spherical shading parameters
   - Viewport settings

2. **`OrganicWaveRenderer.js`** - Default configuration
   - Base sphere geometry parameters
   - Default terrain colors (7-color system)
   - Default layer thresholds
   - Default animation settings
   - Default shading parameters

### Issues Identified

1. **Configuration Duplication**: Parameters are defined in both files with different defaults
2. **Inconsistent Color Systems**: Landing uses 4 colors, renderer defaults to 7 colors
3. **Rotation Problem**: Sphere appears to "jiggle" instead of rotating smoothly
4. **Parameter Override Complexity**: Landing config overrides renderer defaults, creating confusion

## Root Cause Analysis

### Rotation Issue

The current rotation implementation has several problems:

1. **Elevation Animation Interference**: The `elevationAnimation` is adding noise displacement to the terrain, which creates the "jiggling" effect
2. **Noise Position Animation**: The fragment shader is animating the noise position, which moves the terrain texture around the sphere
3. **Rotation vs. Texture Animation**: The sphere geometry rotates, but the texture also animates independently

### Configuration Architecture Issues

1. **Mixed Responsibilities**: Both files define similar parameters
2. **Override Complexity**: Landing config must override renderer defaults
3. **Maintenance Burden**: Changes require updates in multiple places

## Proposed Solution

### 1. Configuration Consolidation

**Move all aesthetic parameters to `OrganicWaveRenderer.js`** and create preset configurations:

```javascript
// In OrganicWaveRenderer.js
const PRESETS = {
  landing: {
    sphereRadius: 1.0,
    elevationScale: 0.85,
    noiseOctaves: 3,
    noiseFrequency: 5,
    noisePersistence: 0.2,
    terrainSeed: 4,
    terrainColors: {
      color1: [0.05, 0.05, 0.05],
      color2: [0.31, 0.98, 0.62],
      color3: [0.28, 0.85, 0.55],
      color4: [0.45, 0.95, 0.65],
    },
    elevationThresholds: {
      threshold1: 0.3,
      threshold2: 0.5,
      threshold3: 0.8,
    },
    autoRotate: true,
    autoRotateSpeed: 0.3,
    elevationAnimation: {
      enabled: false, // Disable to fix rotation
      speed: 0.4,
      amplitude: 0.15,
    },
    sphericalShading: {
      enabled: true,
      intensity: 0.2,
      lightDirection: [0.5, 1.0, 0.5],
    },
    viewport: {
      circularViewport: true,
      viewportRadius: 1.0,
      edgeSoftness: 0.0,
    },
  },
  default: {
    // Current default configuration
  },
};
```

### 2. Simplified Landing Configuration

**Simplify `landing.js` to use preset selection**:

```javascript
// In landing.js
this.marblingRenderer = new OrganicWaveRenderer(canvas, "landing");
// or with minimal overrides
this.marblingRenderer = new OrganicWaveRenderer(canvas, {
  preset: "landing",
  overrides: {
    autoRotateSpeed: 0.5, // Only override specific values
  },
});
```

### 3. Fix Rotation Implementation

**Separate rotation from texture animation**:

1. **Disable elevation animation** for landing sphere
2. **Implement proper sphere rotation** using rotation matrix only
3. **Keep texture static** while sphere rotates

```javascript
// In OrganicWaveRenderer.js render() method
if (this.config.autoRotate) {
  // Only rotate the sphere geometry, not the texture
  this.currentRotation.y += this.config.autoRotateSpeed * deltaTime;
  this.updateRotationMatrix();
}

// In fragment shader, remove texture animation
// Remove or disable the noisePos animation in fragment shader
```

## Implementation Plan

### Phase 1: Configuration Consolidation

1. Create preset system in `OrganicWaveRenderer.js`
2. Move all landing parameters to landing preset
3. Update constructor to accept preset names
4. Simplify landing.js configuration

### Phase 2: Rotation Fix

1. Disable elevation animation in landing preset
2. Ensure rotation matrix properly rotates sphere geometry
3. Keep texture coordinates static during rotation
4. Test smooth rotation without jiggling

### Phase 3: Parameter Cleanup

1. Remove duplicate parameter definitions
2. Standardize color system (choose 4-color or 7-color)
3. Document preset system
4. Add preset validation

## Technical Considerations

### WebGL Best Practices

Based on research from [C# Corner](https://www.csharp.com/article/how-to-combine-multiple-inline-style-objects-in-reactjs/) and [GitHub examples](https://gist.github.com/loganpowell/2be75c1d0266d301fb1446ed14ebe7e6):

1. **Matrix Operations**: Use proper rotation matrices for smooth rotation
2. **Animation Separation**: Keep geometry rotation separate from texture animation
3. **Performance**: Minimize uniform updates during animation
4. **Configuration**: Use object spread for clean parameter merging

### Animation Architecture

1. **Geometry Rotation**: Apply rotation matrix to vertex positions
2. **Texture Stability**: Keep noise coordinates static
3. **Smooth Interpolation**: Use deltaTime for frame-rate independent rotation
4. **Preset System**: Allow easy switching between configurations

## Benefits of Proposed Solution

1. **Single Source of Truth**: All parameters in one place
2. **Easier Maintenance**: Changes only require updates in one file
3. **Preset System**: Reusable configurations for different use cases
4. **Smooth Rotation**: Proper sphere rotation without texture interference
5. **Clean Architecture**: Clear separation of concerns

## Migration Strategy

1. **Backward Compatibility**: Maintain current API during transition
2. **Gradual Migration**: Move parameters one category at a time
3. **Testing**: Verify each preset works correctly
4. **Documentation**: Update comments and documentation

## Success Criteria

1. **Smooth Rotation**: Sphere rotates smoothly without jiggling
2. **Configuration Clarity**: All parameters in one location
3. **Performance**: No degradation in rendering performance
4. **Maintainability**: Easier to modify and extend configurations
5. **Reusability**: Preset system supports multiple use cases
