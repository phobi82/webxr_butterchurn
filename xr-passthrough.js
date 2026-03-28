const PASSTHROUGH_MAX_FLASHLIGHTS = 2;
const PASSTHROUGH_MAX_SPOTS = 24;
const PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT = 2.6;
const PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE = 2.4;
const PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE = 5.6;
const PASSTHROUGH_ROOM_HALF_WIDTH = 3.6;
const PASSTHROUGH_ROOM_HALF_DEPTH = 4.4;
const PASSTHROUGH_ROOM_FLOOR_Y = 0.08;
const PASSTHROUGH_ROOM_WALL_Y = 1.35;
const PASSTHROUGH_DEPTH_MIN_METERS = 0.15;
const PASSTHROUGH_DEPTH_MAX_METERS = 12;

const PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT = "current";
const PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY = "additiveOnly";
const PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY = "alphaBlendOnly";

const passthroughEffectSemanticModeDefinitions = [
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT, label: "Current"},
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY, label: "Additive Only"},
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY, label: "Alpha Blend Only"}
];

const getPassthroughEffectSemanticModeLabel = function(modeKey) {
	for (let i = 0; i < passthroughEffectSemanticModeDefinitions.length; i += 1) {
		if (passthroughEffectSemanticModeDefinitions[i].key === modeKey) {
			return passthroughEffectSemanticModeDefinitions[i].label;
		}
	}
	return "Current";
};

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

const getWorldDirectionForUv = function(viewMatrix, projMatrix, uv) {
	const ndcX = clampNumber((uv.x || 0) * 2 - 1, -1, 1);
	const ndcY = clampNumber((uv.y || 0) * 2 - 1, -1, 1);
	const projScaleX = Math.abs(projMatrix[0] || 0) > 0.0001 ? projMatrix[0] : 1;
	const projScaleY = Math.abs(projMatrix[5] || 0) > 0.0001 ? projMatrix[5] : 1;
	const viewX = (ndcX + (projMatrix[8] || 0)) / projScaleX;
	const viewY = (ndcY + (projMatrix[9] || 0)) / projScaleY;
	return normalizeVec3(
		viewMatrix[0] * viewX + viewMatrix[1] * viewY - viewMatrix[2],
		viewMatrix[4] * viewX + viewMatrix[5] * viewY - viewMatrix[6],
		viewMatrix[8] * viewX + viewMatrix[9] * viewY - viewMatrix[10]
	);
};

// pre-allocated to avoid per-frame garbage in depth anchor hot path
const reusableDepthAnchorState = {depthMeters: 0, radiusScale: 1, point: {x: 0, y: 0, z: 0}};
const getDepthAnchorState = function(args, projectedUv, fallbackPoint) {
	if (!args || !args.depthInfo || typeof args.depthInfo.getDepthInMeters !== "function" || !args.viewMatrix || !args.projMatrix || !projectedUv) {
		return null;
	}
	let depthMeters = 0;
	try { depthMeters = args.depthInfo.getDepthInMeters(projectedUv.x, 1 - projectedUv.y) || 0; } catch (e) { depthMeters = 0; }
	if (!Number.isFinite(depthMeters) || depthMeters < PASSTHROUGH_DEPTH_MIN_METERS || depthMeters > PASSTHROUGH_DEPTH_MAX_METERS) {
		return null;
	}
	const cameraPosition = extractCameraPositionFromViewMatrix(args.viewMatrix);
	const fallbackDistance = fallbackPoint ? Math.sqrt(
		Math.pow(fallbackPoint.x - cameraPosition.x, 2) +
		Math.pow(fallbackPoint.y - cameraPosition.y, 2) +
		Math.pow(fallbackPoint.z - cameraPosition.z, 2)
	) : depthMeters;
	const worldDirection = getWorldDirectionForUv(args.viewMatrix, args.projMatrix, projectedUv);
	reusableDepthAnchorState.depthMeters = depthMeters;
	reusableDepthAnchorState.radiusScale = clampNumber(fallbackDistance / Math.max(depthMeters, 0.0001), 0.65, 1.85);
	reusableDepthAnchorState.point.x = cameraPosition.x + worldDirection.x * depthMeters;
	reusableDepthAnchorState.point.y = cameraPosition.y + worldDirection.y * depthMeters;
	reusableDepthAnchorState.point.z = cameraPosition.z + worldDirection.z * depthMeters;
	return reusableDepthAnchorState;
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

const getPassthroughBlendDrive = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return clampNumber(audioMetrics.beatPulse || 0, 0, 1);
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

const getFixtureSurfaceKey = function(anchorType) {
	if (anchorType === "floor") {
		return "floor";
	}
	if (anchorType === "wall") {
		return "wall";
	}
	return "ceiling";
};

const getClubSurfaceBudget = function(surfaceKey, audioMetrics, clubState) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	const fillMix = clampNumber((audioMetrics.roomFill || 0) * 0.82 + (audioMetrics.bass || 0) * 0.12, 0, 1);
	const clubIntensity = clampNumber((audioMetrics.level || 0) * 0.4 + (audioMetrics.beatPulse || 0) * 0.3 + 0.3, 0.3, 1);
	if (surfaceKey === "floor") {
		return {
			strengthScale: 1.12 + fillMix * 0.22 + (audioMetrics.bass || 0) * 0.14 + (audioMetrics.bassHit || 0) * 0.26 + (audioMetrics.kickGate || 0) * 0.16,
			minimumStrength: 0.14 + clubIntensity * 0.12 + fillMix * 0.1 + (audioMetrics.roomFill || 0) * 0.08,
			radiusScale: 1.32 + fillMix * 0.12 + (audioMetrics.bass || 0) * 0.14,
			softnessBias: 0.05,
			radialScale: 0.66,
			depthScale: 0.48,
			washVariantCountBoost: 2,
			beamVariantCountBoost: 1,
			strobeVariantCountBoost: 1,
			washRadiusXScale: 1.24,
			washRadiusYScale: 1.62,
			beamRadiusXScale: 1,
			beamRadiusYScale: 1,
			strobeRadiusXScale: 1.04,
			strobeRadiusYScale: 1.12
		};
	}
	if (surfaceKey === "wall") {
		return {
			strengthScale: 0.92 + (1 - fillMix) * 0.08 + (audioMetrics.stereoWidth || 0) * 0.12 + (audioMetrics.transient || 0) * 0.08,
			minimumStrength: 0.05 + (audioMetrics.stereoWidth || 0) * 0.04,
			radiusScale: 0.98,
			softnessBias: -0.01,
			radialScale: 1,
			depthScale: 1,
			washVariantCountBoost: 0,
			beamVariantCountBoost: 0,
			strobeVariantCountBoost: 0,
			washRadiusXScale: 0.92,
			washRadiusYScale: 0.84,
			beamRadiusXScale: 1.58,
			beamRadiusYScale: 0.56,
			strobeRadiusXScale: 0.94,
			strobeRadiusYScale: 0.88
		};
	}
	return {
		strengthScale: 0.92 + fillMix * 0.18 + (audioMetrics.roomFill || 0) * 0.12,
		minimumStrength: 0.05 + fillMix * 0.04,
		radiusScale: 1.12 + fillMix * 0.08,
		softnessBias: 0.05,
		radialScale: 0.98,
		depthScale: 0.96,
		washVariantCountBoost: 1,
		beamVariantCountBoost: 0,
		strobeVariantCountBoost: 0,
		washRadiusXScale: 1.36,
		washRadiusYScale: 1.22,
		beamRadiusXScale: 0.96,
		beamRadiusYScale: 1.04,
		strobeRadiusXScale: 1,
		strobeRadiusYScale: 1
	};
};

const getRoomPointForFixtureGroup = function(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset) {
	group = group || {};
	const anchorType = group.anchorType || "ceiling";
	const azimuth = (group.azimuth || 0) + variantOffset + (stereoBiasOffset || 0);
	surfaceBudget = surfaceBudget || getClubSurfaceBudget(getFixtureSurfaceKey(anchorType), emptyAudioMetrics, null);
	const radialScale = clampNumber((group.radius == null ? 0.5 : group.radius) * (0.58 + fillMix * 0.42) * surfaceBudget.radialScale, 0.18, 1.18);
	if (anchorType === "ceiling") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale
		};
	}
	if (anchorType === "floor") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_FLOOR_Y,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale
		};
	}
	if (Math.abs(group.stereoBias || 0) > 0.1) {
		const trackDepth = Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale;
		const depthSign = trackDepth < 0 ? -1 : 1;
		const depthLane = 0.26 + Math.abs(trackDepth / Math.max(PASSTHROUGH_ROOM_HALF_DEPTH, 0.0001)) * 0.74;
		return {
			x: PASSTHROUGH_ROOM_HALF_WIDTH * (group.stereoBias < 0 ? -1 : 1),
			y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
			z: clampNumber(depthSign * PASSTHROUGH_ROOM_HALF_DEPTH * depthLane, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
		};
	}
	const wallScaleX = PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(Math.abs(Math.cos(azimuth)), 0.0001);
	const wallScaleZ = PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(Math.abs(Math.sin(azimuth)), 0.0001);
	const wallScale = Math.min(wallScaleX, wallScaleZ) * radialScale;
	return {
		x: clampNumber(Math.cos(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
		z: clampNumber(Math.sin(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const appendControllerFlashlightMasks = function(target, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost) {
	const controllerRays = args.controllerRays || [];
	for (let i = 0; i < controllerRays.length && target.length < PASSTHROUGH_MAX_SPOTS; i += 1) {
		const ray = controllerRays[i];
		if (!ray || !ray.origin || !ray.dir) {
			continue;
		}
		const point = ray.hitPoint || {
			x: ray.origin.x + ray.dir.x * 6,
			y: ray.origin.y + ray.dir.y * 6,
			z: ray.origin.z + ray.dir.z * 6
		};
		const projectedUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, point.x, point.y, point.z);
		if (!projectedUv) {
			continue;
		}
		const tangentProjectedUv = projectWorldPointToUv(
			args.viewMatrix,
			args.projMatrix,
			point.x + ray.dir.x * 0.4,
			point.y + ray.dir.y * 0.4,
			point.z + ray.dir.z * 0.4
		);
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: 0,
			stereoBiasOffset: 0
		});
		const baseRadius = clampNumber((group.radius || 0.4) * (group.type === "wash" ? 0.26 : 0.22), 0.12, 0.42);
		target.push({
			x: projectedUv.x,
			y: projectedUv.y,
			r: group.color[0],
			g: group.color[1],
			b: group.color[2],
			radiusX: clampNumber(baseRadius * 1.18, 0.12, 0.48),
			radiusY: clampNumber(baseRadius * 0.84, 0.1, 0.38),
			rotation: tangentProjectedUv ? Math.atan2(tangentProjectedUv.y - projectedUv.y, tangentProjectedUv.x - projectedUv.x) : 0,
			softness: clampNumber((group.softness == null ? 0.16 : group.softness), 0.04, 0.4),
			alphaBlendStrength: effectState.alphaBlendStrength,
			effectType: effectState.type,
			effectPhase: effectState.phase,
			effectDensity: effectState.density,
			effectAmount: effectState.amount,
			strength: clampNumber(baseStrength * typeIntensityScale * strobeBoost, 0, group.type === "strobe" ? 0.88 : 0.72)
		});
	}
};

const appendClubFixtureMasks = function(target, args, group, clubState) {
	if (!target || !group || !args || !args.viewMatrix || !args.projMatrix) {
		return;
	}
	const surfaceKey = getFixtureSurfaceKey(group.anchorType);
	const surfaceBudget = getClubSurfaceBudget(surfaceKey, args.audioMetrics, clubState);
	const fillMix = clampNumber((args.audioMetrics && args.audioMetrics.roomFill || 0) * 0.8 + (group.type === "wash" ? 0.2 : 0), 0.18, 1);
	const stereoBiasOffset = clampNumber(((group.stereoBias || 0) * ((args.audioMetrics && args.audioMetrics.stereoBalance) || 0)) * 0.34, -0.34, 0.34);
	const sweep = clampNumber(group.sweep == null ? 0.2 : group.sweep, 0, 1.5);
	const baseStrength = Math.max(0, group.intensity || 0);
	if (baseStrength <= 0.0001) {
		return;
	}
	const strobeBoost = 1 + clampNumber((group.strobeAmount || 0) * 0.55, 0, 0.55);
	const typeIntensityScale = group.type === "wash" ? (0.78 + fillMix * 0.24) : (group.type === "beam" ? (0.92 - fillMix * 0.08) : 0.92);
	if ((group.effectMode || "") === FIXTURE_EFFECT_MODE_FLASHLIGHT && (args.controllerRays || []).length > 0) {
		appendControllerFlashlightMasks(target, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost);
		return;
	}
	const variantCount = Math.min(
		PASSTHROUGH_MAX_SPOTS,
		(group.type === "beam" ? 3 : (group.type === "wash" ? 2 : 1)) +
		(group.type === "wash" ? (surfaceBudget.washVariantCountBoost || 0) : (group.type === "beam" ? (surfaceBudget.beamVariantCountBoost || 0) : (surfaceBudget.strobeVariantCountBoost || 0)))
	);
	for (let i = 0; i < variantCount && target.length < PASSTHROUGH_MAX_SPOTS; i += 1) {
		const variantCenter = variantCount === 1 ? 0 : (i / (variantCount - 1)) - 0.5;
		const variantOffset = variantCenter * sweep * (group.type === "beam" ? (surfaceKey === "wall" ? 0.64 : 0.52) : (surfaceKey === "floor" ? 0.3 : 0.24));
		const point = getRoomPointForFixtureGroup(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset);
		const projectedUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, point.x, point.y, point.z);
		if (!projectedUv) {
			continue;
		}
		const depthAnchorState = getDepthAnchorState(args, projectedUv, point);
		let rotation = 0;
		const tangentPoint = getRoomPointForFixtureGroup(group, variantOffset + 0.08, fillMix, surfaceBudget, stereoBiasOffset);
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
		if (group.type === "wash") {
			radiusX *= surfaceBudget.washRadiusXScale;
			radiusY *= surfaceBudget.washRadiusYScale;
		} else if (group.type === "beam") {
			radiusX *= surfaceBudget.beamRadiusXScale;
			radiusY *= surfaceBudget.beamRadiusYScale;
		} else {
			radiusX *= surfaceBudget.strobeRadiusXScale;
			radiusY *= surfaceBudget.strobeRadiusYScale;
		}
		radiusX = clampNumber(radiusX * surfaceBudget.radiusScale * (surfaceKey === "floor" && group.type === "wash" ? 1.08 : 1), 0.08, 0.5);
		radiusY = clampNumber(radiusY * surfaceBudget.radiusScale * (surfaceKey === "floor" ? 1.12 : 1), 0.04, 0.48);
		if (depthAnchorState) {
			radiusX = clampNumber(radiusX * depthAnchorState.radiusScale, 0.06, 0.5);
			radiusY = clampNumber(radiusY * depthAnchorState.radiusScale, 0.03, 0.48);
		}
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: variantCenter,
			stereoBiasOffset: stereoBiasOffset
		});
		if (effectState.mode === FIXTURE_EFFECT_MODE_AURORA_CURTAIN && surfaceKey === "ceiling") {
			radiusX = clampNumber(radiusX * 1.18, 0.12, 0.5);
			radiusY = clampNumber(radiusY * 0.52, 0.04, 0.18);
		} else if (effectState.mode === FIXTURE_EFFECT_MODE_FLASHLIGHT) {
			radiusX = clampNumber(radiusX * (group.type === "beam" ? 1.18 : 1.08), 0.12, 0.5);
			radiusY = clampNumber(Math.max(radiusY * 1.9, radiusX * 0.72), 0.12, 0.44);
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
			softness: clampNumber((group.softness == null ? 0.16 : group.softness) + surfaceBudget.softnessBias, 0.04, 0.4),
			alphaBlendStrength: effectState.alphaBlendStrength,
			effectType: effectState.type,
			effectPhase: effectState.phase,
			effectDensity: effectState.density,
			effectAmount: effectState.amount,
			strength: clampNumber(
				surfaceBudget.minimumStrength +
				baseStrength * surfaceBudget.strengthScale * typeIntensityScale * strobeBoost * (effectState.mode === FIXTURE_EFFECT_MODE_FLASHLIGHT ? 1 : (group.type === "beam" ? 0.72 : 1)) * (1 - Math.abs(variantCenter) * 0.16),
				0,
				group.type === "strobe" ? 0.88 : 0.72
			)
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
		mixModeKey: options.initialMixModeKey || "manual",
		flashlightActiveBool: false,
		depthActiveBool: false,
		lightingModeKey: options.initialLightingModeKey || "uniform",
		lightingDarkness: options.initialLightingDarkness == null ? 0.05 : options.initialLightingDarkness,
		effectSemanticModeKey: options.initialEffectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
		effectAdditiveShare: options.initialEffectAdditiveShare == null ? 1 : options.initialEffectAdditiveShare,
		effectAlphaBlendShare: options.initialEffectAlphaBlendShare == null ? 1 : options.initialEffectAlphaBlendShare,
		manualMix: options.initialManualMix == null ? 0 : options.initialManualMix,
		audioReactiveIntensity: options.initialAudioReactiveIntensity == null ? 0.7 : options.initialAudioReactiveIntensity,
		flashlightRadius: options.initialFlashlightRadius == null ? 0.18 : options.initialFlashlightRadius,
		flashlightSoftness: options.initialFlashlightSoftness == null ? 0.1 : options.initialFlashlightSoftness,
		depthThreshold: 0.80,
		depthFade: 0.20,
		depthMrRetain: 0.3,
		usableDepthAvailableBool: false,
		smoothedAudioDrive: 0,
		smoothedBlendDrive: 0
	};

	const getFlashlightMasks = function(args) {
		if (!state.flashlightActiveBool) {
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
				const depthAnchorState = getDepthAnchorState(args, projectedUv, anchoredPoint.point);
				const radiusScale = depthAnchorState ? depthAnchorState.radiusScale : 1;
				spots.push({
					x: projectedUv.x,
					y: projectedUv.y,
					r: light.r,
					g: light.g,
					b: light.b,
					radiusX: clampNumber(anchoredPoint.radius * radiusScale, 0.06, 0.42),
					radiusY: clampNumber(anchoredPoint.radius * radiusScale, 0.06, 0.42),
					rotation: 0,
					softness: 0.12,
					alphaBlendStrength: 0.94,
					effectType: 0,
					effectPhase: 0,
					effectDensity: 0,
					effectAmount: 0,
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
		// sort in-place — array is rebuilt each frame by the active preset
		lightingState.fixtureGroups.sort(function(a, b) {
			return (b.intensity || 0) - (a.intensity || 0);
		});
		const rankedGroups = lightingState.fixtureGroups;
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
			if (state.availableBool) {
				state.mixModeKey = "audioReactive";
				state.audioReactiveIntensity = 1;
			}
		},
		updateFrame: function(args) {
			args = args || {};
			const targetDrive = getWeightedAudioDrive(args.audioMetrics);
			const targetBlendDrive = getPassthroughBlendDrive(args.audioMetrics);
			const delta = clampNumber(args.delta == null ? 1 / 60 : args.delta, 0, 0.1);
			const smoothFactor = clampNumber(delta * 9.5, 0.05, 1);
			state.smoothedAudioDrive = lerpNumber(state.smoothedAudioDrive, targetDrive, smoothFactor);
			state.smoothedBlendDrive = lerpNumber(state.smoothedBlendDrive, targetBlendDrive, smoothFactor);
		},
		getUiState: function() {
			const bgControlState = getBackgroundControlDefinitions(state);
			const ptControlState = getPassthroughControlDefinitions(state);
			const lightingControlState = getPassthroughLightingControlDefinitions(state);
			return {
				availableBool: state.availableBool,
				fallbackBool: state.fallbackBool,
				statusText: state.statusText,
				mixModes: backgroundMixModeDefinitions,
				selectedMixModeKey: state.mixModeKey,
				mixModeVisibleBool: bgControlState.mixModeVisibleBool,
				backgroundControls: bgControlState.controls || [],
				flashlightActiveBool: state.flashlightActiveBool,
				depthActiveBool: state.depthActiveBool,
				usableDepthAvailableBool: state.usableDepthAvailableBool,
				passthroughControls: ptControlState.controls || [],
				lightingModes: passthroughLightingModeDefinitions,
				selectedLightingModeKey: state.lightingModeKey,
				lightingControls: lightingControlState.controls || [],
				effectSemanticControls: lightingControlState.effectSemanticControls || [],
				audioDrive: state.smoothedBlendDrive,
				visibleShare: getPassthroughVisibleShare(state, state.smoothedBlendDrive),
				effectSemanticModeKey: state.effectSemanticModeKey,
				effectSemanticModeLabel: getPassthroughEffectSemanticModeLabel(state.effectSemanticModeKey)
			};
		},
		toggleFlashlight: function() { state.flashlightActiveBool = !state.flashlightActiveBool; },
		toggleDepth: function() { state.depthActiveBool = !state.depthActiveBool; },
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
		selectMixMode: function(key) {
			for (let i = 0; i < backgroundMixModeDefinitions.length; i += 1) {
				if (backgroundMixModeDefinitions[i].key === key) {
					state.mixModeKey = key;
					return;
				}
			}
		},
		selectEffectSemanticMode: function(key) {
			for (let i = 0; i < passthroughEffectSemanticModeDefinitions.length; i += 1) {
				if (passthroughEffectSemanticModeDefinitions[i].key === key) {
					state.effectSemanticModeKey = key;
					return;
				}
			}
		},
		getEffectSemanticModeState: function() {
			return {
				key: state.effectSemanticModeKey,
				label: getPassthroughEffectSemanticModeLabel(state.effectSemanticModeKey)
			};
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
			if (key === "lightingDarkness") {
				state.lightingDarkness = clampNumber(value, 0, 1);
			}
			if (key === "effectAdditiveShare") {
				state.effectAdditiveShare = clampNumber(value, 0, 1);
			}
			if (key === "effectAlphaBlendShare") {
				state.effectAlphaBlendShare = clampNumber(value, 0, 1);
			}
			if (key === "depthThreshold") {
				state.depthThreshold = clampNumber(value, 0, 8);
			}
			if (key === "depthFade") {
				state.depthFade = clampNumber(value, 0, 2);
			}
			if (key === "depthMrRetain") {
				state.depthMrRetain = clampNumber(value, 0, 1);
			}
		},
		setDepthAvailability: function(availableBool) {
			if (!!availableBool && !state.usableDepthAvailableBool) {
				state.depthActiveBool = true;
			}
			state.usableDepthAvailableBool = !!availableBool;
		},
		getPunchRenderState: function(args) {
			var depth = null;
			var flashlight = null;
			var worldMask = null;
			if (state.depthActiveBool) {
				depth = {depthThreshold: state.depthThreshold, depthFade: state.depthFade, depthMrRetain: state.depthMrRetain};
				worldMask = {depthThreshold: state.depthThreshold, depthFade: state.depthFade};
			}
			if (state.flashlightActiveBool) {
				var masks = getFlashlightMasks(args || {});
				if (masks.length) { flashlight = {masks: masks}; }
			}
			if (!depth && !flashlight && !worldMask) { return null; }
			return {depth: depth, flashlight: flashlight, worldMask: worldMask};
		},
		getBackgroundCompositeState: function() {
			return {
				alpha: clampNumber(1 - getPassthroughVisibleShare(state, state.smoothedBlendDrive), 0, 1),
				maskCount: 0,
				masks: []
			};
		},
		getOverlayRenderState: function(args) {
			args = args || {};
			const visibleShare = getPassthroughVisibleShare(state, state.smoothedBlendDrive);
			const lightingState = args.sceneLightingState || null;
			const lightingColor = getAveragedLightingColor(lightingState);
			const additiveStrength = state.lightingModeKey === "uniform" ? clampNumber(state.smoothedAudioDrive * 0.9, 0, 0.95) : 0;
			const darkness = state.lightingModeKey === "none" ? 1 : clampNumber(state.lightingDarkness, 0, 1);
			const spotAdditiveScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY ? 0 : clampNumber(state.effectAdditiveShare, 0, 1);
			const spotAlphaBlendScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY ? 0 : clampNumber(state.effectAlphaBlendShare, 0, 1);
			return {
				visibleShare: visibleShare,
				maskCount: 0,
				masks: [],
				depth: state.depthActiveBool ? {depthThreshold: state.depthThreshold, depthFade: state.depthFade, depthMrRetain: state.depthMrRetain} : null,
				darkAlpha: 1 - darkness,
				additiveColor: lightingColor,
				additiveStrength: additiveStrength,
				lightingModeKey: state.lightingModeKey,
				effectSemanticModeKey: state.effectSemanticModeKey,
				spotAdditiveScale: spotAdditiveScale,
				spotAlphaBlendScale: spotAlphaBlendScale,
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
	let depthTexture2dProgram = null;
	let depthGpuArrayProgram = null;
	let positionLoc = null;
	let darkAlphaLoc = null;
	let visibleShareLoc = null;
	let maskCountLoc = null;
	let maskCentersLoc = null;
	let maskParamsLoc = null;
	let additiveColorLoc = null;
	let additiveStrengthLoc = null;
	let spotCountLoc = null;
	let spotCentersLoc = null;
	let spotColorsLoc = null;
	let spotParamsLoc = null;
	let spotAlphaBlendStrengthsLoc = null;
	let spotEffectParamsLoc = null;
	let spotAdditiveScaleLoc = null;
	let spotAlphaBlendScaleLoc = null;
	let buffer = null;
	let depthTexture2dLocs = null;
	let depthGpuArrayLocs = null;
	let cpuDepthTexture = null;
	let cpuUploadBuffer = null;
	const depthUvTransform = new Float32Array(16);
	const maskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const maskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const spotCenters = new Float32Array(PASSTHROUGH_MAX_SPOTS * 2);
	const spotColors = new Float32Array(PASSTHROUGH_MAX_SPOTS * 4);
	const spotParams = new Float32Array(PASSTHROUGH_MAX_SPOTS * 4);
	const spotAlphaBlendStrengths = new Float32Array(PASSTHROUGH_MAX_SPOTS);
	const spotEffectParams = new Float32Array(PASSTHROUGH_MAX_SPOTS * 4);
	const additiveColor = new Float32Array(3);
	const overlayVertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");

	const fragmentSource = [
		"precision mediump float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float spotCount;",
		"uniform vec4 spotColors[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec2 spotCenters[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAlphaBlendStrengths[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotEffectParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAdditiveScale;",
		"uniform float spotAlphaBlendScale;",
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
		fixtureEffectFragmentSource,
		"void main(){",
		"float alphaBlendOpen=visibleShare;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_SPOTS + ";i+=1){",
		"if(float(i)>=spotCount){break;}",
		"float spotMask=ellipseMask(vScreenUv,spotCenters[i],spotParams[i]);",
		"vec2 effectMask=spotEffect(vScreenUv,spotCenters[i],spotParams[i],spotEffectParams[i]);",
		"float spotStrength=spotColors[i].a*spotMask*effectMask.x*alphaBlendOpen*spotAdditiveScale;",
		"color+=spotColors[i].rgb*spotStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(spotColors[i].a*spotMask*effectMask.y*spotAlphaBlendStrengths[i]*1.65*alphaBlendOpen*spotAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");

	const depthOverlayShaderChunk = [
		"float computeDepthRetainShare(float baseVisibleShare){",
		"if(depthMrRetain<=0.0001){",
		"return baseVisibleShare;",
		"}",
		"vec2 depthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
		"float rawDepth=sampleDepth(depthUv);",
		"float valid=step(0.001,rawDepth);",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float mask=depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);",
		"float localRetain=depthMrRetain*(1.0-mask)*valid;",
		"return max(baseVisibleShare,localRetain);",
		"}"
	].join("");
	const depthTexture2dFragmentSource = [
		"precision mediump float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float spotCount;",
		"uniform vec4 spotColors[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec2 spotCenters[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAlphaBlendStrengths[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotEffectParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAdditiveScale;",
		"uniform float spotAlphaBlendScale;",
		"uniform sampler2D depthTexture;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){float radius=max(params.x,0.0001);float softness=max(params.y,0.0001);float inner=max(0.0,radius-softness);return 1.0-smoothstep(inner,radius,distance(uv,center));}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){float radiusX=max(params.x,0.0001);float radiusY=max(params.y,0.0001);float softness=max(params.z,0.0001);float rotation=params.w;vec2 delta=uv-center;float cosAngle=cos(rotation);float sinAngle=sin(rotation);vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);}",
		fixtureEffectFragmentSource,
		"float sampleDepth(vec2 depthUv){return texture2D(depthTexture,depthUv).r;}",
		depthOverlayShaderChunk,
		"void main(){",
		"float alphaBlendOpen=computeDepthRetainShare(visibleShare);",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_SPOTS + ";i+=1){",
		"if(float(i)>=spotCount){break;}",
		"float spotMask=ellipseMask(vScreenUv,spotCenters[i],spotParams[i]);",
		"vec2 effectMask=spotEffect(vScreenUv,spotCenters[i],spotParams[i],spotEffectParams[i]);",
		"float spotStrength=spotColors[i].a*spotMask*effectMask.x*alphaBlendOpen*spotAdditiveScale;",
		"color+=spotColors[i].rgb*spotStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(spotColors[i].a*spotMask*effectMask.y*spotAlphaBlendStrengths[i]*1.65*alphaBlendOpen*spotAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");
	const depthGpuArrayVertexSource = [
		"#version 300 es\n",
		"in vec2 position;",
		"out vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const depthGpuArrayFragmentSource = [
		"#version 300 es\n",
		"precision mediump float;",
		"precision mediump sampler2DArray;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float spotCount;",
		"uniform vec4 spotColors[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec2 spotCenters[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAlphaBlendStrengths[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform vec4 spotEffectParams[" + PASSTHROUGH_MAX_SPOTS + "];",
		"uniform float spotAdditiveScale;",
		"uniform float spotAlphaBlendScale;",
		"uniform sampler2DArray depthTexture;",
		"uniform int depthTextureLayer;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){float radius=max(params.x,0.0001);float softness=max(params.y,0.0001);float inner=max(0.0,radius-softness);return 1.0-smoothstep(inner,radius,distance(uv,center));}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){float radiusX=max(params.x,0.0001);float radiusY=max(params.y,0.0001);float softness=max(params.z,0.0001);float rotation=params.w;vec2 delta=uv-center;float cosAngle=cos(rotation);float sinAngle=sin(rotation);vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);}",
		fixtureEffectFragmentSource,
		"float sampleDepth(vec2 depthUv){return texture(depthTexture,vec3(depthUv,float(depthTextureLayer))).r;}",
		depthOverlayShaderChunk,
		"void main(){",
		"float alphaBlendOpen=computeDepthRetainShare(visibleShare);",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_SPOTS + ";i+=1){",
		"if(float(i)>=spotCount){break;}",
		"float spotMask=ellipseMask(vScreenUv,spotCenters[i],spotParams[i]);",
		"vec2 effectMask=spotEffect(vScreenUv,spotCenters[i],spotParams[i],spotEffectParams[i]);",
		"float spotStrength=spotColors[i].a*spotMask*effectMask.x*alphaBlendOpen*spotAdditiveScale;",
		"color+=spotColors[i].rgb*spotStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(spotColors[i].a*spotMask*effectMask.y*spotAlphaBlendStrengths[i]*1.65*alphaBlendOpen*spotAlphaBlendScale,0.0,1.0));",
		"}",
		"fragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");
	const buildOverlayLocs = function(targetProgram) {
		return {
			position: gl.getAttribLocation(targetProgram, "position"),
			darkAlpha: gl.getUniformLocation(targetProgram, "darkAlpha"),
			visibleShare: gl.getUniformLocation(targetProgram, "visibleShare"),
			maskCount: gl.getUniformLocation(targetProgram, "maskCount"),
			maskCenters: gl.getUniformLocation(targetProgram, "maskCenters"),
			maskParams: gl.getUniformLocation(targetProgram, "maskParams"),
			additiveColor: gl.getUniformLocation(targetProgram, "additiveColor"),
			additiveStrength: gl.getUniformLocation(targetProgram, "additiveStrength"),
			spotCount: gl.getUniformLocation(targetProgram, "spotCount"),
			spotCenters: gl.getUniformLocation(targetProgram, "spotCenters"),
			spotColors: gl.getUniformLocation(targetProgram, "spotColors"),
			spotParams: gl.getUniformLocation(targetProgram, "spotParams"),
			spotAlphaBlendStrengths: gl.getUniformLocation(targetProgram, "spotAlphaBlendStrengths"),
			spotEffectParams: gl.getUniformLocation(targetProgram, "spotEffectParams"),
			spotAdditiveScale: gl.getUniformLocation(targetProgram, "spotAdditiveScale"),
			spotAlphaBlendScale: gl.getUniformLocation(targetProgram, "spotAlphaBlendScale"),
			depthTexture: gl.getUniformLocation(targetProgram, "depthTexture"),
			depthTextureLayer: gl.getUniformLocation(targetProgram, "depthTextureLayer"),
			depthThreshold: gl.getUniformLocation(targetProgram, "depthThreshold"),
			depthFade: gl.getUniformLocation(targetProgram, "depthFade"),
			depthMrRetain: gl.getUniformLocation(targetProgram, "depthMrRetain"),
			rawValueToMeters: gl.getUniformLocation(targetProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(targetProgram, "depthNearZ"),
			depthUvTransform: gl.getUniformLocation(targetProgram, "depthUvTransform")
		};
	};

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
			additiveColorLoc = gl.getUniformLocation(program, "additiveColor");
			additiveStrengthLoc = gl.getUniformLocation(program, "additiveStrength");
			spotCountLoc = gl.getUniformLocation(program, "spotCount");
			spotCentersLoc = gl.getUniformLocation(program, "spotCenters");
			spotColorsLoc = gl.getUniformLocation(program, "spotColors");
			spotParamsLoc = gl.getUniformLocation(program, "spotParams");
			spotAlphaBlendStrengthsLoc = gl.getUniformLocation(program, "spotAlphaBlendStrengths");
			spotEffectParamsLoc = gl.getUniformLocation(program, "spotEffectParams");
			spotAdditiveScaleLoc = gl.getUniformLocation(program, "spotAdditiveScale");
			spotAlphaBlendScaleLoc = gl.getUniformLocation(program, "spotAlphaBlendScale");
			depthTexture2dProgram = createProgram(gl, overlayVertexSource, depthTexture2dFragmentSource, "Passthrough overlay depth texture2d");
			depthTexture2dLocs = buildOverlayLocs(depthTexture2dProgram);
			if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
				depthGpuArrayProgram = createProgram(gl, depthGpuArrayVertexSource, depthGpuArrayFragmentSource, "Passthrough overlay depth gpu-array");
				depthGpuArrayLocs = buildOverlayLocs(depthGpuArrayProgram);
			}
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(renderState, depthInfo, depthFrameKind, webgl2Bool, depthProfile) {
			if (!renderState) {
				return;
			}
			const effectiveAlphaBlendOpen = renderState.visibleShare > 0.001 || renderState.maskCount > 0 || !!(renderState.depth && renderState.depth.depthMrRetain > 0.001);
			if (!effectiveAlphaBlendOpen) {
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
			for (let i = 0; i < spotAlphaBlendStrengths.length; i += 1) {
				spotAlphaBlendStrengths[i] = 0;
			}
			for (let i = 0; i < spotEffectParams.length; i += 1) {
				spotEffectParams[i] = 0;
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
				spotAlphaBlendStrengths[i] = renderState.spots[i].alphaBlendStrength == null ? 1 : renderState.spots[i].alphaBlendStrength;
				spotEffectParams[i * 4] = renderState.spots[i].effectType || 0;
				spotEffectParams[i * 4 + 1] = renderState.spots[i].effectPhase || 0;
				spotEffectParams[i * 4 + 2] = renderState.spots[i].effectDensity || 0;
				spotEffectParams[i * 4 + 3] = renderState.spots[i].effectAmount || 0;
			}
			additiveColor[0] = renderState.additiveColor[0];
			additiveColor[1] = renderState.additiveColor[1];
			additiveColor[2] = renderState.additiveColor[2];
			let activeProgram = program;
			let activeLocs = {
				position: positionLoc,
				darkAlpha: darkAlphaLoc,
				visibleShare: visibleShareLoc,
				maskCount: maskCountLoc,
				maskCenters: maskCentersLoc,
				maskParams: maskParamsLoc,
				additiveColor: additiveColorLoc,
				additiveStrength: additiveStrengthLoc,
				spotCount: spotCountLoc,
				spotCenters: spotCentersLoc,
				spotColors: spotColorsLoc,
				spotParams: spotParamsLoc,
				spotAlphaBlendStrengths: spotAlphaBlendStrengthsLoc,
				spotEffectParams: spotEffectParamsLoc,
				spotAdditiveScale: spotAdditiveScaleLoc,
				spotAlphaBlendScale: spotAlphaBlendScaleLoc
			};
			let cpuTextureBoundBool = false;
			const useDepthOverlayBool = !!(renderState.depth && depthInfo);
			if (useDepthOverlayBool) {
				const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
				if (depthFrameKind === "cpu") {
					if (!depthInfo.data || !depthInfo.width || !depthInfo.height) {
						return;
					}
					if (!cpuDepthTexture) {
						cpuDepthTexture = gl.createTexture();
					}
					const pixelCount = depthInfo.width * depthInfo.height;
					if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
						cpuUploadBuffer = new Float32Array(pixelCount);
					}
					const src = new Uint16Array(depthInfo.data);
					for (let i = 0; i < pixelCount; i += 1) {
						cpuUploadBuffer[i] = src[i];
					}
					gl.activeTexture(gl.TEXTURE1);
					gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
					if (webgl2Bool) {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					} else {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					}
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					cpuTextureBoundBool = true;
					activeProgram = depthTexture2dProgram;
					activeLocs = depthTexture2dLocs;
				} else if (depthFrameKind === "gpu-array" && webgl2Bool && depthGpuArrayProgram && depthInfo.texture) {
					activeProgram = depthGpuArrayProgram;
					activeLocs = depthGpuArrayLocs;
				} else if (depthInfo.texture) {
					activeProgram = depthTexture2dProgram;
					activeLocs = depthTexture2dLocs;
				} else {
					activeProgram = program;
				}
			}
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.useProgram(activeProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(activeLocs.position);
			gl.vertexAttribPointer(activeLocs.position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1f(activeLocs.darkAlpha, renderState.darkAlpha);
			gl.uniform1f(activeLocs.visibleShare, renderState.visibleShare);
			gl.uniform1f(activeLocs.maskCount, renderState.maskCount);
			gl.uniform2fv(activeLocs.maskCenters, maskCenters);
			gl.uniform2fv(activeLocs.maskParams, maskParams);
			gl.uniform3fv(activeLocs.additiveColor, additiveColor);
			gl.uniform1f(activeLocs.additiveStrength, renderState.additiveStrength);
			gl.uniform1f(activeLocs.spotCount, renderState.spots.length);
			gl.uniform2fv(activeLocs.spotCenters, spotCenters);
			gl.uniform4fv(activeLocs.spotColors, spotColors);
			gl.uniform4fv(activeLocs.spotParams, spotParams);
			gl.uniform1fv(activeLocs.spotAlphaBlendStrengths, spotAlphaBlendStrengths);
			gl.uniform4fv(activeLocs.spotEffectParams, spotEffectParams);
			gl.uniform1f(activeLocs.spotAdditiveScale, renderState.spotAdditiveScale == null ? 1 : renderState.spotAdditiveScale);
			gl.uniform1f(activeLocs.spotAlphaBlendScale, renderState.spotAlphaBlendScale == null ? 1 : renderState.spotAlphaBlendScale);
			if (useDepthOverlayBool && activeLocs.depthTexture) {
				gl.uniform1f(activeLocs.depthThreshold, renderState.depth.depthThreshold);
				gl.uniform1f(activeLocs.depthFade, renderState.depth.depthFade);
				gl.uniform1f(activeLocs.depthMrRetain, renderState.depth.depthMrRetain || 0);
				gl.uniform1f(activeLocs.rawValueToMeters, depthProfile && depthInfo ? (depthProfile.linearScale != null ? depthProfile.linearScale : (depthInfo.rawValueToMeters || 0.001)) : (depthInfo && depthInfo.rawValueToMeters || 0.001));
				gl.uniform1f(activeLocs.depthNearZ, depthProfile && depthProfile.nearZ != null ? depthProfile.nearZ : 0);
				gl.activeTexture(gl.TEXTURE1);
				if (cpuTextureBoundBool) {
					// already bound above
				} else if (depthFrameKind === "gpu-array" && webgl2Bool && depthGpuArrayProgram && depthInfo.texture && activeLocs.depthTextureLayer) {
					gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
					gl.uniform1i(activeLocs.depthTextureLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
				} else if (depthInfo && depthInfo.texture) {
					gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
				}
				gl.uniform1i(activeLocs.depthTexture, 1);
				if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
				} else if (depthInfo.normDepthBufferFromNormView) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
				} else {
					depthUvTransform[0] = 1; depthUvTransform[1] = 0; depthUvTransform[2] = 0; depthUvTransform[3] = 0;
					depthUvTransform[4] = 0; depthUvTransform[5] = 1; depthUvTransform[6] = 0; depthUvTransform[7] = 0;
					depthUvTransform[8] = 0; depthUvTransform[9] = 0; depthUvTransform[10] = 1; depthUvTransform[11] = 0;
					depthUvTransform[12] = 0; depthUvTransform[13] = 0; depthUvTransform[14] = 0; depthUvTransform[15] = 1;
				}
				gl.uniformMatrix4fv(activeLocs.depthUvTransform, false, depthUvTransform);
			}
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};

const createPunchRenderer = function() {
	let gl = null;
	let buffer = null;
	let gpuArrayProgram = null;
	let gpuArrayLocs = null;
	let texture2dProgram = null;
	let texture2dLocs = null;
	let cpuDepthTexture = null;
	let cpuUploadBuffer = null;
	let depthDiagLoggedBool = false;
	const depthUvTransform = new Float32Array(16);
	let flashlightProgram = null;
	let flashlightLocs = null;
	const flashlightMaskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const flashlightMaskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);

	// WebGL1 (CPU/gpu-texture) fragment shader
	const texture2dFragSource = [
		"precision mediump float;",
		"uniform sampler2D depthTexture;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vec2 depthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
		"float rawDepth=texture2D(depthTexture,depthUv).r;",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float valid=step(0.001,rawDepth);",
		"float mask=depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);",
		"float punchMask=mix(1.0,mask,valid);",
		"gl_FragColor=vec4(0.0,0.0,0.0,mix(depthMrRetain,1.0,punchMask));",
		"}"
	].join("");

	// WebGL2 (Quest gpu-array) vertex+fragment shaders — GLSL ES 3.0
	const gpuArrayVertSource = [
		"#version 300 es\n",
		"in vec2 position;",
		"out vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const gpuArrayFragSource = [
		"#version 300 es\n",
		"precision mediump float;",
		"precision mediump sampler2DArray;",
		"uniform sampler2DArray depthTexture;",
		"uniform int depthTextureLayer;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"void main(){",
		"vec2 depthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
		"float rawDepth=texture(depthTexture,vec3(depthUv,float(depthTextureLayer))).r;",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float valid=step(0.001,rawDepth);",
		"float mask=depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);",
		"float punchMask=mix(1.0,mask,valid);",
		"fragColor=vec4(0.0,0.0,0.0,mix(depthMrRetain,1.0,punchMask));",
		"}"
	].join("");

	const flashlightFragSource = [
		"precision mediump float;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"varying vec2 vScreenUv;",
		"void main(){",
		"float alpha=1.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float radius=max(maskParams[i].x,0.0001);",
		"float softness=max(maskParams[i].y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"alpha*=smoothstep(inner,radius,distance(vScreenUv,maskCenters[i]));",
		"}",
		"gl_FragColor=vec4(0.0,0.0,0.0,alpha);",
		"}"
	].join("");

	const buildDepthLocs = function(prog) {
		return {
			position: gl.getAttribLocation(prog, "position"),
			depthTexture: gl.getUniformLocation(prog, "depthTexture"),
			depthTextureLayer: gl.getUniformLocation(prog, "depthTextureLayer"),
			depthThreshold: gl.getUniformLocation(prog, "depthThreshold"),
			depthFade: gl.getUniformLocation(prog, "depthFade"),
			depthMrRetain: gl.getUniformLocation(prog, "depthMrRetain"),
			rawValueToMeters: gl.getUniformLocation(prog, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(prog, "depthNearZ"),
			depthUvTransform: gl.getUniformLocation(prog, "depthUvTransform")
		};
	};

	const drawFlashlightPunch = function(punchState) {
		if (!punchState.masks || punchState.masks.length === 0) { return; }
		if (!flashlightProgram) {
			flashlightProgram = createProgram(gl, fullscreenVertexSource, flashlightFragSource, "Punch flashlight");
			flashlightLocs = {
				position: gl.getAttribLocation(flashlightProgram, "position"),
				maskCount: gl.getUniformLocation(flashlightProgram, "maskCount"),
				maskCenters: gl.getUniformLocation(flashlightProgram, "maskCenters"),
				maskParams: gl.getUniformLocation(flashlightProgram, "maskParams")
			};
		}
		for (let i = 0; i < flashlightMaskCenters.length; i += 1) {
			flashlightMaskCenters[i] = 0;
			flashlightMaskParams[i] = 0;
		}
		for (let i = 0; i < punchState.masks.length && i < PASSTHROUGH_MAX_FLASHLIGHTS; i += 1) {
			flashlightMaskCenters[i * 2] = punchState.masks[i].x;
			flashlightMaskCenters[i * 2 + 1] = punchState.masks[i].y;
			flashlightMaskParams[i * 2] = punchState.masks[i].radius;
			flashlightMaskParams[i * 2 + 1] = punchState.masks[i].softness;
		}
		gl.useProgram(flashlightProgram);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.SRC_ALPHA);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(flashlightLocs.position);
		gl.vertexAttribPointer(flashlightLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.uniform1f(flashlightLocs.maskCount, punchState.masks.length);
		gl.uniform2fv(flashlightLocs.maskCenters, flashlightMaskCenters);
		gl.uniform2fv(flashlightLocs.maskParams, flashlightMaskParams);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	};

	const drawDepthPunch = function(depthInfo, depthFrameKind, punchState, webgl2Bool, depthProfile) {
		if (!depthInfo) { return; }
		let cpuTextureBound = false;
		var profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		if (depthFrameKind === "cpu") {
			if (!depthInfo.data || !depthInfo.width || !depthInfo.height) { return; }
			if (!cpuDepthTexture) {
				cpuDepthTexture = gl.createTexture();
			}
			var pixelCount = depthInfo.width * depthInfo.height;
			if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
				cpuUploadBuffer = new Float32Array(pixelCount);
			}
			var src = new Uint16Array(depthInfo.data);
			for (var p = 0; p < pixelCount; p += 1) {
				cpuUploadBuffer[p] = src[p];
			}
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
			if (webgl2Bool) {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
			}
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			cpuTextureBound = true;
		} else if (!depthInfo.texture) {
			return;
		}
		var program = null;
		var locs = null;
		if (depthFrameKind === "gpu-array" && webgl2Bool) {
			if (!gpuArrayProgram) {
				gpuArrayProgram = createProgram(gl, gpuArrayVertSource, gpuArrayFragSource, "Depth punch gpu-array");
				gpuArrayLocs = buildDepthLocs(gpuArrayProgram);
			}
			program = gpuArrayProgram;
			locs = gpuArrayLocs;
		} else {
			if (!texture2dProgram) {
				texture2dProgram = createProgram(gl, fullscreenVertexSource, texture2dFragSource, "Depth punch texture2d");
				texture2dLocs = buildDepthLocs(texture2dProgram);
			}
			program = texture2dProgram;
			locs = texture2dLocs;
		}
		gl.useProgram(program);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.SRC_ALPHA);
		gl.activeTexture(gl.TEXTURE0);
		if (cpuTextureBound) {
			// already bound above
		} else if (depthFrameKind === "gpu-array" && webgl2Bool) {
			gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
			gl.uniform1i(locs.depthTextureLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
		} else {
			gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
		}
		gl.uniform1i(locs.depthTexture, 0);
		gl.uniform1f(locs.depthThreshold, punchState.depthThreshold);
		gl.uniform1f(locs.depthFade, punchState.depthFade);
		gl.uniform1f(locs.depthMrRetain, punchState.depthMrRetain || 0);
		gl.uniform1f(locs.rawValueToMeters, profile.linearScale);
		gl.uniform1f(locs.depthNearZ, profile.nearZ);
		if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
			depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
		} else if (depthInfo.normDepthBufferFromNormView) {
			depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
		} else {
			depthUvTransform[0] = 1; depthUvTransform[1] = 0; depthUvTransform[2] = 0; depthUvTransform[3] = 0;
			depthUvTransform[4] = 0; depthUvTransform[5] = 1; depthUvTransform[6] = 0; depthUvTransform[7] = 0;
			depthUvTransform[8] = 0; depthUvTransform[9] = 0; depthUvTransform[10] = 1; depthUvTransform[11] = 0;
			depthUvTransform[12] = 0; depthUvTransform[13] = 0; depthUvTransform[14] = 0; depthUvTransform[15] = 1;
		}
		gl.uniformMatrix4fv(locs.depthUvTransform, false, depthUvTransform);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(locs.position);
		gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	};

	return {
		init: function(glContext) {
			gl = glContext;
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(punchState, depthInfo, depthFrameKind, webgl2Bool, depthProfile) {
			if (!punchState) { return; }
			if (punchState.depth) {
				drawDepthPunch(depthInfo, depthFrameKind, punchState.depth, webgl2Bool, depthProfile);
			}
			if (punchState.flashlight) {
				drawFlashlightPunch(punchState.flashlight);
			}
		}
	};
};
