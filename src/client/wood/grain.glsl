// Simple procedural wood grain fragment shader
// Used as a fragment shader snippet for wood material

varying vec2 vUv;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec3 woodGrain(vec3 pos, vec3 baseColor) {
  // Cylindrical ring pattern
  float r = length(pos.xz);
  float rings = sin(r * 60.0 + noise(pos.xz * 4.0) * 2.0) * 0.5 + 0.5;

  // Grain variation along length
  float grain = noise(vec2(pos.y * 20.0, r * 10.0)) * 0.15;

  float pattern = rings * 0.12 + grain;
  return baseColor * (1.0 - pattern * 0.4);
}
