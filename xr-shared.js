// Shared math, DOM, and GL helpers.

// Math
// Naming convention: boolean variables use *Bool suffix, boolean-returning methods use is*() prefix.
const tau = Math.PI * 2; // full circle in radians (tau = 2 * pi)

const clampNumber = function(value, minValue, maxValue) {
	return Math.max(minValue, Math.min(maxValue, value));
};

const emptyAudioMetrics = Object.freeze({
	level: 0,
	peak: 0,
	bass: 0,
	transient: 0,
	beatPulse: 0,
	kickGate: 0,
	bassHit: 0,
	transientGate: 0,
	strobeGate: 0,
	colorMomentum: 0,
	motionEnergy: 0,
	roomFill: 0,
	leftLevel: 0,
	rightLevel: 0,
	leftBass: 0,
	rightBass: 0,
	midLevel: 0,
	sideLevel: 0,
	stereoBalance: 0,
	stereoWidth: 0,
	leftImpact: 0,
	rightImpact: 0
});

const normalizeVec3 = function(x, y, z) {
	const length = Math.sqrt(x * x + y * y + z * z) || 1;
	return {x: x / length, y: y / length, z: z / length};
};

const dotVec3 = function(ax, ay, az, bx, by, bz) {
	return ax * bx + ay * by + az * bz;
};

const rotateXZ = function(x, z, yaw) {
	const cosYaw = Math.cos(yaw);
	const sinYaw = Math.sin(yaw);
	return {
		x: x * cosYaw + z * sinYaw,
		z: -x * sinYaw + z * cosYaw
	};
};

const hueToRgb = function(p, q, t) {
	if (t < 0) {
		t += 1;
	}
	if (t > 1) {
		t -= 1;
	}
	if (t < 1 / 6) {
		return p + (q - p) * 6 * t;
	}
	if (t < 0.5) {
		return q;
	}
	if (t < 2 / 3) {
		return p + (q - p) * (2 / 3 - t) * 6;
	}
	return p;
};

const hslToRgb = function(h, s, l) {
	h = ((h % 1) + 1) % 1;
	s = clampNumber(s, 0, 1);
	l = clampNumber(l, 0, 1);
	if (s <= 0.0001) {
		return [l, l, l];
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return [
		hueToRgb(p, q, h + 1 / 3),
		hueToRgb(p, q, h),
		hueToRgb(p, q, h - 1 / 3)
	];
};

const wrapUnit = function(value) {
	return value - Math.floor(value);
};

// Convert function names into readable menu labels.
const formatFunctionLabel = function(functionName) {
	if (!functionName) {
		return "";
	}
	return String(functionName)
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, function(match) {
			return match.toUpperCase();
		})
		.trim();
};

const unwrapAngle = function(angle, referenceAngle) {
	let unwrappedAngle = angle;
	while (unwrappedAngle - referenceAngle > Math.PI) {
		unwrappedAngle -= tau;
	}
	while (unwrappedAngle - referenceAngle < -Math.PI) {
		unwrappedAngle += tau;
	}
	return unwrappedAngle;
};

const extractForwardYawPitch = function(viewMatrix) {
	const forwardX = -viewMatrix[2];
	const forwardY = -viewMatrix[6];
	const forwardZ = -viewMatrix[10];
	const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
	return {
		yaw: Math.atan2(forwardX, -forwardZ),
		pitch: Math.atan2(forwardY, horizontalLength)
	};
};

const getQuaternionForwardComponents = function(quaternion) {
	return {
		x: -(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y)),
		y: -(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x)),
		z: -(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y))
	};
};

const extractForwardYawPitchFromQuaternion = function(quaternion) {
	const forward = getQuaternionForwardComponents(quaternion);
	const forwardX = forward.x;
	const forwardY = forward.y;
	const forwardZ = forward.z;
	const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
	return {
		yaw: Math.atan2(forwardX, -forwardZ),
		pitch: Math.atan2(forwardY, horizontalLength)
	};
};

const extractForwardDirectionFromQuaternion = function(quaternion) {
	const forward = getQuaternionForwardComponents(quaternion);
	return normalizeVec3(forward.x, forward.y, forward.z);
};

const getProjectionScaleOffset = function(projectionMatrix) {
	return {
		xScale: projectionMatrix && Math.abs(projectionMatrix[0] || 0) > 0.0001 ? projectionMatrix[0] : 1,
		yScale: projectionMatrix && Math.abs(projectionMatrix[5] || 0) > 0.0001 ? projectionMatrix[5] : 1,
		xOffset: projectionMatrix ? (projectionMatrix[8] || 0) : 0,
		yOffset: projectionMatrix ? (projectionMatrix[9] || 0) : 0
	};
};

const extractProjectionFov = function(projectionMatrix) {
	const projectionScaleOffset = getProjectionScaleOffset(projectionMatrix);
	const xScale = projectionScaleOffset.xScale;
	const yScale = projectionScaleOffset.yScale;
	const xOffset = projectionScaleOffset.xOffset;
	const yOffset = projectionScaleOffset.yOffset;
	const leftTangent = (xOffset - 1) / xScale;
	const rightTangent = (xOffset + 1) / xScale;
	const bottomTangent = (yOffset - 1) / yScale;
	const topTangent = (yOffset + 1) / yScale;
	return {
		horizontal: Math.atan(rightTangent) - Math.atan(leftTangent),
		vertical: Math.atan(topTangent) - Math.atan(bottomTangent)
	};
};

const extractProjectionRayParams = function(projectionMatrix) {
	return getProjectionScaleOffset(projectionMatrix);
};

// pre-allocated to avoid per-frame garbage in hot paths
const reusableCameraPosition = {x: 0, y: 0, z: 0};
const extractCameraPositionFromViewMatrix = function(viewMatrix) {
	const rightX = viewMatrix[0];
	const rightY = viewMatrix[4];
	const rightZ = viewMatrix[8];
	const upX = viewMatrix[1];
	const upY = viewMatrix[5];
	const upZ = viewMatrix[9];
	const forwardX = -viewMatrix[2];
	const forwardY = -viewMatrix[6];
	const forwardZ = -viewMatrix[10];
	const tx = viewMatrix[12];
	const ty = viewMatrix[13];
	const tz = viewMatrix[14];
	reusableCameraPosition.x = -(rightX * tx + rightY * ty + rightZ * tz);
	reusableCameraPosition.y = -(upX * tx + upY * ty + upZ * tz);
	reusableCameraPosition.z = -((-forwardX) * tx + (-forwardY) * ty + (-forwardZ) * tz);
	return reusableCameraPosition;
};

// Shared read-only identity matrix; do not mutate — used as default fallback by multiple callers
const IDENTITY_MATRIX = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// XR rendering frequently needs the inverse rigid camera transform as a world matrix.
// Optional out parameter avoids per-call allocation in render loops.
const buildWorldFromViewMatrix = function(viewMatrix, out) {
	const cameraPosition = extractCameraPositionFromViewMatrix(viewMatrix);
	const o = out || new Float32Array(16);
	o[0] = viewMatrix[0]; o[1] = viewMatrix[4]; o[2] = viewMatrix[8]; o[3] = 0;
	o[4] = viewMatrix[1]; o[5] = viewMatrix[5]; o[6] = viewMatrix[9]; o[7] = 0;
	o[8] = viewMatrix[2]; o[9] = viewMatrix[6]; o[10] = viewMatrix[10]; o[11] = 0;
	o[12] = cameraPosition.x; o[13] = cameraPosition.y; o[14] = cameraPosition.z; o[15] = 1;
	return o;
};

const identityMatrix = function() {
	return IDENTITY_MATRIX;
};

// Optional out parameter avoids per-call allocation in render loops.
const multiplyMatrices = function(a, b, out) {
	const o = out || new Float32Array(16);
	for (let column = 0; column < 4; column += 1) {
		for (let row = 0; row < 4; row += 1) {
			o[column * 4 + row] =
				a[0 * 4 + row] * b[column * 4 + 0] +
				a[1 * 4 + row] * b[column * 4 + 1] +
				a[2 * 4 + row] * b[column * 4 + 2] +
				a[3 * 4 + row] * b[column * 4 + 3];
		}
	}
	return o;
};

// Optional out parameter avoids per-call allocation in render loops.
const translateScale = function(tx, ty, tz, sx, sy, sz, out) {
	const o = out || new Float32Array(16);
	o[0] = sx; o[1] = 0; o[2] = 0; o[3] = 0;
	o[4] = 0; o[5] = sy; o[6] = 0; o[7] = 0;
	o[8] = 0; o[9] = 0; o[10] = sz; o[11] = 0;
	o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
	return o;
};

const translateRotateYScale = function(tx, ty, tz, yaw, sx, sy, sz, out) {
	const cosYaw = Math.cos(yaw);
	const sinYaw = Math.sin(yaw);
	const o = out || new Float32Array(16);
	o[0] = cosYaw * sx; o[1] = 0; o[2] = -sinYaw * sx; o[3] = 0;
	o[4] = 0; o[5] = sy; o[6] = 0; o[7] = 0;
	o[8] = sinYaw * sz; o[9] = 0; o[10] = cosYaw * sz; o[11] = 0;
	o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
	return o;
};

const basisScale = function(tx, ty, tz, right, up, forward, sx, sy, sz, out) {
	const o = out || new Float32Array(16);
	o[0] = right.x * sx; o[1] = right.y * sx; o[2] = right.z * sx; o[3] = 0;
	o[4] = up.x * sy; o[5] = up.y * sy; o[6] = up.z * sy; o[7] = 0;
	o[8] = forward.x * sz; o[9] = forward.y * sz; o[10] = forward.z * sz; o[11] = 0;
	o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
	return o;
};

const lerpNumber = function(startValue, endValue, mixValue) {
	return startValue + (endValue - startValue) * mixValue;
};


// DOM
const applyStyles = function(element, styleMap) {
	if (!styleMap) {
		return;
	}
	const styleKeys = Object.keys(styleMap);
	for (let i = 0; i < styleKeys.length; i += 1) {
		element.style[styleKeys[i]] = styleMap[styleKeys[i]];
	}
};

// event listener registry for trackable cleanup
const createEventListenerRegistry = function() {
	const listeners = [];
	return {
		on: function(target, eventType, handler, options) {
			target.addEventListener(eventType, handler, options);
			listeners.push({target: target, eventType: eventType, handler: handler, options: options});
		},
		removeAll: function() {
			for (let i = listeners.length - 1; i >= 0; i -= 1) {
				const entry = listeners[i];
				entry.target.removeEventListener(entry.eventType, entry.handler, entry.options);
			}
			listeners.length = 0;
		}
	};
};


// GL
const createShader = function(gl, type, source, errorLabel) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) || errorLabel + " shader compile failed");
	}
	return shader;
};

const createProgram = function(gl, vertexSource, fragmentSource, errorLabel) {
	const program = gl.createProgram();
	gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource, errorLabel));
	gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, errorLabel));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || errorLabel + " program link failed");
	}
	return program;
};

const fullscreenVertexSource = [
	"attribute vec2 position;",
	"varying vec2 vScreenUv;",
	"void main(){",
	"vScreenUv=position*0.5+0.5;",
	"gl_Position=vec4(position,0.0,1.0);",
	"}"
].join("");

const createFullscreenProgramInfo = function(gl, fragmentSource, includeAudioUniformsBool, errorLabel) {
	const program = createProgram(gl, fullscreenVertexSource, fragmentSource, errorLabel);
	return {
		program: program,
		positionLoc: gl.getAttribLocation(program, "position"),
		sourceTextureLoc: gl.getUniformLocation(program, "sourceTexture"),
		viewportSizeLoc: gl.getUniformLocation(program, "viewportSize"),
		eyeCenterOffsetLoc: gl.getUniformLocation(program, "eyeCenterOffset"),
		orientationOffsetLoc: gl.getUniformLocation(program, "orientationOffset"),
		backgroundAlphaLoc: gl.getUniformLocation(program, "backgroundAlpha"),
		backgroundMaskCountLoc: gl.getUniformLocation(program, "backgroundMaskCount"),
		backgroundMaskCentersLoc: gl.getUniformLocation(program, "backgroundMaskCenters"),
		backgroundMaskParamsLoc: gl.getUniformLocation(program, "backgroundMaskParams"),
		audioMetricsLoc: includeAudioUniformsBool ? gl.getUniformLocation(program, "audioMetrics") : null,
		beatPulseLoc: includeAudioUniformsBool ? gl.getUniformLocation(program, "beatPulse") : null
	};
};

const fullscreenTriangleVertices = new Float32Array([
	-1, -1,
	3, -1,
	-1, 3
]);

const createFullscreenTriangleBuffer = function(gl) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, fullscreenTriangleVertices, gl.STATIC_DRAW);
	return buffer;
};

// Dense UV grid used when depth has to be projected through world space instead of sampled as a screen quad.
const createUvGridTriangleBuffer = function(gl, columns, rows) {
	const safeColumns = Math.max(1, columns | 0);
	const safeRows = Math.max(1, rows | 0);
	const triangleCount = safeColumns * safeRows * 2;
	const vertices = new Float32Array(triangleCount * 3 * 2);
	let writeIndex = 0;
	for (let y = 0; y < safeRows; y += 1) {
		const v0 = y / safeRows;
		const v1 = (y + 1) / safeRows;
		for (let x = 0; x < safeColumns; x += 1) {
			const u0 = x / safeColumns;
			const u1 = (x + 1) / safeColumns;
			vertices[writeIndex] = u0; vertices[writeIndex + 1] = v0;
			vertices[writeIndex + 2] = u1; vertices[writeIndex + 3] = v0;
			vertices[writeIndex + 4] = u0; vertices[writeIndex + 5] = v1;
			vertices[writeIndex + 6] = u0; vertices[writeIndex + 7] = v1;
			vertices[writeIndex + 8] = u1; vertices[writeIndex + 9] = v0;
			vertices[writeIndex + 10] = u1; vertices[writeIndex + 11] = v1;
			writeIndex += 12;
		}
	}
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
	return {
		buffer: buffer,
		vertexCount: triangleCount * 3
	};
};
