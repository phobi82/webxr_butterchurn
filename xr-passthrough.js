const PASSTHROUGH_MAX_FLASHLIGHTS = 2;
const PASSTHROUGH_MAX_SPOTS = 24;
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

const getRoomPointForFixtureGroup = function(group, variantOffset, fillMix) {
	group = group || {};
	const anchorType = group.anchorType || "ceiling";
	const azimuth = (group.azimuth || 0) + variantOffset;
	const radialScale = clampNumber((group.radius == null ? 0.5 : group.radius) * (0.58 + fillMix * 0.42), 0.18, 1.18);
	if (anchorType === "ceiling") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale
		};
	}
	if (anchorType === "floor") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_FLOOR_Y,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale
		};
	}
	const wallScaleX = PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(Math.abs(Math.cos(azimuth)), 0.0001);
	const wallScaleZ = PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(Math.abs(Math.sin(azimuth)), 0.0001);
	const wallScale = Math.min(wallScaleX, wallScaleZ) * radialScale;
	return {
		x: clampNumber(Math.cos(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: lerpNumber(PASSTHROUGH_ROOM_FLOOR_Y + 0.42, PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT - 0.32, group.vertical == null ? 0.55 : group.vertical),
		z: clampNumber(Math.sin(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const appendClubFixtureMasks = function(target, args, group, clubState) {
	if (!target || !group || !args || !args.viewMatrix || !args.projMatrix) {
		return;
	}
	const fillMix = clampNumber((clubState.clubRoomFill || 0) * 0.8 + (group.type === "wash" ? 0.2 : 0), 0.18, 1);
	const sweep = clampNumber(group.sweep == null ? 0.2 : group.sweep, 0, 1.5);
	const baseStrength = Math.max(0, group.intensity || 0) * clampNumber(clubState.clubIntensity || 0, 0, 1);
	if (baseStrength <= 0.0001) {
		return;
	}
	const strobeBoost = 1 + clampNumber((group.strobeAmount || 0) * (clubState.clubStrobeAmount || 0) * 1.4, 0, 1.4);
	const typeIntensityScale = group.type === "wash" ? (0.7 + (clubState.clubRoomFill || 0) * 0.4) : (group.type === "beam" ? (0.88 - (clubState.clubRoomFill || 0) * 0.16) : (0.8 + (clubState.clubStrobeAmount || 0) * 0.65));
	const variantCount = group.type === "beam" ? 3 : (group.type === "wash" ? 2 : 1);
	for (let i = 0; i < variantCount && target.length < PASSTHROUGH_MAX_SPOTS; i += 1) {
		const variantCenter = variantCount === 1 ? 0 : (i / (variantCount - 1)) - 0.5;
		const variantOffset = variantCenter * sweep * (group.type === "beam" ? 0.52 : 0.24);
		const point = getRoomPointForFixtureGroup(group, variantOffset, fillMix);
		const projectedUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, point.x, point.y, point.z);
		if (!projectedUv) {
			continue;
		}
		let rotation = 0;
		const tangentPoint = getRoomPointForFixtureGroup(group, variantOffset + 0.08, fillMix);
		const projectedTangentUv = tangentPoint ? projectWorldPointToUv(args.viewMatrix, args.projMatrix, tangentPoint.x, tangentPoint.y, tangentPoint.z) : null;
		if (projectedTangentUv) {
			rotation = Math.atan2(projectedTangentUv.y - projectedUv.y, projectedTangentUv.x - projectedUv.x);
		}
		let radiusX = 0.18;
		let radiusY = 0.18;
		if (group.type === "wash") {
			radiusX = clampNumber((group.radius || 0.4) * (0.22 + fillMix * 0.16), 0.14, 0.46);
			radiusY = clampNumber(radiusX * lerpNumber(0.74, 0.92, fillMix), 0.12, 0.42);
		} else if (group.type === "beam") {
			radiusX = clampNumber((group.radius || 0.3) * (0.18 + (1 - fillMix) * 0.12), 0.12, 0.34);
			radiusY = clampNumber(radiusX * 0.28, 0.035, 0.11);
		} else {
			radiusX = clampNumber((group.radius || 0.22) * 0.18, 0.09, 0.2);
			radiusY = clampNumber(radiusX * 0.6, 0.05, 0.14);
		}
		target.push({
			x: projectedUv.x,
			y: projectedUv.y,
			r: group.color[0],
			g: group.color[1],
			b: group.color[2],
			radiusX: radiusX,
			radiusY: radiusY,
			rotation: rotation,
			softness: clampNumber(group.softness == null ? 0.16 : group.softness, 0.04, 0.4),
			strength: clampNumber(baseStrength * typeIntensityScale * strobeBoost * (group.type === "beam" ? 0.72 : 1) * (1 - Math.abs(variantCenter) * 0.16), 0, group.type === "strobe" ? 0.88 : 0.72)
		});
	}
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
		clubIntensity: options.initialClubIntensity == null ? 0.82 : options.initialClubIntensity,
		clubRoomFill: options.initialClubRoomFill == null ? 0.74 : options.initialClubRoomFill,
		clubStrobeAmount: options.initialClubStrobeAmount == null ? 0.35 : options.initialClubStrobeAmount,
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
					radiusX: anchoredPoint.radius,
					radiusY: anchoredPoint.radius,
					rotation: 0,
					softness: 0.12,
					strength: anchoredPoint.strength
				});
			}
		}
		return spots;
	};

	const getClubLights = function(args) {
		if (state.lightingModeKey !== "club") {
			return [];
		}
		const lightingState = args.sceneLightingState;
		if (!lightingState || !lightingState.fixtureGroups || !lightingState.fixtureGroups.length) {
			return [];
		}
		const rankedGroups = lightingState.fixtureGroups.slice().sort(function(a, b) {
			return (b.intensity || 0) - (a.intensity || 0);
		});
		const spots = [];
		for (let i = 0; i < rankedGroups.length && spots.length < PASSTHROUGH_MAX_SPOTS; i += 1) {
			appendClubFixtureMasks(spots, args, rankedGroups[i], state);
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
			const lightingControlState = getPassthroughLightingControlDefinitions(state);
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
				lightingPrimaryControl: lightingControlState.primaryControl,
				lightingSecondaryControl: lightingControlState.secondaryControl,
				lightingTertiaryControl: lightingControlState.tertiaryControl,
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
			if (key === "clubIntensity") {
				state.clubIntensity = clampNumber(value, 0, 1);
			}
			if (key === "clubRoomFill") {
				state.clubRoomFill = clampNumber(value, 0, 1);
			}
			if (key === "clubStrobeAmount") {
				state.clubStrobeAmount = clampNumber(value, 0, 1);
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
				spots: state.lightingModeKey === "club" ? getClubLights(args) : getSpotLights(args)
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
	const spotParams = new Float32Array(PASSTHROUGH_MAX_SPOTS * 4);
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
		"uniform vec4 spotParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){",
		"float radius=max(params.x,0.0001);",
		"float softness=max(params.y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"return 1.0-smoothstep(inner,radius,distance(uv,center));",
		"}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){",
		"float radiusX=max(params.x,0.0001);",
		"float radiusY=max(params.y,0.0001);",
		"float softness=max(params.z,0.0001);",
		"float rotation=params.w;",
		"vec2 delta=uv-center;",
		"float cosAngle=cos(rotation);",
		"float sinAngle=sin(rotation);",
		"vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);",
		"float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));",
		"float edge=max(softness/max(radiusX,radiusY),0.0001);",
		"return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);",
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
		"float spotMask=ellipseMask(vScreenUv,spotCenters[i],spotParams[i]);",
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
			}
			for (let i = 0; i < spotParams.length; i += 1) {
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
				spotParams[i * 4] = renderState.spots[i].radiusX == null ? renderState.spots[i].radius : renderState.spots[i].radiusX;
				spotParams[i * 4 + 1] = renderState.spots[i].radiusY == null ? renderState.spots[i].radius : renderState.spots[i].radiusY;
				spotParams[i * 4 + 2] = renderState.spots[i].softness;
				spotParams[i * 4 + 3] = renderState.spots[i].rotation || 0;
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
			gl.uniform4fv(spotParamsLoc, spotParams);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};
