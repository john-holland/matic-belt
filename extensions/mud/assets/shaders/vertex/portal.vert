varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // Apply portal distortion
    float time = uTime;
    float distortion = sin(position.y * 2.0 + time) * 0.1;
    vec3 distortedPosition = position + normal * distortion;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(distortedPosition, 1.0);
} 