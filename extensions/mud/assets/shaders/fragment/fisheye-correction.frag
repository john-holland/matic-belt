uniform float strength;      // Strength of the correction (0.0 to 1.0)
uniform vec2 center;        // Center point of the distortion
uniform float aspectRatio;  // Aspect ratio of the screen

varying vec2 vUv;

void main() {
    // Calculate normalized coordinates relative to center
    vec2 uv = vUv - center;
    
    // Adjust for aspect ratio
    uv.x *= aspectRatio;
    
    // Calculate distance from center
    float dist = length(uv);
    
    // Apply inverse fisheye transformation
    float factor = 1.0;
    if (dist > 0.0) {
        // Inverse fisheye formula
        float theta = atan(dist);
        float r = tan(theta * (1.0 - strength));
        factor = r / dist;
    }
    
    // Apply correction
    uv *= factor;
    
    // Restore aspect ratio
    uv.x /= aspectRatio;
    
    // Restore center offset
    uv += center;
    
    // Sample the texture with corrected coordinates
    gl_FragColor = texture2D(tDiffuse, uv);
    
    // Handle out-of-bounds pixels
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
} 