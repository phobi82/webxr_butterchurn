// core/math.js
const tau = Math.PI * 2;

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

const extractForwardYawPitchFromQuaternion = function(quaternion) {
	const forwardX = -(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y));
	const forwardY = -(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x));
	const forwardZ = -(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y));
	const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
	return {
		yaw: Math.atan2(forwardX, -forwardZ),
		pitch: Math.atan2(forwardY, horizontalLength)
	};
};

const extractForwardDirectionFromQuaternion = function(quaternion) {
	return normalizeVec3(
		-(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y)),
		-(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x)),
		-(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y))
	);
};

const extractProjectionFov = function(projectionMatrix) {
	const xScale = projectionMatrix[0] || 1;
	const yScale = projectionMatrix[5] || 1;
	const xOffset = projectionMatrix[8] || 0;
	const yOffset = projectionMatrix[9] || 0;
	const leftTangent = (xOffset - 1) / xScale;
	const rightTangent = (xOffset + 1) / xScale;
	const bottomTangent = (yOffset - 1) / yScale;
	const topTangent = (yOffset + 1) / yScale;
	return {
		horizontal: Math.atan(rightTangent) - Math.atan(leftTangent),
		vertical: Math.atan(topTangent) - Math.atan(bottomTangent)
	};
};

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
	return {
		x: -(rightX * tx + rightY * ty + rightZ * tz),
		y: -(upX * tx + upY * ty + upZ * tz),
		z: -((-forwardX) * tx + (-forwardY) * ty + (-forwardZ) * tz)
	};
};

const identityMatrix = function() {
	return new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);
};

const multiplyMatrices = function(a, b) {
	const out = new Float32Array(16);
	for (let column = 0; column < 4; column += 1) {
		for (let row = 0; row < 4; row += 1) {
			out[column * 4 + row] =
				a[0 * 4 + row] * b[column * 4 + 0] +
				a[1 * 4 + row] * b[column * 4 + 1] +
				a[2 * 4 + row] * b[column * 4 + 2] +
				a[3 * 4 + row] * b[column * 4 + 3];
		}
	}
	return out;
};

const translateScale = function(tx, ty, tz, sx, sy, sz) {
	return new Float32Array([
		sx, 0, 0, 0,
		0, sy, 0, 0,
		0, 0, sz, 0,
		tx, ty, tz, 1
	]);
};

const translateRotateYScale = function(tx, ty, tz, yaw, sx, sy, sz) {
	const cosYaw = Math.cos(yaw);
	const sinYaw = Math.sin(yaw);
	return new Float32Array([
		cosYaw * sx, 0, -sinYaw * sx, 0,
		0, sy, 0, 0,
		sinYaw * sz, 0, cosYaw * sz, 0,
		tx, ty, tz, 1
	]);
};

const basisScale = function(tx, ty, tz, right, up, forward, sx, sy, sz) {
	return new Float32Array([
		right.x * sx, right.y * sx, right.z * sx, 0,
		up.x * sy, up.y * sy, up.z * sy, 0,
		forward.x * sz, forward.y * sz, forward.z * sz, 0,
		tx, ty, tz, 1
	]);
};

const lerpNumber = function(startValue, endValue, mixValue) {
	return startValue + (endValue - startValue) * mixValue;
};

// core/dom.js
const applyStyles = function(element, styleMap) {
	if (!styleMap) {
		return;
	}
	const styleKeys = Object.keys(styleMap);
	for (let i = 0; i < styleKeys.length; i += 1) {
		element.style[styleKeys[i]] = styleMap[styleKeys[i]];
	}
};

// core/render/gl-programs.js
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

// core/visualizer/gl-utils.js
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

const createFullscreenTriangleBuffer = function(gl) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		-1, -1,
		3, -1,
		-1, 3
	]), gl.STATIC_DRAW);
	return buffer;
};

// core/desktop-input.js
const createDesktopInput = function(options) {
	const desktopMovementState = options.desktopMovementState;
	const mouseSensitivity = options.mouseSensitivity || 0.0024;
	const clampNumber = options.clampNumber;
	const isXrSessionActive = options.isXrSessionActive || function() { return false; };
	const onPointerLockChange = options.onPointerLockChange || function() {};
	let pointerLockedBool = false;

	const isPointerLockInputActive = function() {
		return pointerLockedBool && !isXrSessionActive();
	};

	const setMovementKeyState = function(code, pressedBool) {
		if (code === "KeyW") { desktopMovementState.moveForwardBool = pressedBool; return true; }
		if (code === "KeyS") { desktopMovementState.moveBackwardBool = pressedBool; return true; }
		if (code === "KeyA") { desktopMovementState.moveLeftBool = pressedBool; return true; }
		if (code === "KeyD") { desktopMovementState.moveRightBool = pressedBool; return true; }
		if (code === "Space") { desktopMovementState.jumpHeldBool = pressedBool; return true; }
		return false;
	};

	const setPointerModifierState = function(event, pressedBool) {
		if (!isPointerLockInputActive()) {
			return false;
		}
		if (event.button === 0) {
			desktopMovementState.sprintBool = pressedBool;
		} else if (event.button === 2) {
			desktopMovementState.crouchBool = pressedBool;
		} else {
			return false;
		}
		event.preventDefault();
		return true;
	};

	return {
		isPointerLocked: function() {
			return pointerLockedBool;
		},
		releaseAllMovementKeys: function() {
			desktopMovementState.moveForwardBool = false;
			desktopMovementState.moveBackwardBool = false;
			desktopMovementState.moveLeftBool = false;
			desktopMovementState.moveRightBool = false;
			desktopMovementState.sprintBool = false;
			desktopMovementState.crouchBool = false;
			desktopMovementState.jumpHeldBool = false;
		},
		registerEventHandlers: function(documentRef, windowRef) {
			documentRef.addEventListener("pointerlockchange", function() {
				pointerLockedBool = documentRef.pointerLockElement !== null;
				if (!pointerLockedBool) {
					desktopMovementState.sprintBool = false;
					desktopMovementState.crouchBool = false;
				}
				onPointerLockChange(pointerLockedBool);
			});

			documentRef.addEventListener("mousedown", function(event) {
				setPointerModifierState(event, true);
			}, true);

			documentRef.addEventListener("mouseup", function(event) {
				setPointerModifierState(event, false);
			}, true);

			documentRef.addEventListener("mousemove", function(event) {
				if (!isPointerLockInputActive()) {
					return;
				}
				desktopMovementState.lookYaw += event.movementX * mouseSensitivity;
				desktopMovementState.lookPitch = clampNumber(desktopMovementState.lookPitch - event.movementY * mouseSensitivity, -1.35, 1.35);
			});

			documentRef.addEventListener("keydown", function(event) {
				if (isXrSessionActive()) {
					return;
				}
				if (setMovementKeyState(event.code, true)) {
					event.preventDefault();
				}
			});

			documentRef.addEventListener("keyup", function(event) {
				if (setMovementKeyState(event.code, false)) {
					event.preventDefault();
				}
			});

			windowRef.addEventListener("blur", function() {
				this.releaseAllMovementKeys();
			}.bind(this));
		}
	};
};

// core/scene-lighting.js
const MAX_DIRECTIONAL_LIGHTS = 4;

const createEmptyLightingState = function() {
	return {
		ambientColor: new Float32Array([1, 1, 1]),
		ambientStrength: 0.3,
		lightDirections: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
		lightColors: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
		lightStrengths: new Float32Array(MAX_DIRECTIONAL_LIGHTS),
		fixtureGroups: [],
		name: "",
		description: ""
	};
};

const clearLightingState = function(state) {
	state.ambientColor[0] = 1;
	state.ambientColor[1] = 1;
	state.ambientColor[2] = 1;
	state.ambientStrength = 0.3;
	state.lightDirections.fill(0);
	state.lightColors.fill(0);
	state.lightStrengths.fill(0);
	state.fixtureGroups.length = 0;
};

const setDirectionalLight = function(state, index, direction, color, strength) {
	if (index < 0 || index >= MAX_DIRECTIONAL_LIGHTS) {
		return;
	}
	const baseOffset = index * 3;
	state.lightDirections[baseOffset] = direction.x;
	state.lightDirections[baseOffset + 1] = direction.y;
	state.lightDirections[baseOffset + 2] = direction.z;
	state.lightColors[baseOffset] = color[0];
	state.lightColors[baseOffset + 1] = color[1];
	state.lightColors[baseOffset + 2] = color[2];
	state.lightStrengths[index] = Math.max(0, strength);
};

const pushFixtureGroup = function(state, args) {
	args = args || {};
	if (!state || !state.fixtureGroups) {
		return null;
	}
	const color = args.color || [1, 1, 1];
	const group = {
		type: args.type || "wash",
		anchorType: args.anchorType || "ceiling",
		color: [clampNumber(color[0], 0, 1), clampNumber(color[1], 0, 1), clampNumber(color[2], 0, 1)],
		intensity: Math.max(0, args.intensity == null ? 0 : args.intensity),
		radius: clampNumber(args.radius == null ? 0.5 : args.radius, 0.05, 1.4),
		softness: clampNumber(args.softness == null ? 0.18 : args.softness, 0.02, 0.45),
		azimuth: args.azimuth || 0,
		sweep: clampNumber(args.sweep == null ? 0.2 : args.sweep, 0, 1.5),
		vertical: clampNumber(args.vertical == null ? 0.55 : args.vertical, 0, 1),
		pulseAmount: clampNumber(args.pulseAmount == null ? 0 : args.pulseAmount, 0, 1),
		strobeAmount: clampNumber(args.strobeAmount == null ? 0 : args.strobeAmount, 0, 1),
		stereoBias: clampNumber(args.stereoBias == null ? 0 : args.stereoBias, -1, 1),
		// Presets choose one shared effect family and passthrough resolves the rest.
		effectMode: args.effectMode || ""
	};
	state.fixtureGroups.push(group);
	return group;
};

const getFixtureDirection = function(group) {
	const azimuth = group && group.azimuth != null ? group.azimuth : 0;
	const horizontalScale = group && group.anchorType === "wall" ? 1.05 : (group && group.anchorType === "floor" ? 0.42 : 0.72);
	const height = group && group.anchorType === "wall" ? lerpNumber(0.62, 1.02, group.vertical == null ? 0.55 : group.vertical) : (group && group.anchorType === "floor" ? 0.42 : 1.08);
	return normalizeVec3(Math.cos(azimuth) * horizontalScale, height, Math.sin(azimuth) * horizontalScale);
};

const applyFixtureGroupsToLightingState = function(state, ambientBaseStrength) {
	if (!state) {
		return;
	}
	const rankedGroups = (state.fixtureGroups || []).slice().sort(function(a, b) {
		return (b.intensity || 0) - (a.intensity || 0);
	});
	for (let i = 0; i < MAX_DIRECTIONAL_LIGHTS; i += 1) {
		const group = rankedGroups[i];
		if (!group) {
			continue;
		}
		setDirectionalLight(state, i, getFixtureDirection(group), group.color, group.intensity);
	}
	let ambientWeight = 0;
	let ambientR = 0;
	let ambientG = 0;
	let ambientB = 0;
	for (let i = 0; i < rankedGroups.length; i += 1) {
		const group = rankedGroups[i];
		const weight = Math.max(0, group.intensity) * (group.type === "wash" ? 1 : 0.55);
		if (weight <= 0.0001) {
			continue;
		}
		ambientWeight += weight;
		ambientR += group.color[0] * weight;
		ambientG += group.color[1] * weight;
		ambientB += group.color[2] * weight;
	}
	if (ambientWeight > 0.0001) {
		state.ambientColor[0] = clampNumber(ambientR / ambientWeight, 0, 1);
		state.ambientColor[1] = clampNumber(ambientG / ambientWeight, 0, 1);
		state.ambientColor[2] = clampNumber(ambientB / ambientWeight, 0, 1);
	}
	state.ambientStrength = clampNumber((ambientBaseStrength == null ? 0.18 : ambientBaseStrength) + ambientWeight * 0.05, 0.08, 0.7);
};

const createTopLightDirection = function(azimuth, height, ellipseX, ellipseZ) {
	return normalizeVec3(Math.cos(azimuth) * ellipseX, height, Math.sin(azimuth) * ellipseZ);
};

const getLightingUniformLocations = function(gl, program) {
	return {
		ambientColorLoc: gl.getUniformLocation(program, "ambientColor"),
		ambientStrengthLoc: gl.getUniformLocation(program, "ambientStrength"),
		lightDirectionsLoc: gl.getUniformLocation(program, "lightDirections[0]"),
		lightColorsLoc: gl.getUniformLocation(program, "lightColors[0]"),
		lightStrengthsLoc: gl.getUniformLocation(program, "lightStrengths[0]")
	};
};

const applyLightingUniforms = function(gl, uniformLocations, lightingState) {
	if (!uniformLocations || !lightingState) {
		return;
	}
	gl.uniform3fv(uniformLocations.ambientColorLoc, lightingState.ambientColor);
	gl.uniform1f(uniformLocations.ambientStrengthLoc, lightingState.ambientStrength);
	gl.uniform3fv(uniformLocations.lightDirectionsLoc, lightingState.lightDirections);
	gl.uniform3fv(uniformLocations.lightColorsLoc, lightingState.lightColors);
	gl.uniform1fv(uniformLocations.lightStrengthsLoc, lightingState.lightStrengths);
};

const createSceneLighting = function(options) {
	options = options || {};
	const state = createEmptyLightingState();
	const presetDefinitions = options.presetDefinitions && options.presetDefinitions.length ? options.presetDefinitions : lightingPresetDefinitions;
	let currentPresetIndex = clampNumber(options.initialPresetIndex == null ? 0 : options.initialPresetIndex, 0, Math.max(0, presetDefinitions.length - 1));
	const getPresetNames = function() {
		const names = [];
		for (let i = 0; i < presetDefinitions.length; i += 1) {
			names.push(presetDefinitions[i].name);
		}
		return names;
	};
	const getCurrentPresetDefinition = function() {
		return presetDefinitions[currentPresetIndex] || {};
	};
	const getPresetIndexForEffectVariant = function(effectIndex, variantIndex) {
		const matchingIndexes = [];
		for (let i = 0; i < presetDefinitions.length; i += 1) {
			if ((presetDefinitions[i].effectIndex == null ? i : presetDefinitions[i].effectIndex) === effectIndex) {
				matchingIndexes.push(i);
			}
		}
		if (!matchingIndexes.length) {
			return currentPresetIndex;
		}
		return matchingIndexes[(variantIndex + matchingIndexes.length) % matchingIndexes.length];
	};
	const getEffectIndexes = function() {
		const indexes = [];
		for (let i = 0; i < presetDefinitions.length; i += 1) {
			const effectIndex = presetDefinitions[i].effectIndex == null ? i : presetDefinitions[i].effectIndex;
			if (indexes.indexOf(effectIndex) === -1) {
				indexes.push(effectIndex);
			}
		}
		return indexes;
	};
	return {
		update: function(timeSeconds, audioMetrics) {
			const preset = getCurrentPresetDefinition() || presetDefinitions[0];
			clearLightingState(state);
			preset.buildState(state, timeSeconds || 0, audioMetrics || {});
			state.name = preset.name;
			state.description = preset.description;
			return state;
		},
		getState: function() {
			return state;
		},
		getSelectionState: function() {
			const presetDefinition = getCurrentPresetDefinition();
			return {
				presetNames: getPresetNames(),
				currentPresetIndex: currentPresetIndex,
				currentPresetName: presetDefinition.name || "",
				currentPresetDescription: presetDefinition.description || "",
				currentPresetEffectName: presetDefinition.effectName || presetDefinition.name || "",
				currentPresetEffectDescription: presetDefinition.effectDescription || presetDefinition.description || "",
				currentPresetEffectIndex: presetDefinition.effectIndex == null ? currentPresetIndex : presetDefinition.effectIndex,
				currentPresetEffectCount: presetDefinition.effectCount == null ? presetDefinitions.length : presetDefinition.effectCount,
				currentPresetVariantKey: presetDefinition.variantKey || "",
				currentPresetVariantIndex: presetDefinition.variantIndex == null ? 0 : presetDefinition.variantIndex,
				currentPresetVariantCount: presetDefinition.variantCount == null ? 1 : presetDefinition.variantCount,
				currentPresetVariantLabel: presetDefinition.variantLabel || "",
				currentPresetSurfaceKey: presetDefinition.surfaceKey || ""
			};
		},
		selectPreset: function(index) {
			if (!presetDefinitions.length) {
				return Promise.resolve();
			}
			currentPresetIndex = (index + presetDefinitions.length) % presetDefinitions.length;
			return Promise.resolve();
		},
		cycleEffect: function(direction) {
			const effectIndexes = getEffectIndexes();
			const presetDefinition = getCurrentPresetDefinition();
			const currentEffectIndex = presetDefinition.effectIndex == null ? currentPresetIndex : presetDefinition.effectIndex;
			const effectPosition = effectIndexes.indexOf(currentEffectIndex);
			const safeEffectPosition = effectPosition >= 0 ? effectPosition : 0;
			const nextEffectIndex = effectIndexes[(safeEffectPosition + (direction < 0 ? -1 : 1) + effectIndexes.length) % effectIndexes.length];
			currentPresetIndex = getPresetIndexForEffectVariant(nextEffectIndex, presetDefinition.variantIndex || 0);
			return Promise.resolve();
		},
		cycleVariant: function(direction) {
			const presetDefinition = getCurrentPresetDefinition();
			const variantCount = presetDefinition.variantCount == null ? 1 : presetDefinition.variantCount;
			if (variantCount <= 1) {
				return Promise.resolve();
			}
			const effectIndex = presetDefinition.effectIndex == null ? currentPresetIndex : presetDefinition.effectIndex;
			const nextVariantIndex = ((presetDefinition.variantIndex || 0) + (direction < 0 ? -1 : 1) + variantCount) % variantCount;
			currentPresetIndex = getPresetIndexForEffectVariant(effectIndex, nextVariantIndex);
			return Promise.resolve();
		}
	};
};

// core/xr-session.js
const createXrSessionBridge = function(options) {
	const xrApi = options.xrApi || null;
	const xrWebGLLayer = options.xrWebGLLayer || null;
	const xrRigidTransform = options.xrRigidTransform || null;
	const depthDataFormats = options.depthDataFormats || ["luminance-alpha", "float32"];
	const getSafeSessionDepthState = function(session) {
		let depthUsage = "";
		let depthDataFormat = "";
		try {
			depthUsage = session.depthUsage || "";
		} catch (error) {
			depthUsage = "";
		}
		try {
			depthDataFormat = session.depthDataFormat || "";
		} catch (error) {
			depthDataFormat = "";
		}
		return {
			depthUsage: depthUsage,
			depthDataFormat: depthDataFormat,
			depthSensingActiveBool: depthUsage === "cpu-optimized" || depthUsage === "gpu-optimized"
		};
	};
	const startSessionWithOptionalDepth = async function(sessionMode) {
		const sessionOptions = {requiredFeatures: ["local-floor"]};
		if (sessionMode !== "immersive-ar") {
			return xrApi.requestSession(sessionMode, sessionOptions);
		}
		sessionOptions.optionalFeatures = ["depth-sensing"];
		// Browsers and docs have diverged on the request key name, so provide both.
		sessionOptions.depthSensing = {
			usagePreference: ["cpu-optimized"],
			dataFormatPreference: depthDataFormats,
			formatPreference: depthDataFormats
		};
		try {
			return await xrApi.requestSession(sessionMode, sessionOptions);
		} catch (error) {
			return xrApi.requestSession(sessionMode, {requiredFeatures: ["local-floor"]});
		}
	};
	const getSupportState = async function() {
		if (!xrApi) {
			return {
				immersiveArSupportedBool: false,
				immersiveVrSupportedBool: false,
				preferredSessionMode: ""
			};
		}
		const immersiveArSupportedBool = await xrApi.isSessionSupported("immersive-ar").catch(function() {
			return false;
		});
		const immersiveVrSupportedBool = await xrApi.isSessionSupported("immersive-vr").catch(function() {
			return false;
		});
		return {
			immersiveArSupportedBool: !!immersiveArSupportedBool,
			immersiveVrSupportedBool: !!immersiveVrSupportedBool,
			preferredSessionMode: immersiveArSupportedBool ? "immersive-ar" : immersiveVrSupportedBool ? "immersive-vr" : ""
		};
	};
	return {
		isAvailable: function() {
			return !!xrApi;
		},
		getSupportState: getSupportState,
		isSupported: async function() {
			const supportState = await getSupportState();
			return !!supportState.preferredSessionMode;
		},
		startSession: async function(gl, onEnd) {
			const supportState = await getSupportState();
			if (!supportState.preferredSessionMode) {
				throw new Error("No immersive XR session mode available.");
			}
			const sessionMode = supportState.preferredSessionMode;
			const session = await startSessionWithOptionalDepth(sessionMode);
			if (onEnd) {
				session.addEventListener("end", onEnd);
			}
			await gl.makeXRCompatible();
			let framebufferScaleFactor = 1;
			if (xrWebGLLayer && typeof xrWebGLLayer.getNativeFramebufferScaleFactor === "function") {
				framebufferScaleFactor = xrWebGLLayer.getNativeFramebufferScaleFactor(session) || 1;
			}
			session.updateRenderState({
				baseLayer: new xrWebGLLayer(session, gl, {framebufferScaleFactor: framebufferScaleFactor, alpha: sessionMode === "immersive-ar"})
			});
			const baseRefSpace = await session.requestReferenceSpace("local-floor");
			const environmentBlendMode = session.environmentBlendMode || (sessionMode === "immersive-ar" ? "alpha-blend" : "opaque");
			const sessionDepthState = getSafeSessionDepthState(session);
			return {
				session: session,
				baseRefSpace: baseRefSpace,
				sessionMode: sessionMode,
				environmentBlendMode: environmentBlendMode,
				passthroughAvailableBool: sessionMode === "immersive-ar" && environmentBlendMode !== "opaque",
				depthSensingActiveBool: sessionMode === "immersive-ar" && sessionDepthState.depthSensingActiveBool,
				depthUsage: sessionDepthState.depthUsage,
				depthDataFormat: sessionDepthState.depthDataFormat
			};
		},
		createOffsetReferenceSpace: function(baseRefSpace, movementState, viewerTransform) {
			if (!baseRefSpace || !xrRigidTransform || !viewerTransform || !viewerTransform.position) {
				return baseRefSpace;
			}
			const desiredHeadOffset = rotateXZ(movementState.headPosition.x, movementState.headPosition.z, movementState.heading);
			const desiredHeadX = movementState.playerPosition.x + desiredHeadOffset.x;
			const desiredHeadY = movementState.playerPosition.y + movementState.headPosition.y;
			const desiredHeadZ = movementState.playerPosition.z + desiredHeadOffset.z;
			const offset = rotateXZ(-desiredHeadX, -desiredHeadZ, -movementState.heading);
			return baseRefSpace.getOffsetReferenceSpace(new xrRigidTransform(
				{
					x: viewerTransform.position.x + offset.x,
					y: viewerTransform.position.y - desiredHeadY,
					z: viewerTransform.position.z + offset.z
				},
				{x: 0, y: Math.sin(-movementState.heading * 0.5), z: 0, w: Math.cos(-movementState.heading * 0.5)}
			));
		}
	};
};
