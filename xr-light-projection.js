// Shared real-world / fallback-room light projection helpers for passthrough lighting.

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
const PASSTHROUGH_SOFT_WASH_DEPTH_SAMPLE_UV = 0.035;
const PASSTHROUGH_SOFT_WASH_MIN_WORLD_RADIUS_METERS = 0.35;
const PASSTHROUGH_SOFT_WASH_MAX_WORLD_RADIUS_METERS = 2.8;

const PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO = "auto";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD = "vrWorld";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD = "realWorld";

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

const buildWorldFromViewMatrix = function(viewMatrix) {
	const cameraPosition = extractCameraPositionFromViewMatrix(viewMatrix);
	return new Float32Array([
		viewMatrix[0], viewMatrix[4], viewMatrix[8], 0,
		viewMatrix[1], viewMatrix[5], viewMatrix[9], 0,
		viewMatrix[2], viewMatrix[6], viewMatrix[10], 0,
		cameraPosition.x, cameraPosition.y, cameraPosition.z, 1
	]);
};

const transformPointByMatrix = function(matrix, point) {
	return {
		x: matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12],
		y: matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13],
		z: matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14]
	};
};

const getDepthWorldPointAtUv = function(args, uv) {
	if (!args || !args.depthInfo || typeof args.depthInfo.getDepthInMeters !== "function" || !args.viewMatrix || !args.projMatrix || !uv) {
		return null;
	}
	let depthMeters = 0;
	try { depthMeters = args.depthInfo.getDepthInMeters(uv.x, 1 - uv.y) || 0; } catch (e) { depthMeters = 0; }
	if (!Number.isFinite(depthMeters) || depthMeters < PASSTHROUGH_DEPTH_MIN_METERS || depthMeters > PASSTHROUGH_DEPTH_MAX_METERS) {
		return null;
	}
	const cameraPosition = extractCameraPositionFromViewMatrix(args.viewMatrix);
	const worldDirection = getWorldDirectionForUv(args.viewMatrix, args.projMatrix, uv);
	return {
		x: cameraPosition.x + worldDirection.x * depthMeters,
		y: cameraPosition.y + worldDirection.y * depthMeters,
		z: cameraPosition.z + worldDirection.z * depthMeters,
		depthMeters: depthMeters
	};
};

// Pre-allocated to avoid per-frame garbage in depth-anchor hot paths.
const reusableDepthAnchorState = {depthMeters: 0, radiusScale: 1, point: {x: 0, y: 0, z: 0}};
const getDepthAnchorState = function(args, projectedUv, fallbackPoint) {
	const depthPoint = getDepthWorldPointAtUv(args, projectedUv);
	if (!depthPoint) {
		return null;
	}
	const cameraPosition = extractCameraPositionFromViewMatrix(args.viewMatrix);
	const fallbackDistance = fallbackPoint ? Math.sqrt(
		Math.pow(fallbackPoint.x - cameraPosition.x, 2) +
		Math.pow(fallbackPoint.y - cameraPosition.y, 2) +
		Math.pow(fallbackPoint.z - cameraPosition.z, 2)
	) : depthPoint.depthMeters;
	reusableDepthAnchorState.depthMeters = depthPoint.depthMeters;
	reusableDepthAnchorState.radiusScale = clampNumber(fallbackDistance / Math.max(depthPoint.depthMeters, 0.0001), 0.65, 1.85);
	reusableDepthAnchorState.point.x = depthPoint.x;
	reusableDepthAnchorState.point.y = depthPoint.y;
	reusableDepthAnchorState.point.z = depthPoint.z;
	return reusableDepthAnchorState;
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

const getClubSurfaceBudget = function(surfaceKey, audioMetrics) {
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
	surfaceBudget = surfaceBudget || getClubSurfaceBudget(getFixtureSurfaceKey(anchorType), emptyAudioMetrics);
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

const getEffectiveLightingAnchorModeKey = function(controllerState) {
	const requestedModeKey = controllerState && controllerState.lightingAnchorModeKey ? controllerState.lightingAnchorModeKey : PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO;
	if (requestedModeKey === PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO) {
		const depthActiveBool = !!(controllerState && controllerState.depthActiveBool);
		const usableDepthBool = !!(controllerState && controllerState.usableDepthAvailableBool);
		return depthActiveBool && usableDepthBool ? PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD : PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD;
	}
	return requestedModeKey;
};

const canUseDepthBoundLighting = function(controllerState, args) {
	return !!(
		controllerState &&
		controllerState.depthActiveBool &&
		args &&
		args.depthInfo &&
		typeof args.depthInfo.getDepthInMeters === "function"
	);
};

const getRealWorldRoomOrigin = function(controllerState, args) {
	if (!controllerState) {
		return {x: 0, y: 0, z: 0};
	}
	if (!controllerState.lightingRealWorldRoomOrigin) {
		const cameraPosition = args && args.viewMatrix ? extractCameraPositionFromViewMatrix(args.viewMatrix) : {x: 0, y: 0, z: 0};
		controllerState.lightingRealWorldRoomOrigin = {
			x: cameraPosition.x,
			y: 0,
			z: cameraPosition.z
		};
	}
	return controllerState.lightingRealWorldRoomOrigin;
};

const getRealWorldRoomPoint = function(point, controllerState, args) {
	if (!point) {
		return null;
	}
	const origin = getRealWorldRoomOrigin(controllerState, args);
	return {
		x: origin.x + point.x,
		y: point.y,
		z: origin.z + point.z
	};
};

const getAnchoredRoomPoint = function(args, point, controllerState) {
	if (!point) {
		return null;
	}
	const effectiveModeKey = getEffectiveLightingAnchorModeKey(controllerState);
	if (effectiveModeKey === PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD) {
		return getRealWorldRoomPoint(point, controllerState, args);
	}
	if (effectiveModeKey !== PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD || !args || !args.renderViewMatrix || !args.viewMatrix) {
		return point;
	}
	return transformPointByMatrix(
		multiplyMatrices(buildWorldFromViewMatrix(args.viewMatrix), args.renderViewMatrix),
		point
	);
};

const getSurfaceTypeForDepthPoint = function(centerPoint, normal, cameraPosition) {
	if (!centerPoint || !normal || !cameraPosition) {
		return "wall";
	}
	if (Math.abs(normal.y) >= 0.72) {
		return centerPoint.y < cameraPosition.y ? "floor" : "ceiling";
	}
	return "wall";
};

const getSoftWashWorldRadii = function(group, fillMix, surfaceBudget, surfaceType, depthBoundBool) {
	let radiusX = clampNumber((group.radius || 0.4) * (1.2 + fillMix * 0.7) * (surfaceBudget.radiusScale || 1), PASSTHROUGH_SOFT_WASH_MIN_WORLD_RADIUS_METERS, PASSTHROUGH_SOFT_WASH_MAX_WORLD_RADIUS_METERS);
	let radiusY = radiusX * (surfaceType === "wall" ? 0.72 : (surfaceType === "floor" ? 1.08 : 0.84));
	if (!depthBoundBool) {
		radiusX *= 1.08;
		radiusY *= 1.12;
	}
	return {
		radiusX: clampNumber(radiusX, PASSTHROUGH_SOFT_WASH_MIN_WORLD_RADIUS_METERS, PASSTHROUGH_SOFT_WASH_MAX_WORLD_RADIUS_METERS),
		radiusY: clampNumber(radiusY, PASSTHROUGH_SOFT_WASH_MIN_WORLD_RADIUS_METERS * 0.7, PASSTHROUGH_SOFT_WASH_MAX_WORLD_RADIUS_METERS)
	};
};

const getDepthSurfaceProjectionState = function(args, centerUv, group, fillMix, surfaceBudget) {
	if (!args || !centerUv || !group || group.type !== "wash") {
		return null;
	}
	const centerPoint = getDepthWorldPointAtUv(args, centerUv);
	if (!centerPoint) {
		return null;
	}
	const sampleOffset = PASSTHROUGH_SOFT_WASH_DEPTH_SAMPLE_UV;
	const sampleRight = getDepthWorldPointAtUv(args, {x: clampNumber(centerUv.x + sampleOffset, 0, 1), y: centerUv.y});
	const sampleUp = getDepthWorldPointAtUv(args, {x: centerUv.x, y: clampNumber(centerUv.y - sampleOffset, 0, 1)});
	if (!sampleRight || !sampleUp) {
		return null;
	}
	const tangentX = normalizeVec3(sampleRight.x - centerPoint.x, sampleRight.y - centerPoint.y, sampleRight.z - centerPoint.z);
	const tangentYRaw = normalizeVec3(sampleUp.x - centerPoint.x, sampleUp.y - centerPoint.y, sampleUp.z - centerPoint.z);
	let normal = normalizeVec3(
		tangentX.y * tangentYRaw.z - tangentX.z * tangentYRaw.y,
		tangentX.z * tangentYRaw.x - tangentX.x * tangentYRaw.z,
		tangentX.x * tangentYRaw.y - tangentX.y * tangentYRaw.x
	);
	const tangentLength = Math.sqrt(
		Math.pow(sampleRight.x - centerPoint.x, 2) +
		Math.pow(sampleRight.y - centerPoint.y, 2) +
		Math.pow(sampleRight.z - centerPoint.z, 2)
	);
	if (!Number.isFinite(tangentLength) || tangentLength < 0.01) {
		return null;
	}
	const cameraPosition = extractCameraPositionFromViewMatrix(args.viewMatrix);
	const viewToSurface = normalizeVec3(centerPoint.x - cameraPosition.x, centerPoint.y - cameraPosition.y, centerPoint.z - cameraPosition.z);
	if (dotVec3(normal.x, normal.y, normal.z, viewToSurface.x, viewToSurface.y, viewToSurface.z) > 0) {
		normal.x *= -1;
		normal.y *= -1;
		normal.z *= -1;
	}
	const projectedDot = dotVec3(tangentYRaw.x, tangentYRaw.y, tangentYRaw.z, tangentX.x, tangentX.y, tangentX.z);
	const tangentY = normalizeVec3(
		tangentYRaw.x - tangentX.x * projectedDot,
		tangentYRaw.y - tangentX.y * projectedDot,
		tangentYRaw.z - tangentX.z * projectedDot
	);
	const surfaceType = getSurfaceTypeForDepthPoint(centerPoint, normal, cameraPosition);
	const worldRadii = getSoftWashWorldRadii(group, fillMix, surfaceBudget, surfaceType, true);
	const radiusPointX = {
		x: centerPoint.x + tangentX.x * worldRadii.radiusX,
		y: centerPoint.y + tangentX.y * worldRadii.radiusX,
		z: centerPoint.z + tangentX.z * worldRadii.radiusX
	};
	const radiusPointY = {
		x: centerPoint.x + tangentY.x * worldRadii.radiusY,
		y: centerPoint.y + tangentY.y * worldRadii.radiusY,
		z: centerPoint.z + tangentY.z * worldRadii.radiusY
	};
	const projectedRadiusUvX = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointX.x, radiusPointX.y, radiusPointX.z);
	const projectedRadiusUvY = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointY.x, radiusPointY.y, radiusPointY.z);
	if (!projectedRadiusUvX || !projectedRadiusUvY) {
		return null;
	}
	return {
		rotation: Math.atan2(projectedRadiusUvX.y - centerUv.y, projectedRadiusUvX.x - centerUv.x),
		radiusX: clampNumber(Math.sqrt(Math.pow(projectedRadiusUvX.x - centerUv.x, 2) + Math.pow(projectedRadiusUvX.y - centerUv.y, 2)), 0.08, 0.5),
		radiusY: clampNumber(Math.sqrt(Math.pow(projectedRadiusUvY.x - centerUv.x, 2) + Math.pow(projectedRadiusUvY.y - centerUv.y, 2)), 0.05, 0.48)
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
	const surfaceBudget = getClubSurfaceBudget(surfaceKey, args.audioMetrics);
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
		const roomPoint = getRoomPointForFixtureGroup(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset);
		const point = getAnchoredRoomPoint(
			args,
			roomPoint,
			clubState
		);
		const projectedUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, point.x, point.y, point.z);
		if (!projectedUv) {
			continue;
		}
		let rotation = 0;
		const tangentPoint = getAnchoredRoomPoint(
			args,
			getRoomPointForFixtureGroup(group, variantOffset + 0.08, fillMix, surfaceBudget, stereoBiasOffset),
			clubState
		);
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
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: variantCenter,
			stereoBiasOffset: stereoBiasOffset
		});
		const depthLightingBool = canUseDepthBoundLighting(clubState, args);
		const depthSurfaceState = depthLightingBool && effectState.mode === FIXTURE_EFFECT_MODE_NONE ? getDepthSurfaceProjectionState(args, projectedUv, group, fillMix, surfaceBudget) : null;
		const depthAnchorState = depthLightingBool && !depthSurfaceState ? getDepthAnchorState(args, projectedUv, point) : null;
		if (depthSurfaceState) {
			rotation = depthSurfaceState.rotation;
			radiusX = depthSurfaceState.radiusX;
			radiusY = depthSurfaceState.radiusY;
		} else if (depthAnchorState) {
			radiusX = clampNumber(radiusX * depthAnchorState.radiusScale, 0.06, 0.5);
			radiusY = clampNumber(radiusY * depthAnchorState.radiusScale, 0.03, 0.48);
		}
		if (effectState.mode === FIXTURE_EFFECT_MODE_AURORA_CURTAIN && surfaceKey === "ceiling") {
			radiusX = clampNumber(radiusX * 1.18, 0.12, 0.5);
			radiusY = clampNumber(radiusY * 0.52, 0.04, 0.18);
		} else if (effectState.mode === FIXTURE_EFFECT_MODE_FLASHLIGHT) {
			radiusX = clampNumber(radiusX * (group.type === "beam" ? 1.18 : 1.08), 0.12, 0.5);
			radiusY = clampNumber(Math.max(radiusY * 1.9, radiusX * 0.72), 0.12, 0.44);
		} else if (!depthSurfaceState && effectState.mode === FIXTURE_EFFECT_MODE_NONE) {
			radiusX = clampNumber(radiusX * 1.06, 0.1, 0.5);
			radiusY = clampNumber(radiusY * 1.1, 0.08, 0.48);
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

const getSpotLightMasks = function(args, controllerState) {
	if (!controllerState || controllerState.lightingModeKey !== "spots") {
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
	const audioDrive = controllerState.smoothedAudioDrive || 0;
	const spots = [];
	for (let i = 0; i < rankedLights.length && i < PASSTHROUGH_MAX_SPOTS; i += 1) {
		const light = rankedLights[i];
		const ceilingPoint = getRoomCeilingLightPoint(light.dirX, light.dirY, light.dirZ);
		const anchoredPoints = [
			{
				point: getAnchoredRoomPoint(args, ceilingPoint, controllerState),
				radius: clampNumber(0.12 + audioDrive * 0.1 + i * 0.012, 0.08, 0.3),
				strength: clampNumber(0.18 + light.strength * 0.24 + audioDrive * 0.22, 0, 0.72)
			},
			{
				point: getAnchoredRoomPoint(args, getRoomFloorLightPoint(ceilingPoint), controllerState),
				radius: clampNumber(0.16 + audioDrive * 0.14 + i * 0.015, 0.1, 0.38),
				strength: clampNumber(0.08 + light.strength * 0.16 + audioDrive * 0.18, 0, 0.46)
			},
			{
				point: getAnchoredRoomPoint(args, getRoomWallLightPoint(ceilingPoint), controllerState),
				radius: clampNumber(0.14 + audioDrive * 0.1 + i * 0.012, 0.09, 0.32),
				strength: clampNumber(0.1 + light.strength * 0.18 + audioDrive * 0.18, 0, 0.52)
			}
		];
		for (let j = 0; j < anchoredPoints.length && spots.length < PASSTHROUGH_MAX_SPOTS; j += 1) {
			const anchoredPoint = anchoredPoints[j];
			if (!anchoredPoint.point) {
				continue;
			}
			const projectedUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, anchoredPoint.point.x, anchoredPoint.point.y, anchoredPoint.point.z);
			if (!projectedUv) {
				continue;
			}
			const depthAnchorState = canUseDepthBoundLighting(controllerState, args) ? getDepthAnchorState(args, projectedUv, anchoredPoint.point) : null;
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

const getClubLightMasks = function(args, controllerState) {
	if (!controllerState || controllerState.lightingModeKey !== "club") {
		return [];
	}
	const lightingState = args.sceneLightingState;
	if (!lightingState || !lightingState.fixtureGroups || !lightingState.fixtureGroups.length) {
		return [];
	}
	lightingState.fixtureGroups.sort(function(a, b) {
		return (b.intensity || 0) - (a.intensity || 0);
	});
	const rankedGroups = lightingState.fixtureGroups;
	const spots = [];
	for (let i = 0; i < rankedGroups.length && spots.length < PASSTHROUGH_MAX_SPOTS; i += 1) {
		appendClubFixtureMasks(spots, args, rankedGroups[i], controllerState);
	}
	return spots;
};

// Central service entry so passthrough only asks for projected lighting masks.
const getProjectedLightMasks = function(args, controllerState) {
	return controllerState && controllerState.lightingModeKey === "club" ?
		getClubLightMasks(args || {}, controllerState) :
		getSpotLightMasks(args || {}, controllerState);
};
