# Electron Landing Page with Responsive Marbling Texture

## 1. General Structure

- **Framework**: Electron (desktop app)
- **UI**:
  - Fullscreen landing page
  - Animated, responsive marbling texture background (WebGL/Three.js)
  - Centered modal dialog for workspace directory selection

## 2. Marbling Texture Background

- **Implementation**: Use Three.js to render a flat plane filling the viewport.
- **Texture**: Procedurally generated, animated marbling effect using a custom fragment shader (GLSL) or a prebuilt shader.
- **Animation**: Animate the marbling effect using a `time` uniform in the shader.
- **Responsiveness**:
  - The WebGL canvas should resize dynamically to fill the window and maintain high resolution across devices.
  - The marbling pattern should scale or adapt to different aspect ratios and window sizes.
- **Configurability**:
  - Expose options (via code or UI) for:
    - Marbling "physics" (e.g., flow speed, turbulence, viscosity)
    - Color palette (primary, secondary, accent colors)
    - Pattern scale/intensity
  - Use a configuration object or UI controls for real-time tweaking.

## 3. Modal Dialog

- **Positioning**: Vertically and horizontally centered over the marbling background.
- **Functionality**:
  - Title and description (e.g., "Select Workspace Directory")
  - Button to open system file/directory picker (Electron dialog)
  - Display selected directory path
  - Confirm/continue button
- **Styling**:
  - Simple, clean modal with slight background blur or semi-transparency to reveal marbling beneath.
  - Responsive layout for different window sizes.

## 4. Integration and Responsiveness

- **WebGL Canvas**:
  - Should always fill the window and respond to resize events.
  - Maintain performance (consider limiting pixel ratio for very high-res screens).
- **Modal**:
  - Should remain centered regardless of window size.
  - Should be accessible (keyboard navigation, focus management).

## 5. Configuration Example

Provide a JSON or JS object for marbling settings, e.g.:
