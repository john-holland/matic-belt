uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    // Create portal ring effect
    float ring = smoothstep(0.4, 0.5, length(vUv - 0.5));
    ring *= smoothstep(0.5, 0.4, length(vUv - 0.5));
    
    // Add time-based animation
    float time = uTime * 2.0;
    float wave = sin(vUv.x * 10.0 + time) * 0.5 + 0.5;
    wave *= sin(vUv.y * 10.0 + time) * 0.5 + 0.5;
    
    // Create glow effect
    float glow = pow(1.0 - length(vUv - 0.5), 2.0);
    glow *= wave;
    
    // Combine effects
    vec3 color = mix(uColor, vec3(1.0), glow * uIntensity);
    color *= ring;
    
    // Add edge glow
    float edge = smoothstep(0.45, 0.5, length(vUv - 0.5));
    color += edge * uColor * 2.0;
    
    gl_FragColor = vec4(color, ring);
} 