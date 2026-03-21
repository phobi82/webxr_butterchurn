const PASSTHROUGH_MAX_FLASHLIGHTS = 2;
const PASSTHROUGH_MAX_SPOTS = 9;
const PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT = 2.6;
const PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE = 2.4;
const PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE = 5.6;
const PASSTHROUGH_ROOM_HALF_WIDTH = 3.6;
const PASSTHROUGH_ROOM_HALF_DEPTH = 4.4;
const PASSTHROUGH_ROOM_FLOOR_Y = 0.08;
const PASSTHROUGH_ROOM_WALL_Y = 1.35;

const getPassthroughAvailabilityState = function(args) {
	args = args || {};
	if (args.availableBool) {
		return {
			availableBool: true,
			fallbackBool: false,
			statusText: "Live headset passthrough active"
		};
	}
	if (args.sessionMode === "immersive-vr") {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: "No passthrough here, using black fallback"
		};
	}
	if (args.sessionMode === "immersive-ar") {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: args.environmentBlendMode === "opaque" ? "AR session is opaque, using black fallback" : "Passthrough unavailable, using black fallback"
		};
	}
	if (args.supportedBool) {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: "AR not active, using black fallback"
		};
	}
	return {
		availableBool: false,
		fallbackBool: true,
		statusText: "Passthrough unsupported, using black fallback"
	};
};

const projectWorldPointToUv = function(viewMatrix, projMatrix, x, y, z) {
	const viewX = viewMatrix[0] * x + viewMatrix[4] * y + viewMatrix[8] * z + viewMatrix[12];
	const viewY = viewMatrix[1] * x + viewMatrix[5] * y + viewMatrix[9] * z + viewMatrix[13];
	const viewZ = viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14];
	const clipX = projMatrix[0] * viewX + projMatrix[4] * viewY + projMatrix[8] * viewZ + projMatrix[12];
	const clipY = projMatrix[1] * viewX + projMatrix[5] * viewY + projMatrix[9] * viewZ + projMatrix[13];
	const clipW = projMatrix[3] * viewX + projMatrix[7] * viewY + projMatrix[11] * viewZ + projMatrix[15];
	if (clipW <= 0.0001) {
		return null;
	}
	const ndcX = clipX / clipW;
	const ndcY = clipY / clipW;
	if (Math.abs(ndcX) > 1.2 || Math.abs(ndcY) > 1.2) {
		return null;
	}
	return {
		x: clampNumber(ndcX * 0.5 + 0.5, 0, 1),
		y: clampNumber(ndcY * 0.5 + 0.5, 0, 1)
	};
};

const getWeightedAudioDrive = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return clampNumber(
		(audioMetrics.level || 0) * 0.24 +
		(audioMetrics.bass || 0) * 0.3 +
		(audioMetrics.transient || 0) * 0.28 +
		(audioMetrics.beatPulse || 0) * 0.5,
		0,
		1
	);
};

const getAveragedLightingColor = function(lightingState) {
	if (!lightingState) {
		return [1, 1, 1];
	}
	let totalWeight = Math.max(0.0001, lightingState.ambientStrength * 0.75);
	let colorR = lightingState.ambientColor[0] * lightingState.ambientStrength * 0.75;
	let colorG = lightingState.ambientColor[1] * lightingState.ambientStrength * 0.75;
	let colorB = lightingState.ambientColor[2] * lightingState.ambientStrength * 0.75;
	for (let i = 0; i < lightingState.lightStrengths.length; i += 1) {
		const strength = Math.max(0, lightingState.lightStrengths[i] || 0);
		if (strength <= 0.0001) {
			continue;
		}
		const colorOffset = i * 3;
		colorR += lightingState.lightColors[colorOffset] * strength;
		colorG += lightingState.lightColors[colorOffset + 1] * strength;
		colorB += lightingState.lightColors[colorOffset + 2] * strength;
		totalWeight += strength;
	}
	return [
		clampNumber(colorR / totalWeight, 0, 1),
		clampNumber(colorG / totalWeight, 0, 1),
		clampNumber(colorB / totalWeight, 0, 1)
	];
};

const getRoomCeilingLightPoint = function(directionX, directionY, directionZ) {
	if (directionY <= 0.05) {
		return null;
	}
	const roomDistance = clampNumber(
		PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT / directionY,
		PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE,
		PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE
	);
	return {
		x: clampNumber(directionX * roomDistance, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
		z: clampNumber(directionZ * roomDistance, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const getRoomFloorLightPoint = function(ceilingPoint) {
	if (!ceilingPoint) {
		return null;
	}
	return {
		x: ceilingPoint.x,
		y: PASSTHROUGH_ROOM_FLOOR_Y,
		z: ceilingPoint.z
	};
};

const getRoomWallLightPoint = function(ceilingPoint) {
	if (!ceilingPoint) {
		return null;
	}
	const absX = Math.abs(ceilingPoint.x);
	const absZ = Math.abs(ceilingPoint.z);
	if (absX <= 0.05 && absZ <= 0.05) {
		return null;
	}
	const scaleToWall = absX > absZ ? PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(absX, 0.0001) : PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(absZ, 0.0001);
	return {
		x: clampNumber(ceilingPoint.x * scaleToWall, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: PASSTHROUGH_ROOM_WALL_Y,
		z: clampNumber(ceilingPoint.z * scaleToWall, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

// Runtime controller owns session state, fallback policy, and overlay assembly.
const createPassthroughController = function(options) {
	options = options || {};
	const state = {
		availableBool: false,
		fallbackBool: true,
		supportedBool: false,
		statusText: "Passthrough unsupported, using black fallback",
		blendModeKey: options.initialBlendModeKey || "uniform",
		uniformBlendModeKey: options.initialUniformBlendModeKey || "manual",
		lightingModeKey: options.initialLightingModeKey || "uniform",
		manualMix: options.initialManualMix == null ? 0 : options.initialManualMix,
		audioReactiveIntensity: options.initialAudioReactiveIntensity == null ? 0.7 : options.initialAudioReactiveIntensity,
		flashlightRadius: options.initialFlashlightRadius == null ? 0.18 : options.initialFlashlightRadius,
		flashlightSoftness: options.initialFlashlightSoftness == null ? 0.1 : options.initialFlashlightSoftness,
		smoothedAudioDrive: 0
	};

	const getFlashlightMasks = function(args) {
		if (state.blendModeKey !== "flashlight") {
			return [];
		}
		const masks = [];
		const controllerRays = args.controllerRays || [];
		for (let i = 0; i < controllerRays.length; i += 1) {
			const ray = controllerRays[i];
			if (!ray || !ray.origin || !ray.dir) {
				continue;
			}
			const projectedUv = projectWorldPointToUv(
				args.viewMatrix,
				args.projMatrix,
				ray.origin.x + ray.dir.x * 6,
				ray.origin.y + ray.dir.y * 6,
				ray.origin.z + ray.dir.z * 6
			);
			if (!projectedUv) {
				continue;
			}
			masks.push({
				x: projectedUv.x,
				y: projectedUv.y,
				radius: clampNumber(state.flashlightRadius, 0.02, 0.45),
				softness: clampNumber(state.flashlightSoftness, 0.01, 0.35)
			});
			if (masks.length >= PASSTHROUGH_MAX_FLASHLIGHTS) {
				break;
			}
		}
		return masks;
	};

	const getSpotLights = function(args) {
		if (state.lightingModeKey !== "spots") {
			return [];
		}
		const lightingState = args.sceneLightingState;
		if (!lightingState) {
			return [];
		}
		const rankedLights = [];
		for (let i = 0; i < lightingState.lightStrengths.length; i += 1) {
			const strength = Math.max(0, lightingState.lightStrengths[i] || 0);
			if (strength <= 0.0001) {
				continue;
			}
			const directionOffset = i * 3;
			const colorOffset = i * 3;
			rankedLights.push({
				strength: strength,
				dirX: lightingState.lightDirections[directionOffset],
				dirY: lightingState.lightDirections[directionOffset + 1],
				dirZ: lightingState.lightDirections[directionOffset + 2],
				r: lightingState.lightColors[colorOffset],
				g: lightingState.lightColors[colorOffset + 1],
				b: lightingState.lightColors[colorOffset + 2]
			});
		}
		rankedLights.sort(function(a, b) {
			return b.strength - a.strength;
		});
		const audioDrive = state.smoothedAudioDrive;
		const spots = [];
		for (let i = 0; i < rankedLights.length && i < PASSTHROUGH_MAX_SPOTS; i += 1) {
			const light = rankedLights[i];
			const ceilingPoint = getRoomCeilingLightPoint(
				light.dirX,
				light.dirY,
				light.dirZ
			);
			const anchoredPoints = [
				{
					point: ceilingPoint,
					radius: clampNumber(0.12 + audioDrive * 0.1 + i * 0.012, 0.08, 0.3),
					strength: clampNumber(0.18 + light.strength * 0.24 + audioDrive * 0.22, 0, 0.72)
				},
				{
					point: getRoomFloorLightPoint(ceilingPoint),
					radius: clampNumber(0.16 + audioDrive * 0.14 + i * 0.015, 0.1, 0.38),
					strength: clampNumber(0.08 + light.strength * 0.16 + audioDrive * 0.18, 0, 0.46)
				},
				{
					point: getRoomWallLightPoint(ceilingPoint),
					radius: clampNumber(0.14 + audioDrive * 0.1 + i * 0.012, 0.09, 0.32),
					strength: clampNumber(0.1 + light.strength * 0.18 + audioDrive * 0.18, 0, 0.52)
				}
			];
			for (let j = 0; j < anchoredPoints.length && spots.length < PASSTHROUGH_MAX_SPOTS; j += 1) {
				const anchoredPoint = anchoredPoints[j];
				if (!anchoredPoint.point) {
					continue;
				}
				const projectedUv = projectWorldPointToUv(
					args.viewMatrix,
					args.projMatrix,
					anchoredPoint.point.x,
					anchoredPoint.point.y,
					anchoredPoint.point.z
				);
				if (!projectedUv) {
					continue;
				}
				spots.push({
					x: projectedUv.x,
					y: projectedUv.y,
					r: light.r,
					g: light.g,
					b: light.b,
					radius: anchoredPoint.radius,
					softness: 0.12,
					strength: anchoredPoint.strength
				});
			}
		}
		return spots;
	};


	return {
		setSessionState: function(args) {
			const availabilityState = getPassthroughAvailabilityState(args);
			state.supportedBool = !!(args && args.supportedBool);
			state.availableBool = availabilityState.availableBool;
			state.fallbackBool = availabilityState.fallbackBool;
			state.statusText = availabilityState.statusText;
		},
		updateFrame: function(args) {
			args = args || {};
			const targetDrive = getWeightedAudioDrive(args.audioMetrics);
			const delta = clampNumber(args.delta == null ? 1 / 60 : args.delta, 0, 0.1);
			const smoothFactor = clampNumber(delta * 9.5, 0.05, 1);
			state.smoothedAudioDrive = lerpNumber(state.smoothedAudioDrive, targetDrive, smoothFactor);
		},
		getUiState: function() {
			const controlState = getPassthroughControlDefinitions(state);
			return {
				availableBool: state.availableBool,
				fallbackBool: state.fallbackBool,
				statusText: state.statusText,
				blendModes: passthroughBlendModeDefinitions,
				lightingModes: passthroughLightingModeDefinitions,
				selectedBlendModeKey: state.blendModeKey,
				selectedUniformBlendModeKey: state.uniformBlendModeKey,
				selectedLightingModeKey: state.lightingModeKey,
				uniformBlendModes: passthroughUniformBlendModeDefinitions,
				primaryControl: controlState.primaryControl,
				secondaryControl: controlState.secondaryControl,
				uniformBlendModeVisibleBool: controlState.uniformBlendModeVisibleBool,
				audioDrive: state.smoothedAudioDrive,
				visibleShare: getPassthroughVisibleShare(state, state.smoothedAudioDrive)
			};
		},
		cycleBlendMode: function(direction) {
			state.blendModeKey = cycleModeKey(passthroughBlendModeDefinitions, state.blendModeKey, direction < 0 ? -1 : 1);
		},
		cycleLightingMode: function(direction) {
			state.lightingModeKey = cycleModeKey(passthroughLightingModeDefinitions, state.lightingModeKey, direction < 0 ? -1 : 1);
		},
		selectLightingMode: function(key) {
			for (let i = 0; i < passthroughLightingModeDefinitions.length; i += 1) {
				if (passthroughLightingModeDefinitions[i].key === key) {
					state.lightingModeKey = key;
					return;
				}
			}
		},
		selectUniformBlendMode: function(key) {
			for (let i = 0; i < passthroughUniformBlendModeDefinitions.length; i += 1) {
				if (passthroughUniformBlendModeDefinitions[i].key === key) {
					state.uniformBlendModeKey = key;
					return;
				}
			}
		},
		setControlValue: function(key, value) {
			if (key === "manualMix") {
				state.manualMix = clampNumber(value, 0, 1);
			}
			if (key === "audioReactiveIntensity") {
				state.audioReactiveIntensity = clampNumber(value, -1, 1);
			}
			if (key === "flashlightRadius") {
				state.flashlightRadius = clampNumber(value, 0.05, 0.45);
			}
			if (key === "flashlightSoftness") {
				state.flashlightSoftness = clampNumber(value, 0.01, 0.35);
			}
		},
		getBackgroundCompositeState: function(args) {
			args = args || {};
			const flashlightMasks = getFlashlightMasks(args);
			return {
				alpha: state.blendModeKey === "flashlight" ? 1 : clampNumber(1 - getPassthroughVisibleShare(state, state.smoothedAudioDrive), 0, 1),
				maskCount: flashlightMasks.length,
				masks: flashlightMasks
			};
		},
		getOverlayRenderState: function(args) {
			args = args || {};
			const flashlightMasks = getFlashlightMasks(args);
			const visibleShare = state.blendModeKey === "flashlight" ? 0 : getPassthroughVisibleShare(state, state.smoothedAudioDrive);
			const lightingState = args.sceneLightingState || null;
			const lightingColor = getAveragedLightingColor(lightingState);
			const tintStrength = state.lightingModeKey === "uniform" ? clampNumber(state.smoothedAudioDrive * 0.9, 0, 0.95) : 0;
			return {
				visibleShare: visibleShare,
				maskCount: flashlightMasks.length,
				masks: flashlightMasks,
				darkAlpha: 0.5,
				uniformTintColor: lightingColor,
				uniformTintStrength: tintStrength,
				lightingModeKey: state.lightingModeKey,
				spots: getSpotLights(args)
			};
		}
	};
};

const applyVisualizerBackgroundComposite = function(visualizerEngine, compositeState) {
	if (!visualizerEngine) {
		return;
	}
	if (visualizerEngine.setBackgroundCompositeState) {
		visualizerEngine.setBackgroundCompositeState(compositeState);
		return;
	}
	if (visualizerEngine.setBackgroundBlend) {
		visualizerEngine.setBackgroundBlend(1 - (compositeState && compositeState.alpha != null ? compositeState.alpha : 1), true);
	}
};

const createPassthroughOverlayRenderer = function() {
	let gl = null;
	let program = null;
	let positionLoc = null;
	let darkAlphaLoc = null;
	let visibleShareLoc = null;
	let maskCountLoc = null;
	let maskCentersLoc = null;
	let maskParamsLoc = null;
	let uniformTintColorLoc = null;
	let uniformTintStrengthLoc = null;
	let spotCountLoc = null;
	let spotCentersLoc = null;
	let spotColorsLoc = null;
	let spotParamsLoc = null;
	let buffer = null;
	const maskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const maskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const spotCenters = new Float32Array(PASSTHROUGH_MAX_SPOTS * 2);
	const spotColors = new Float32Array(PASSTHROUGH_MAX_SPOTS * 4);
	const spotParams = new Float32Array(PASSTHROUGH_MAX_SPOTS * 2);
	const uniformTintColor = new Float32Array(3);

	const fragmentSource = [
		"precision mediump float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 uniformTintColor;",
		"uniform float uniformTintStrength;",
		"uniform float spotCount;",
		"uniform vec4 spotColors[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec2 spotCenters[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec2 spotParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){",
		"float radius=max(params.x,0.0001);",
		"float softness=max(params.y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"return 1.0-smoothstep(inner,radius,distance(uv,center));",
		"}",
		"void main(){",
		"float reveal=visibleShare;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"reveal=1.0-(1.0-reveal)*(1.0-localMask);",
		"}",
		"vec3 color=uniformTintColor*uniformTintStrength*reveal;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_SPOTS + ";i+=1){",
		"if(float(i)>=spotCount){break;}",
		"float spotMask=circleMask(vScreenUv,spotCenters[i],spotParams[i]);",
		"color+=spotColors[i].rgb*(spotColors[i].a*spotMask*reveal);",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*reveal);",
		"}"
	].join("");

	return {
		init: function(glContext) {
			gl = glContext;
			program = createProgram(gl, fullscreenVertexSource, fragmentSource, "Passthrough overlay");
			positionLoc = gl.getAttribLocation(program, "position");
			darkAlphaLoc = gl.getUniformLocation(program, "darkAlpha");
			visibleShareLoc = gl.getUniformLocation(program, "visibleShare");
			maskCountLoc = gl.getUniformLocation(program, "maskCount");
			maskCentersLoc = gl.getUniformLocation(program, "maskCenters");
			maskParamsLoc = gl.getUniformLocation(program, "maskParams");
			uniformTintColorLoc = gl.getUniformLocation(program, "uniformTintColor");
			uniformTintStrengthLoc = gl.getUniformLocation(program, "uniformTintStrength");
			spotCountLoc = gl.getUniformLocation(program, "spotCount");
			spotCentersLoc = gl.getUniformLocation(program, "spotCenters");
			spotColorsLoc = gl.getUniformLocation(program, "spotColors");
			spotParamsLoc = gl.getUniformLocation(program, "spotParams");
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(renderState) {
			if (!renderState) {
				return;
			}
			const effectiveReveal = renderState.visibleShare > 0.001 || renderState.maskCount > 0;
			if (!effectiveReveal) {
				return;
			}
			for (let i = 0; i < maskCenters.length; i += 1) {
				maskCenters[i] = 0;
				maskParams[i] = 0;
			}
			for (let i = 0; i < spotCenters.length; i += 1) {
				spotCenters[i] = 0;
				spotParams[i] = 0;
			}
			for (let i = 0; i < spotColors.length; i += 1) {
				spotColors[i] = 0;
			}
			for (let i = 0; i < renderState.maskCount && i < PASSTHROUGH_MAX_FLASHLIGHTS; i += 1) {
				maskCenters[i * 2] = renderState.masks[i].x;
				maskCenters[i * 2 + 1] = renderState.masks[i].y;
				maskParams[i * 2] = renderState.masks[i].radius;
				maskParams[i * 2 + 1] = renderState.masks[i].softness;
			}
			for (let i = 0; i < renderState.spots.length && i < PASSTHROUGH_MAX_SPOTS; i += 1) {
				spotCenters[i * 2] = renderState.spots[i].x;
				spotCenters[i * 2 + 1] = renderState.spots[i].y;
				spotParams[i * 2] = renderState.spots[i].radius;
				spotParams[i * 2 + 1] = renderState.spots[i].softness;
				spotColors[i * 4] = renderState.spots[i].r;
				spotColors[i * 4 + 1] = renderState.spots[i].g;
				spotColors[i * 4 + 2] = renderState.spots[i].b;
				spotColors[i * 4 + 3] = renderState.spots[i].strength;
			}
			uniformTintColor[0] = renderState.uniformTintColor[0];
			uniformTintColor[1] = renderState.uniformTintColor[1];
			uniformTintColor[2] = renderState.uniformTintColor[2];
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1f(darkAlphaLoc, renderState.darkAlpha);
			gl.uniform1f(visibleShareLoc, renderState.visibleShare);
			gl.uniform1f(maskCountLoc, renderState.maskCount);
			gl.uniform2fv(maskCentersLoc, maskCenters);
			gl.uniform2fv(maskParamsLoc, maskParams);
			gl.uniform3fv(uniformTintColorLoc, uniformTintColor);
			gl.uniform1f(uniformTintStrengthLoc, renderState.uniformTintStrength);
			gl.uniform1f(spotCountLoc, renderState.spots.length);
			gl.uniform2fv(spotCentersLoc, spotCenters);
			gl.uniform4fv(spotColorsLoc, spotColors);
			gl.uniform2fv(spotParamsLoc, spotParams);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};
