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
	beatPulse: 0
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

const createSceneLighting = function() {
	const state = createEmptyLightingState();
	let currentPresetIndex = 0;
	const getPresetNames = function() {
		const names = [];
		for (let i = 0; i < lightingPresetDefinitions.length; i += 1) {
			names.push(lightingPresetDefinitions[i].name);
		}
		return names;
	};
	return {
		update: function(timeSeconds, audioMetrics) {
			const preset = lightingPresetDefinitions[currentPresetIndex] || lightingPresetDefinitions[0];
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
			return {
				presetNames: getPresetNames(),
				currentPresetIndex: currentPresetIndex,
				currentPresetDescription: lightingPresetDefinitions[currentPresetIndex] ? lightingPresetDefinitions[currentPresetIndex].description : ""
			};
		},
		selectPreset: function(index) {
			if (!lightingPresetDefinitions.length) {
				return Promise.resolve();
			}
			currentPresetIndex = (index + lightingPresetDefinitions.length) % lightingPresetDefinitions.length;
			return Promise.resolve();
		}
	};
};

// core/audio/audio-analysis.js
const createAnalyserNode = function(audioContext) {
	const analyser = audioContext.createAnalyser();
	analyser.fftSize = 512;
	analyser.smoothingTimeConstant = 0.58;
	return analyser;
};

const analyseAudioFrame = function(frequencyData, timeDomainData, previousFrequencyData) {
	let levelSum = 0;
	let bassSum = 0;
	let bassCount = 0;
	let fluxSum = 0;
	let rmsSum = 0;
	const bassBinLimit = Math.min(14, frequencyData.length);
	const fluxBinLimit = Math.min(56, frequencyData.length);
	for (let i = 0; i < frequencyData.length; i += 1) {
		const currentMagnitude = frequencyData[i] / 255;
		levelSum += frequencyData[i];
		if (i < bassBinLimit) {
			bassSum += frequencyData[i];
			bassCount += 1;
		}
		if (i < fluxBinLimit) {
			fluxSum += Math.max(0, currentMagnitude - previousFrequencyData[i]);
		}
		previousFrequencyData[i] = currentMagnitude;
	}
	for (let i = 0; i < timeDomainData.length; i += 1) {
		const centeredSample = (timeDomainData[i] - 128) / 128;
		rmsSum += centeredSample * centeredSample;
	}
	const averageLevel = levelSum / Math.max(1, frequencyData.length * 255);
	const bassLevel = bassCount ? bassSum / (bassCount * 255) : averageLevel;
	const rmsLevel = Math.sqrt(rmsSum / Math.max(1, timeDomainData.length));
	return {
		combinedLevel: Math.max(averageLevel, rmsLevel * 1.7),
		bassLevel: bassLevel,
		spectralFluxLevel: fluxBinLimit ? fluxSum / fluxBinLimit : 0
	};
};

const createAudioAnalyser = function() {
	let analyserNode = null;
	let frequencyData = null;
	let timeDomainData = null;
	let previousFrequencyData = null;
	let channelSplitter = null;
	let analyserLeft = null;
	let analyserRight = null;
	let frequencyDataLeft = null;
	let frequencyDataRight = null;
	let timeDomainDataLeft = null;
	let timeDomainDataRight = null;
	let previousFrequencyDataLeft = null;
	let previousFrequencyDataRight = null;
	let audioLevel = 0;
	let audioPeak = 0;
	let audioBassLevel = 0;
	let audioTransientLevel = 0;
	let audioLeftLevel = 0;
	let audioRightLevel = 0;
	let audioLeftBassLevel = 0;
	let audioRightBassLevel = 0;
	let audioMidLevel = 0;
	let audioSideLevel = 0;
	let audioStereoBalance = 0;
	let audioStereoWidth = 0;
	let audioBeatBaseline = 0;
	let audioTransientBaseline = 0;
	let beatPulse = 0;
	let beatCooldownSeconds = 0;
	let lastFrameTimeSeconds = 0;
	let debugAudioNodes = null;

	return {
		ensureNodes: function(audioContext) {
			if (analyserNode) {
				return;
			}
			analyserNode = createAnalyserNode(audioContext);
			frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
			timeDomainData = new Uint8Array(analyserNode.fftSize);
			previousFrequencyData = new Float32Array(analyserNode.frequencyBinCount);
			channelSplitter = audioContext.createChannelSplitter(2);
			analyserLeft = createAnalyserNode(audioContext);
			analyserRight = createAnalyserNode(audioContext);
			frequencyDataLeft = new Uint8Array(analyserLeft.frequencyBinCount);
			frequencyDataRight = new Uint8Array(analyserRight.frequencyBinCount);
			timeDomainDataLeft = new Uint8Array(analyserLeft.fftSize);
			timeDomainDataRight = new Uint8Array(analyserRight.fftSize);
			previousFrequencyDataLeft = new Float32Array(analyserLeft.frequencyBinCount);
			previousFrequencyDataRight = new Float32Array(analyserRight.frequencyBinCount);
			channelSplitter.connect(analyserLeft, 0);
			channelSplitter.connect(analyserRight, 1);
		},
		connectSource: function(node) {
			node.connect(analyserNode);
			node.connect(channelSplitter);
		},
		resetMetrics: function() {
			audioLevel = 0;
			audioPeak = 0;
			audioBassLevel = 0;
			audioTransientLevel = 0;
			audioLeftLevel = 0;
			audioRightLevel = 0;
			audioLeftBassLevel = 0;
			audioRightBassLevel = 0;
			audioMidLevel = 0;
			audioSideLevel = 0;
			audioStereoBalance = 0;
			audioStereoWidth = 0;
			audioBeatBaseline = 0;
			audioTransientBaseline = 0;
			beatPulse = 0;
			beatCooldownSeconds = 0;
			lastFrameTimeSeconds = 0;
			if (previousFrequencyData) { previousFrequencyData.fill(0); }
			if (previousFrequencyDataLeft) { previousFrequencyDataLeft.fill(0); }
			if (previousFrequencyDataRight) { previousFrequencyDataRight.fill(0); }
		},
		advanceFrame: function(timeSeconds) {
			if (lastFrameTimeSeconds === timeSeconds) {
				return;
			}
			let elapsedTimeSeconds = 1 / 60;
			if (lastFrameTimeSeconds > 0) {
				elapsedTimeSeconds = clampNumber(timeSeconds - lastFrameTimeSeconds, 1 / 240, 0.25);
			}
			lastFrameTimeSeconds = timeSeconds;
			if (!analyserNode || !frequencyData) {
				audioLevel *= 0.9;
				audioPeak *= 0.9;
				audioBassLevel *= 0.9;
				audioTransientLevel *= 0.86;
				audioLeftLevel *= 0.9;
				audioRightLevel *= 0.9;
				audioLeftBassLevel *= 0.9;
				audioRightBassLevel *= 0.9;
				audioMidLevel *= 0.9;
				audioSideLevel *= 0.85;
				audioStereoBalance *= 0.82;
				audioStereoWidth *= 0.85;
				audioBeatBaseline *= 0.88;
				audioTransientBaseline *= 0.88;
				beatPulse *= 0.82;
				beatCooldownSeconds = 0;
				return;
			}
			analyserNode.getByteFrequencyData(frequencyData);
			analyserNode.getByteTimeDomainData(timeDomainData);
			analyserLeft.getByteFrequencyData(frequencyDataLeft);
			analyserLeft.getByteTimeDomainData(timeDomainDataLeft);
			analyserRight.getByteFrequencyData(frequencyDataRight);
			analyserRight.getByteTimeDomainData(timeDomainDataRight);
			const mainStats = analyseAudioFrame(frequencyData, timeDomainData, previousFrequencyData);
			const leftStats = analyseAudioFrame(frequencyDataLeft, timeDomainDataLeft, previousFrequencyDataLeft);
			const rightStats = analyseAudioFrame(frequencyDataRight, timeDomainDataRight, previousFrequencyDataRight);
			const combinedLevel = mainStats.combinedLevel;
			const bassLevel = mainStats.bassLevel;
			const spectralFluxLevel = mainStats.spectralFluxLevel;
			const monoFallbackBool = combinedLevel > 0.02 && (
				leftStats.combinedLevel < combinedLevel * 0.12 && rightStats.combinedLevel > combinedLevel * 0.6 ||
				rightStats.combinedLevel < combinedLevel * 0.12 && leftStats.combinedLevel > combinedLevel * 0.6
			);
			let leftLevelInstant = leftStats.combinedLevel;
			let rightLevelInstant = rightStats.combinedLevel;
			let leftBassInstant = leftStats.bassLevel;
			let rightBassInstant = rightStats.bassLevel;
			let midLevelInstant = 0;
			let sideLevelInstant = 0;
			let stereoWidthInstant = 0;
			let stereoBalanceInstant = 0;
			if (monoFallbackBool) {
				leftLevelInstant = combinedLevel;
				rightLevelInstant = combinedLevel;
				leftBassInstant = bassLevel;
				rightBassInstant = bassLevel;
				midLevelInstant = combinedLevel;
			} else {
				let sideSpectrumSum = 0;
				let midSpectrumSum = 0;
				const stereoBinCount = Math.min(frequencyDataLeft.length, frequencyDataRight.length);
				for (let i = 0; i < stereoBinCount; i += 1) {
					const leftMagnitude = frequencyDataLeft[i] / 255;
					const rightMagnitude = frequencyDataRight[i] / 255;
					sideSpectrumSum += Math.abs(leftMagnitude - rightMagnitude);
					midSpectrumSum += (leftMagnitude + rightMagnitude) * 0.5;
				}
				midLevelInstant = (leftLevelInstant + rightLevelInstant) * 0.5;
				sideLevelInstant = clampNumber(Math.abs(leftLevelInstant - rightLevelInstant) * 1.7 + sideSpectrumSum / Math.max(1, stereoBinCount) * 0.7, 0, 1);
				stereoWidthInstant = clampNumber(sideSpectrumSum / Math.max(0.0001, midSpectrumSum + sideSpectrumSum * 0.35), 0, 1);
				stereoBalanceInstant = clampNumber((rightLevelInstant - leftLevelInstant) / Math.max(0.0001, leftLevelInstant + rightLevelInstant), -1, 1);
			}
			const transientInstant = clampNumber(spectralFluxLevel * 7.5 + Math.max(0, combinedLevel - audioLevel) * 1.4, 0, 1);
			const levelBlend = Math.min(1, elapsedTimeSeconds * 10);
			const bassBlend = Math.min(1, elapsedTimeSeconds * 12);
			const transientBlend = Math.min(1, elapsedTimeSeconds * 16);
			const stereoBlend = Math.min(1, elapsedTimeSeconds * 8.5);
			const bassBaselineBefore = audioBeatBaseline;
			const transientBaselineBefore = audioTransientBaseline;
			const baselineBlend = Math.min(1, elapsedTimeSeconds * 2.4);
			const transientBaselineBlend = Math.min(1, elapsedTimeSeconds * 3.2);
			const smoothedLevel = audioLevel + (combinedLevel - audioLevel) * levelBlend;
			const smoothedBassLevel = audioBassLevel + (bassLevel - audioBassLevel) * bassBlend;
			const bassRise = Math.max(0, bassLevel - bassBaselineBefore);
			const bassRiseThreshold = Math.max(0.012, bassBaselineBefore * 0.018);
			const transientThreshold = Math.max(0.04, transientBaselineBefore + 0.008);
			audioTransientLevel += (transientInstant - audioTransientLevel) * transientBlend;
			audioLevel = smoothedLevel;
			audioBassLevel = smoothedBassLevel;
			audioLeftLevel += (leftLevelInstant - audioLeftLevel) * levelBlend;
			audioRightLevel += (rightLevelInstant - audioRightLevel) * levelBlend;
			audioLeftBassLevel += (leftBassInstant - audioLeftBassLevel) * bassBlend;
			audioRightBassLevel += (rightBassInstant - audioRightBassLevel) * bassBlend;
			audioMidLevel += (midLevelInstant - audioMidLevel) * stereoBlend;
			audioSideLevel += (sideLevelInstant - audioSideLevel) * stereoBlend;
			audioStereoBalance += (stereoBalanceInstant - audioStereoBalance) * stereoBlend;
			audioStereoWidth += (stereoWidthInstant - audioStereoWidth) * stereoBlend;
			audioPeak = Math.max(combinedLevel, audioPeak - elapsedTimeSeconds * 0.65);
			audioBeatBaseline += (bassLevel - audioBeatBaseline) * baselineBlend;
			audioTransientBaseline += (transientInstant - audioTransientBaseline) * transientBaselineBlend;
			beatCooldownSeconds = Math.max(0, beatCooldownSeconds - elapsedTimeSeconds);
			if (beatCooldownSeconds <= 0 && bassRise > bassRiseThreshold && transientInstant > transientThreshold && combinedLevel > 0.035) {
				beatPulse = 1;
				beatCooldownSeconds = 0.18;
			} else {
				beatPulse = Math.max(0, beatPulse - elapsedTimeSeconds * 3.6);
			}
		},
		getMetrics: function() {
			return {
				level: audioLevel,
				peak: audioPeak,
				bass: audioBassLevel,
				transient: audioTransientLevel,
				beatPulse: beatPulse,
				leftLevel: audioLeftLevel,
				rightLevel: audioRightLevel,
				leftBass: audioLeftBassLevel,
				rightBass: audioRightBassLevel,
				midLevel: audioMidLevel,
				sideLevel: audioSideLevel,
				stereoBalance: audioStereoBalance,
				stereoWidth: audioStereoWidth
			};
		},
		createDebugAudioNodes: function(audioContext) {
			const mixGain = audioContext.createGain();
			mixGain.gain.value = 0.75;
			const bassOsc = audioContext.createOscillator();
			bassOsc.type = "sine";
			bassOsc.frequency.value = 55;
			const bassGain = audioContext.createGain();
			bassGain.gain.value = 0.055;
			const bassLfo = audioContext.createOscillator();
			bassLfo.type = "triangle";
			bassLfo.frequency.value = 1.85;
			const bassLfoGain = audioContext.createGain();
			bassLfoGain.gain.value = 0.11;
			bassOsc.connect(bassGain);
			bassGain.connect(mixGain);
			bassLfo.connect(bassLfoGain);
			bassLfoGain.connect(bassGain.gain);
			const kickOsc = audioContext.createOscillator();
			kickOsc.type = "triangle";
			kickOsc.frequency.value = 43;
			const kickGain = audioContext.createGain();
			kickGain.gain.value = 0;
			const kickBase = audioContext.createConstantSource();
			kickBase.offset.value = 0.03;
			const kickLfo = audioContext.createOscillator();
			kickLfo.type = "square";
			kickLfo.frequency.value = 2.05;
			const kickLfoGain = audioContext.createGain();
			kickLfoGain.gain.value = 0.1;
			kickOsc.connect(kickGain);
			kickGain.connect(mixGain);
			kickBase.connect(kickGain.gain);
			kickLfo.connect(kickLfoGain);
			kickLfoGain.connect(kickGain.gain);
			const midOsc = audioContext.createOscillator();
			midOsc.type = "sawtooth";
			midOsc.frequency.value = 220;
			const midGain = audioContext.createGain();
			midGain.gain.value = 0.012;
			const midLfo = audioContext.createOscillator();
			midLfo.type = "sine";
			midLfo.frequency.value = 5.1;
			const midLfoGain = audioContext.createGain();
			midLfoGain.gain.value = 0.02;
			midOsc.connect(midGain);
			midGain.connect(mixGain);
			midLfo.connect(midLfoGain);
			midLfoGain.connect(midGain.gain);
			const highOsc = audioContext.createOscillator();
			highOsc.type = "square";
			highOsc.frequency.value = 1320;
			const highGain = audioContext.createGain();
			highGain.gain.value = 0.004;
			const highLfo = audioContext.createOscillator();
			highLfo.type = "square";
			highLfo.frequency.value = 7.6;
			const highLfoGain = audioContext.createGain();
			highLfoGain.gain.value = 0.012;
			highOsc.connect(highGain);
			highGain.connect(mixGain);
			highLfo.connect(highLfoGain);
			highLfoGain.connect(highGain.gain);
			const sweepFilter = audioContext.createBiquadFilter();
			sweepFilter.type = "lowpass";
			sweepFilter.frequency.value = 1600;
			const filterLfo = audioContext.createOscillator();
			filterLfo.type = "sine";
			filterLfo.frequency.value = 0.21;
			const filterLfoGain = audioContext.createGain();
			filterLfoGain.gain.value = 1200;
			mixGain.connect(sweepFilter);
			filterLfo.connect(filterLfoGain);
			filterLfoGain.connect(sweepFilter.frequency);
			bassOsc.start();
			bassLfo.start();
			kickOsc.start();
			kickBase.start();
			kickLfo.start();
			midOsc.start();
			midLfo.start();
			highOsc.start();
			highLfo.start();
			filterLfo.start();
			debugAudioNodes = {
				inputNode: sweepFilter,
				stopNodes: [bassOsc, bassLfo, kickOsc, kickBase, kickLfo, midOsc, midLfo, highOsc, highLfo, filterLfo],
				disconnectNodes: [bassGain, bassLfoGain, kickGain, kickLfoGain, midGain, midLfoGain, highGain, highLfoGain, mixGain, sweepFilter, filterLfoGain]
			};
			return debugAudioNodes;
		},
		destroyDebugAudioNodes: function() {
			if (!debugAudioNodes) {
				return;
			}
			const stopNodes = debugAudioNodes.stopNodes || [];
			for (let i = 0; i < stopNodes.length; i += 1) {
				try { stopNodes[i].stop(); } catch (error) {}
			}
			const disconnectNodes = debugAudioNodes.disconnectNodes || [];
			for (let i = 0; i < disconnectNodes.length; i += 1) {
				try { disconnectNodes[i].disconnect(); } catch (error) {}
			}
			debugAudioNodes = null;
		}
	};
};

// core/audio/audio-source-controller.js
const createAudioSourceController = function(options) {
	const mediaDevices = options.mediaDevices || null;
	const openWindow = options.openWindow || function(url, windowName) {
		return window.open(url, windowName);
	};
	const controller = {
		audioBackend: null,
		activeStream: null,
		sourceKind: "none",
		sourceName: "",
		windowHandles: {}
	};

	const setStatus = function(text) {
		if (options.setStatus) {
			options.setStatus(text);
		}
	};

	const updateUiState = function() {
		if (options.onStateChange) {
			options.onStateChange({
				sourceKind: controller.sourceKind,
				sourceName: controller.sourceName,
				stopEnabledBool: controller.sourceKind !== "none"
			});
		}
	};

	const syncBackendState = function() {
		const audioBackend = controller.audioBackend;
		if (!audioBackend) {
			return Promise.resolve();
		}
		if (controller.sourceKind === "debug" && audioBackend.startDebugAudio) {
			return audioBackend.startDebugAudio();
		}
		if (audioBackend.setAudioStream) {
			audioBackend.setAudioStream(controller.activeStream);
		}
		return Promise.resolve();
	};

	const clearActiveStream = function() {
		if (!controller.activeStream) {
			return;
		}
		const oldStream = controller.activeStream;
		controller.activeStream = null;
		const tracks = oldStream.getTracks();
		for (let i = 0; i < tracks.length; i += 1) {
			tracks[i].stop();
		}
	};

	const resetSourceState = function() {
		controller.sourceKind = "none";
		controller.sourceName = "";
		updateUiState();
	};

	const setStreamSource = async function(stream, sourceName) {
		clearActiveStream();
		controller.activeStream = stream;
		controller.sourceKind = stream ? "stream" : "none";
		controller.sourceName = stream ? sourceName || "shared surface" : "";
		updateUiState();
		await syncBackendState();
		if (!stream) {
			return;
		}
		const tracks = stream.getTracks();
		for (let i = 0; i < tracks.length; i += 1) {
			tracks[i].addEventListener("ended", function() {
				if (controller.activeStream === stream) {
					controller.activeStream = null;
					resetSourceState();
					syncBackendState();
				}
			});
		}
	};

	const activateAudio = async function() {
		const audioBackend = controller.audioBackend;
		if (!audioBackend || !audioBackend.activateAudio) {
			return;
		}
		try {
			await audioBackend.activateAudio();
		} catch (error) {
		}
	};

	const requestDisplayAudio = async function(sourceName, optionOverrides) {
		if (!mediaDevices || !mediaDevices.getDisplayMedia) {
			throw new Error("display capture unavailable");
		}
		const optionsMap = {
			video: true,
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false
			},
			surfaceSwitching: "include",
			monitorTypeSurfaces: "include",
			systemAudio: "include",
			selfBrowserSurface: "exclude"
		};
		if (optionOverrides) {
			const overrideKeys = Object.keys(optionOverrides);
			for (let i = 0; i < overrideKeys.length; i += 1) {
				optionsMap[overrideKeys[i]] = optionOverrides[overrideKeys[i]];
			}
		}
		const stream = await mediaDevices.getDisplayMedia(optionsMap);
		if (!stream.getAudioTracks().length) {
			const tracks = stream.getTracks();
			for (let i = 0; i < tracks.length; i += 1) {
				tracks[i].stop();
			}
			throw new Error("shared source has no audio track");
		}
		return setStreamSource(stream, sourceName || "shared surface");
	};

	return {
		setAudioBackend: function(audioBackend) {
			controller.audioBackend = audioBackend || null;
			return syncBackendState();
		},
		activate: function() {
			return activateAudio();
		},
		stop: function() {
			clearActiveStream();
			resetSourceState();
			return syncBackendState();
		},
		requestSharedAudio: async function() {
			await activateAudio();
			return requestDisplayAudio();
		},
		requestMicrophoneAudio: async function() {
			if (!mediaDevices || !mediaDevices.getUserMedia) {
				throw new Error("microphone capture unavailable");
			}
			await activateAudio();
			const stream = await mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				},
				video: false
			});
			return setStreamSource(stream, "microphone");
		},
		requestTabAudio: async function(args) {
			args = args || {};
			await activateAudio();
			if (!controller.windowHandles[args.key] || controller.windowHandles[args.key].closed) {
				controller.windowHandles[args.key] = openWindow(args.url, args.windowName);
			} else {
				controller.windowHandles[args.key].location.href = args.url;
			}
			if (!controller.windowHandles[args.key]) {
				throw new Error(args.blockedMessage || "tab blocked");
			}
			try { controller.windowHandles[args.key].focus(); } catch (error) {}
			setStatus(args.selectStatus || "select the tab and enable tab audio");
			await requestDisplayAudio(args.sourceName, {preferCurrentTab: false});
			setStatus(args.activeStatus || "tab audio active");
		},
		startDebugAudio: async function() {
			clearActiveStream();
			await activateAudio();
			const audioBackend = controller.audioBackend;
			if (!audioBackend || !audioBackend.startDebugAudio) {
				return;
			}
			await audioBackend.startDebugAudio();
			controller.sourceKind = "debug";
			controller.sourceName = "debug signal";
			updateUiState();
		}
	};
};

// core/xr-session.js
const createXrSessionBridge = function(options) {
	const xrApi = options.xrApi || null;
	const xrWebGLLayer = options.xrWebGLLayer || null;
	const xrRigidTransform = options.xrRigidTransform || null;
	return {
		isAvailable: function() {
			return !!xrApi;
		},
		isSupported: async function() {
			if (!xrApi) {
				return false;
			}
			return xrApi.isSessionSupported("immersive-vr");
		},
		startSession: async function(gl, onEnd) {
			const session = await xrApi.requestSession("immersive-vr", {requiredFeatures: ["local-floor"]});
			if (onEnd) {
				session.addEventListener("end", onEnd);
			}
			await gl.makeXRCompatible();
			let framebufferScaleFactor = 1;
			if (xrWebGLLayer && typeof xrWebGLLayer.getNativeFramebufferScaleFactor === "function") {
				framebufferScaleFactor = xrWebGLLayer.getNativeFramebufferScaleFactor(session) || 1;
			}
			session.updateRenderState({
				baseLayer: new xrWebGLLayer(session, gl, {framebufferScaleFactor: framebufferScaleFactor})
			});
			const baseRefSpace = await session.requestReferenceSpace("local-floor");
			return {session: session, baseRefSpace: baseRefSpace};
		},
		createOffsetReferenceSpace: function(baseRefSpace, movementState) {
			if (!baseRefSpace || !xrRigidTransform) {
				return baseRefSpace;
			}
			const offset = rotateXZ(-movementState.origin.x, -movementState.origin.z, -movementState.heading);
			return baseRefSpace.getOffsetReferenceSpace(new xrRigidTransform(
				{x: offset.x, y: -(movementState.origin.y + movementState.effectiveEyeHeightMeters - movementState.currentBaseEyeHeightMeters), z: offset.z},
				{x: 0, y: Math.sin(-movementState.heading * 0.5), z: 0, w: Math.cos(-movementState.heading * 0.5)}
			));
		}
	};
};
