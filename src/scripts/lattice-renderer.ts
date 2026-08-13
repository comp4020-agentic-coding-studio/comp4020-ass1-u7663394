import { cameraProgress } from "../lib/motion";
import { DOT_RADIUS, LATTICES, type Axis, type Vec3 } from "../lib/layout";

const FOV = Math.PI / 4.2;
const BLOCK_GAP = 2.4;

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec3 uFromDimensions;
uniform vec3 uToDimensions;
uniform int uAxis;
uniform float uProgress;
uniform float uCameraProgress;
uniform float uYaw;
uniform float uPitch;
uniform float uRoll;
uniform float uDistance;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uViewportHeight;
uniform float uPointDiameter;
uniform float uDensity;
uniform float uDpr;
uniform vec2 uOffset;

out float vAlpha;
out float vFirst;
out float vDepthLight;

float axisValue(vec3 value, int axis) {
  if (axis == 0) return value.x;
  if (axis == 1) return value.y;
  return value.z;
}

vec3 setAxis(vec3 value, int axis, float next) {
  if (axis == 0) value.x = next;
  else if (axis == 1) value.y = next;
  else value.z = next;
  return value;
}

vec3 coordinateFor(float id, vec3 dimensions) {
  float x = mod(id, dimensions.x);
  float y = mod(floor(id / dimensions.x), dimensions.y);
  float z = floor(id / (dimensions.x * dimensions.y));
  return vec3(x, y, z);
}

vec3 spatialise(vec3 coordinate) {
  return coordinate + floor(coordinate / 10.0) * ${BLOCK_GAP.toFixed(1)};
}

vec3 spatialSize(vec3 dimensions) {
  return dimensions + floor((dimensions - 1.0) / 10.0) * ${BLOCK_GAP.toFixed(1)};
}

float easeOutCubic(float t) {
  return 1.0 - pow(1.0 - t, 3.0);
}

float easeOutBack(float t) {
  float pull = 0.72;
  return 1.0 + (pull + 1.0) * pow(t - 1.0, 3.0) + pull * pow(t - 1.0, 2.0);
}

void main() {
  float id = float(gl_VertexID);
  vec3 targetCoordinate = coordinateFor(id, uToDimensions);
  float targetAxis = axisValue(targetCoordinate, uAxis);
  float previousAxis = axisValue(uFromDimensions, uAxis);
  float copy = floor(targetAxis / previousAxis);

  vec3 sourceCoordinate = setAxis(
    targetCoordinate,
    uAxis,
    mod(targetAxis, previousAxis)
  );

  vec3 source = spatialise(sourceCoordinate) - (spatialSize(uFromDimensions) - 1.0) * 0.5;
  vec3 target = spatialise(targetCoordinate) - (spatialSize(uToDimensions) - 1.0) * 0.5;

  float slot = copy / 9.0;
  float start = mix(0.24, 0.66, slot);
  float local = copy < 0.5
    ? uCameraProgress
    : clamp((uProgress - start) / 0.3, 0.0, 1.0);
  float travelled = local <= 0.0 ? 0.0 : local >= 1.0 ? 1.0 : easeOutBack(local);
  float visible = copy < 0.5 ? 1.0 : easeOutCubic(clamp(local * 1.7, 0.0, 1.0));

  vec3 point = mix(source, target, travelled);

  float cy = cos(uYaw);
  float sy = sin(uYaw);
  point = vec3(cy * point.x + sy * point.z, point.y, -sy * point.x + cy * point.z);

  float cp = cos(uPitch);
  float sp = sin(uPitch);
  point = vec3(point.x, cp * point.y - sp * point.z, sp * point.y + cp * point.z);

  float cr = cos(uRoll);
  float sr = sin(uRoll);
  point = vec3(cr * point.x - sr * point.y, sr * point.x + cr * point.y, point.z);

  float viewZ = point.z - uDistance;
  float near = 0.1;
  float far = 1600.0;
  float a = (far + near) / (near - far);
  float b = (2.0 * far * near) / (near - far);
  gl_Position = vec4(
    point.x / (uTanHalfFov * uAspect),
    point.y / uTanHalfFov,
    a * viewZ + b,
    -viewZ
  );
  gl_Position.xy += uOffset * gl_Position.w;

  float projected = uPointDiameter * uViewportHeight / (2.0 * uTanHalfFov * -viewZ);
  float coverage = min(1.0, projected * projected);
  gl_PointSize = clamp(projected, 1.0, 52.0 * uDpr);
  vAlpha = visible * uDensity * coverage;
  vFirst = id < 0.5 ? 1.0 : 0.0;
  vDepthLight = clamp(0.74 + point.z / max(18.0, uDistance) * 0.7, 0.35, 1.15);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float vAlpha;
in float vFirst;
in float vDepthLight;
out vec4 outColour;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radius = dot(point, point);
  if (radius > 1.0) discard;

  float sphere = sqrt(max(0.0, 1.0 - radius));
  vec3 normal = normalize(vec3(point.x, -point.y, sphere));
  float light = 0.38 + 0.68 * max(0.0, dot(normal, normalize(vec3(-0.38, 0.62, 0.86))));
  float edge = 1.0 - smoothstep(0.68, 1.0, radius);

  vec3 ivory = vec3(0.84, 0.88, 0.9);
  vec3 amber = vec3(1.0, 0.55, 0.2);
  vec3 colour = mix(ivory, amber, vFirst);
  float alpha = min(1.0, vAlpha * edge * (vFirst > 0.5 ? 1.8 : 1.0));
  outColour = vec4(colour * light * vDepthLight, alpha);
}`;

interface Uniforms {
  readonly fromDimensions: WebGLUniformLocation;
  readonly toDimensions: WebGLUniformLocation;
  readonly axis: WebGLUniformLocation;
  readonly progress: WebGLUniformLocation;
  readonly cameraProgress: WebGLUniformLocation;
  readonly yaw: WebGLUniformLocation;
  readonly pitch: WebGLUniformLocation;
  readonly roll: WebGLUniformLocation;
  readonly distance: WebGLUniformLocation;
  readonly aspect: WebGLUniformLocation;
  readonly tanHalfFov: WebGLUniformLocation;
  readonly viewportHeight: WebGLUniformLocation;
  readonly pointDiameter: WebGLUniformLocation;
  readonly density: WebGLUniformLocation;
  readonly dpr: WebGLUniformLocation;
  readonly offset: WebGLUniformLocation;
}

export interface Parallax {
  readonly yaw: number;
  readonly pitch: number;
}

export interface LatticeRenderer {
  resize(width: number, height: number, dpr: number): void;
  render(position: number, parallax?: Parallax): number;
  dispose(): void;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const worldSize = (dimensions: Vec3): Vec3 =>
  dimensions.map((length) => length + Math.floor((length - 1) / 10) * BLOCK_GAP) as [
    number,
    number,
    number,
  ];

const fitDistance = (dimensions: Vec3, aspect: number, fit: number): number => {
  const [width, height, depth] = worldSize(dimensions).map((length) =>
    Math.max(0.6, length - 1),
  ) as [number, number, number];
  const verticalRadius = Math.hypot(height * 0.5, depth * 0.38);
  const horizontalRadius = Math.hypot(width * 0.5, depth * 0.38) / Math.max(0.55, aspect);
  const radius = Math.max(verticalRadius, horizontalRadius, 0.55);
  return radius / (Math.tan(FOV / 2) * fit) + depth * 0.45 + 0.7;
};

const densityFor = (count: number): number => {
  if (count <= 1_000) return 0.94;
  if (count <= 10_000) return 0.86;
  if (count <= 100_000) return 0.42;
  return 0.16;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`WebGL uniform ${name} is missing`);
  return location;
}

export function createLatticeRenderer(canvas: HTMLCanvasElement): LatticeRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL could not create a program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "WebGL program did not link");
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.useProgram(program);

  const uniforms: Uniforms = {
    fromDimensions: uniform(gl, program, "uFromDimensions"),
    toDimensions: uniform(gl, program, "uToDimensions"),
    axis: uniform(gl, program, "uAxis"),
    progress: uniform(gl, program, "uProgress"),
    cameraProgress: uniform(gl, program, "uCameraProgress"),
    yaw: uniform(gl, program, "uYaw"),
    pitch: uniform(gl, program, "uPitch"),
    roll: uniform(gl, program, "uRoll"),
    distance: uniform(gl, program, "uDistance"),
    aspect: uniform(gl, program, "uAspect"),
    tanHalfFov: uniform(gl, program, "uTanHalfFov"),
    viewportHeight: uniform(gl, program, "uViewportHeight"),
    pointDiameter: uniform(gl, program, "uPointDiameter"),
    density: uniform(gl, program, "uDensity"),
    dpr: uniform(gl, program, "uDpr"),
    offset: uniform(gl, program, "uOffset"),
  };

  let width = 1;
  let height = 1;
  let dpr = 1;

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  return {
    resize(nextWidth, nextHeight, nextDpr) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      dpr = clamp(nextDpr, 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    render(position, parallax = { yaw: 0, pitch: 0 }) {
      const upper = position <= 0 ? 0 : Math.ceil(position);
      const lower = Math.max(0, upper - 1);
      const progress = position <= 0 ? 1 : clamp(position - lower, 0, 1);
      const camera = cameraProgress(progress);
      const from = LATTICES[lower];
      const to = LATTICES[upper];
      const aspect = width / height;
      const fromDistance = fitDistance(from.dimensions, aspect, from.camera.fit);
      const toDistance = fitDistance(to.dimensions, aspect, to.camera.fit);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform3fv(uniforms.fromDimensions, from.dimensions);
      gl.uniform3fv(uniforms.toDimensions, to.dimensions);
      gl.uniform1i(uniforms.axis, (to.expansionAxis ?? 0) as Axis);
      gl.uniform1f(uniforms.progress, progress);
      gl.uniform1f(uniforms.cameraProgress, camera);
      gl.uniform1f(
        uniforms.yaw,
        lerp(from.camera.yaw, to.camera.yaw, camera) + parallax.yaw,
      );
      gl.uniform1f(
        uniforms.pitch,
        lerp(from.camera.pitch, to.camera.pitch, camera) + parallax.pitch,
      );
      gl.uniform1f(uniforms.roll, lerp(from.camera.roll, to.camera.roll, camera));
      gl.uniform1f(
        uniforms.distance,
        Math.exp(lerp(Math.log(fromDistance), Math.log(toDistance), camera)),
      );
      gl.uniform1f(uniforms.aspect, aspect);
      gl.uniform1f(uniforms.tanHalfFov, Math.tan(FOV / 2));
      gl.uniform1f(uniforms.viewportHeight, canvas.height);
      gl.uniform1f(uniforms.pointDiameter, DOT_RADIUS * 2);
      gl.uniform1f(
        uniforms.density,
        Math.exp(
          lerp(Math.log(densityFor(from.count)), Math.log(densityFor(to.count)), camera),
        ),
      );
      gl.uniform1f(uniforms.dpr, dpr);
      gl.uniform2f(
        uniforms.offset,
        aspect > 1.2 ? 0.13 : 0,
        aspect < 0.75 ? 0.08 : 0,
      );
      gl.drawArrays(gl.POINTS, 0, to.count);
      // At a settled state the next thing may be a screenshot or an assistive
      // measurement rather than another animation frame. Software WebGL can
      // queue the 100k/1m draws beyond that boundary, so finish once on settle;
      // never in the moving frames where it would introduce a stall.
      if (progress >= 1) gl.finish();

      const distance = Math.exp(lerp(Math.log(fromDistance), Math.log(toDistance), camera));
      return (DOT_RADIUS * 2 * height) / (2 * Math.tan(FOV / 2) * distance);
    },

    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
