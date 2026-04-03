// Shared light projection builds MR lighting layers from fixture state and available room geometry.

const PASSTHROUGH_MAX_FLASHLIGHTS = 2;
const PASSTHROUGH_MAX_LIGHT_LAYERS = 24;
const PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT = 2.6;
const PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE = 2.4;
const PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE = 5.6;
const PASSTHROUGH_ROOM_HALF_WIDTH = 3.6;
const PASSTHROUGH_ROOM_HALF_DEPTH = 4.4;
const PASSTHROUGH_ROOM_FLOOR_Y = 0.08;
const PASSTHROUGH_ROOM_WALL_MIN_Y = PASSTHROUGH_ROOM_FLOOR_Y + 0.42;
const PASSTHROUGH_ROOM_WALL_MAX_Y = PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT - 0.34;
const PASSTHROUGH_MIN_WORLD_RADIUS_METERS = 0.12;
const PASSTHROUGH_MAX_WORLD_RADIUS_METERS = 3.2;

const PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO = "auto";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD = "vrWorld";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD = "realWorld";

const createProjectedLightLayerBuffer = function() {
	return {
		count: 0,
		surfaceDepthLayerCount: 0,
		centersUv: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 2),
		colors: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		ellipseParamsUv: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		alphaBlendStrengths: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS),
		effectParams: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		worldCenters: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldBasisX: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldBasisY: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldEllipseParams: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		surfaceDepthFlags: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS)
	};
};

const getProjectedLightLayerBuffer = function(controllerState) {
	if (!controllerState || !controllerState.projectedLightLayerBuffer) {
		if (controllerState) {
			controllerState.projectedLightLayerBuffer = createProjectedLightLayerBuffer();
		}
		return controllerState && controllerState.projectedLightLayerBuffer ? controllerState.projectedLightLayerBuffer : createProjectedLightLayerBuffer();
	}
	return controllerState.projectedLightLayerBuffer;
};

const resetProjectedLightLayerBuffer = function(buffer) {
	if (!buffer) {
		return;
	}
	buffer.count = 0;
	buffer.surfaceDepthLayerCount = 0;
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

const transformPointByMatrix = function(matrix, point) {
	return {
		x: matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12],
		y: matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13],
		z: matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14]
	};
};

const getPointDistance2d = function(ax, ay, bx, by) {
	const deltaX = bx - ax;
	const deltaY = by - ay;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

const getPointDistance3d = function(a, b) {
	if (!a || !b) {
		return 0;
	}
	const deltaX = b.x - a.x;
	const deltaY = b.y - a.y;
	const deltaZ = b.z - a.z;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
};

const crossVec3 = function(ax, ay, az, bx, by, bz) {
	return {
		x: ay * bz - az * by,
		y: az * bx - ax * bz,
		z: ax * by - ay * bx
	};
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

const getRoomWallLightY = function(vertical) {
	return lerpNumber(
		PASSTHROUGH_ROOM_WALL_MIN_Y,
		PASSTHROUGH_ROOM_WALL_MAX_Y,
		clampNumber(vertical == null ? 0.55 : vertical, 0, 1)
	);
};

const getRoomWallLightPoint = function(ceilingPoint, vertical) {
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
		y: getRoomWallLightY(vertical),
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
			y: getRoomWallLightY(group.vertical),
			z: clampNumber(depthSign * PASSTHROUGH_ROOM_HALF_DEPTH * depthLane, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
		};
	}
	const wallScaleX = PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(Math.abs(Math.cos(azimuth)), 0.0001);
	const wallScaleZ = PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(Math.abs(Math.sin(azimuth)), 0.0001);
	const wallScale = Math.min(wallScaleX, wallScaleZ) * radialScale;
	return {
		x: clampNumber(Math.cos(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: getRoomWallLightY(group.vertical),
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

const canUseSurfaceDepth = function(controllerState) {
	return !!(
		controllerState &&
		controllerState.depthActiveBool &&
		controllerState.usableDepthAvailableBool
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

const getRoomSurfaceFrame = function(point, anchorType) {
	if (!point) {
		return null;
	}
	let normal = null;
	let tangentX = null;
	let tangentY = null;
	if (anchorType === "floor" || anchorType === "ceiling") {
		const radialLength = Math.sqrt(point.x * point.x + point.z * point.z);
		const radial = radialLength > 0.001 ? normalizeVec3(point.x, 0, point.z) : {x: 1, y: 0, z: 0};
		normal = anchorType === "floor" ? {x: 0, y: 1, z: 0} : {x: 0, y: -1, z: 0};
		tangentX = normalizeVec3(-radial.z, 0, radial.x);
		if (Math.abs(tangentX.x) < 0.001 && Math.abs(tangentX.z) < 0.001) {
			tangentX = {x: 1, y: 0, z: 0};
		}
		const tangentYCross = crossVec3(normal.x, normal.y, normal.z, tangentX.x, tangentX.y, tangentX.z);
		tangentY = normalizeVec3(tangentYCross.x, tangentYCross.y, tangentYCross.z);
		return {
			normal: normal,
			tangentX: tangentX,
			tangentY: tangentY
		};
	}
	if (Math.abs(Math.abs(point.x) - PASSTHROUGH_ROOM_HALF_WIDTH) <= Math.abs(Math.abs(point.z) - PASSTHROUGH_ROOM_HALF_DEPTH)) {
		normal = {x: point.x >= 0 ? -1 : 1, y: 0, z: 0};
		tangentX = {x: 0, y: 0, z: point.x >= 0 ? -1 : 1};
	} else {
		normal = {x: 0, y: 0, z: point.z >= 0 ? -1 : 1};
		tangentX = {x: point.z >= 0 ? 1 : -1, y: 0, z: 0};
	}
	tangentY = {x: 0, y: 1, z: 0};
	return {
		normal: normal,
		tangentX: tangentX,
		tangentY: tangentY
	};
};

const getAnchoredRoomFrame = function(args, roomPoint, roomFrame, controllerState) {
	if (!roomPoint || !roomFrame) {
		return null;
	}
	const centerPoint = getAnchoredRoomPoint(args, roomPoint, controllerState);
	const tangentPointX = getAnchoredRoomPoint(args, {
		x: roomPoint.x + roomFrame.tangentX.x,
		y: roomPoint.y + roomFrame.tangentX.y,
		z: roomPoint.z + roomFrame.tangentX.z
	}, controllerState);
	const tangentPointY = getAnchoredRoomPoint(args, {
		x: roomPoint.x + roomFrame.tangentY.x,
		y: roomPoint.y + roomFrame.tangentY.y,
		z: roomPoint.z + roomFrame.tangentY.z
	}, controllerState);
	if (!centerPoint || !tangentPointX || !tangentPointY) {
		return null;
	}
	return {
		centerPoint: centerPoint,
		tangentX: normalizeVec3(
			tangentPointX.x - centerPoint.x,
			tangentPointX.y - centerPoint.y,
			tangentPointX.z - centerPoint.z
		),
		tangentY: normalizeVec3(
			tangentPointY.x - centerPoint.x,
			tangentPointY.y - centerPoint.y,
			tangentPointY.z - centerPoint.z
		)
	};
};

const getProjectedMaskFromWorldFootprint = function(args, centerPoint, tangentX, tangentY, radiusX, radiusY) {
	if (!args || !args.viewMatrix || !args.projMatrix || !centerPoint || !tangentX || !tangentY) {
		return null;
	}
	const centerUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, centerPoint.x, centerPoint.y, centerPoint.z);
	if (!centerUv) {
		return null;
	}
	const radiusPointX = {
		x: centerPoint.x + tangentX.x * radiusX,
		y: centerPoint.y + tangentX.y * radiusX,
		z: centerPoint.z + tangentX.z * radiusX
	};
	const radiusPointY = {
		x: centerPoint.x + tangentY.x * radiusY,
		y: centerPoint.y + tangentY.y * radiusY,
		z: centerPoint.z + tangentY.z * radiusY
	};
	const projectedRadiusUvX = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointX.x, radiusPointX.y, radiusPointX.z);
	const projectedRadiusUvY = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointY.x, radiusPointY.y, radiusPointY.z);
	if (!projectedRadiusUvX || !projectedRadiusUvY) {
		return null;
	}
	return {
		x: centerUv.x,
		y: centerUv.y,
		rotation: Math.atan2(projectedRadiusUvX.y - centerUv.y, projectedRadiusUvX.x - centerUv.x),
		radiusX: clampNumber(getPointDistance2d(centerUv.x, centerUv.y, projectedRadiusUvX.x, projectedRadiusUvX.y), 0.02, 0.5),
		radiusY: clampNumber(getPointDistance2d(centerUv.x, centerUv.y, projectedRadiusUvY.x, projectedRadiusUvY.y), 0.02, 0.48)
	};
};

const getFixtureWorldRadii = function(group, effectState, fillMix, surfaceBudget, surfaceKey, surfaceDepthBool) {
	const footprint = getFixtureEffectFootprint({
		group: group,
		effectState: effectState,
		fillMix: fillMix,
		surfaceBudget: surfaceBudget,
		surfaceKey: surfaceKey,
		surfaceDepthBool: surfaceDepthBool,
		baseRadius: group && group.radius
	});
	return {
		radiusX: clampNumber(footprint.radiusX, PASSTHROUGH_MIN_WORLD_RADIUS_METERS, PASSTHROUGH_MAX_WORLD_RADIUS_METERS),
		radiusY: clampNumber(footprint.radiusY, PASSTHROUGH_MIN_WORLD_RADIUS_METERS * 0.6, PASSTHROUGH_MAX_WORLD_RADIUS_METERS)
	};
};

const shouldUseSurfaceDepth = function(controllerState, args) {
	return getEffectiveLightingAnchorModeKey(controllerState) === PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD && canUseSurfaceDepth(controllerState);
};

const getSurfaceProjectionState = function(args, controllerState, roomPoint, anchorType, radiusX, radiusY) {
	const roomFrame = getRoomSurfaceFrame(roomPoint, anchorType);
	const anchoredFrame = getAnchoredRoomFrame(args, roomPoint, roomFrame, controllerState);
	if (!anchoredFrame) {
		return null;
	}
	const maskState = getProjectedMaskFromWorldFootprint(
		args,
		anchoredFrame.centerPoint,
		anchoredFrame.tangentX,
		anchoredFrame.tangentY,
		radiusX,
		radiusY
	);
	if (!maskState) {
		return null;
	}
	return {
		maskState: maskState,
		centerPoint: anchoredFrame.centerPoint,
		tangentX: anchoredFrame.tangentX,
		tangentY: anchoredFrame.tangentY,
		radiusX: radiusX,
		radiusY: radiusY,
		surfaceDepthBool: shouldUseSurfaceDepth(controllerState, args)
	};
};

const appendProjectedLightLayer = function(buffer, layerState) {
	if (!buffer || !layerState || buffer.count >= PASSTHROUGH_MAX_LIGHT_LAYERS) {
		return false;
	}
	const layerIndex = buffer.count;
	const centerOffset = layerIndex * 2;
	const colorOffset = layerIndex * 4;
	const ellipseOffset = layerIndex * 4;
	const worldCenterOffset = layerIndex * 3;
	const worldBasisOffset = layerIndex * 3;
	const worldParamsOffset = layerIndex * 4;
	buffer.centersUv[centerOffset] = layerState.centerUvX || 0;
	buffer.centersUv[centerOffset + 1] = layerState.centerUvY || 0;
	buffer.colors[colorOffset] = layerState.colorR || 0;
	buffer.colors[colorOffset + 1] = layerState.colorG || 0;
	buffer.colors[colorOffset + 2] = layerState.colorB || 0;
	buffer.colors[colorOffset + 3] = layerState.strength || 0;
	buffer.ellipseParamsUv[ellipseOffset] = layerState.radiusUvX || 0;
	buffer.ellipseParamsUv[ellipseOffset + 1] = layerState.radiusUvY || 0;
	buffer.ellipseParamsUv[ellipseOffset + 2] = layerState.softnessUv || 0;
	buffer.ellipseParamsUv[ellipseOffset + 3] = layerState.rotation || 0;
	buffer.alphaBlendStrengths[layerIndex] = layerState.alphaBlendStrength == null ? 1 : layerState.alphaBlendStrength;
	buffer.effectParams[ellipseOffset] = layerState.effectType || 0;
	buffer.effectParams[ellipseOffset + 1] = layerState.effectPhase || 0;
	buffer.effectParams[ellipseOffset + 2] = layerState.effectDensity || 0;
	buffer.effectParams[ellipseOffset + 3] = layerState.effectAmount || 0;
	buffer.worldCenters[worldCenterOffset] = layerState.worldCenterX || 0;
	buffer.worldCenters[worldCenterOffset + 1] = layerState.worldCenterY || 0;
	buffer.worldCenters[worldCenterOffset + 2] = layerState.worldCenterZ || 0;
	buffer.worldBasisX[worldBasisOffset] = layerState.worldBasisXX || 0;
	buffer.worldBasisX[worldBasisOffset + 1] = layerState.worldBasisXY || 0;
	buffer.worldBasisX[worldBasisOffset + 2] = layerState.worldBasisXZ || 0;
	buffer.worldBasisY[worldBasisOffset] = layerState.worldBasisYX || 0;
	buffer.worldBasisY[worldBasisOffset + 1] = layerState.worldBasisYY || 0;
	buffer.worldBasisY[worldBasisOffset + 2] = layerState.worldBasisYZ || 0;
	buffer.worldEllipseParams[worldParamsOffset] = layerState.worldRadiusX || 0;
	buffer.worldEllipseParams[worldParamsOffset + 1] = layerState.worldRadiusY || 0;
	buffer.worldEllipseParams[worldParamsOffset + 2] = layerState.worldSoftness || 0;
	buffer.worldEllipseParams[worldParamsOffset + 3] = layerState.worldPlaneWidth || 0;
	buffer.surfaceDepthFlags[layerIndex] = layerState.surfaceDepthBool ? 1 : 0;
	buffer.count += 1;
	if (layerState.surfaceDepthBool) {
		buffer.surfaceDepthLayerCount += 1;
	}
	return true;
};

const appendControllerFlashlightLayers = function(buffer, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost) {
	const controllerRays = args.controllerRays || [];
	for (let i = 0; i < controllerRays.length && buffer && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const ray = controllerRays[i];
		if (!ray || !ray.origin || !ray.dir) {
			continue;
		}
		const point = ray.hitPoint || {
			x: ray.origin.x + ray.dir.x * 6,
			y: ray.origin.y + ray.dir.y * 6,
			z: ray.origin.z + ray.dir.z * 6
		};
		let tangentX = crossVec3(0, 1, 0, ray.dir.x, ray.dir.y, ray.dir.z);
		if (getPointDistance3d({x: 0, y: 0, z: 0}, tangentX) <= 0.01) {
			tangentX = crossVec3(1, 0, 0, ray.dir.x, ray.dir.y, ray.dir.z);
		}
		tangentX = normalizeVec3(tangentX.x, tangentX.y, tangentX.z);
		let tangentY = crossVec3(ray.dir.x, ray.dir.y, ray.dir.z, tangentX.x, tangentX.y, tangentX.z);
		tangentY = normalizeVec3(tangentY.x, tangentY.y, tangentY.z);
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: 0,
			stereoBiasOffset: 0
		});
		const baseRadius = clampNumber((group.radius || 0.4) * (group.type === "wash" ? 0.82 : 0.62), 0.22, 1.2);
		const maskState = getProjectedMaskFromWorldFootprint(args, point, tangentX, tangentY, baseRadius * 1.18, baseRadius * 0.84);
		if (!maskState) {
			continue;
		}
		appendProjectedLightLayer(buffer, {
			centerUvX: maskState.x,
			centerUvY: maskState.y,
			colorR: group.color[0],
			colorG: group.color[1],
			colorB: group.color[2],
			radiusUvX: maskState.radiusX,
			radiusUvY: maskState.radiusY,
			rotation: maskState.rotation,
			softnessUv: clampNumber((group.softness == null ? 0.16 : group.softness), 0.04, 0.4),
			alphaBlendStrength: effectState.alphaBlendStrength,
			effectType: effectState.type,
			effectPhase: effectState.phase,
			effectDensity: effectState.density,
			effectAmount: effectState.amount,
			worldCenterX: point.x,
			worldCenterY: point.y,
			worldCenterZ: point.z,
			worldBasisXX: tangentX.x,
			worldBasisXY: tangentX.y,
			worldBasisXZ: tangentX.z,
			worldBasisYX: tangentY.x,
			worldBasisYY: tangentY.y,
			worldBasisYZ: tangentY.z,
			worldRadiusX: baseRadius * 1.18,
			worldRadiusY: baseRadius * 0.84,
			worldSoftness: clampNumber(baseRadius * 0.2, 0.05, 0.28),
			worldPlaneWidth: clampNumber(baseRadius * 0.3, 0.08, 0.34),
			surfaceDepthBool: false,
			strength: clampNumber(baseStrength * typeIntensityScale * strobeBoost, 0, group.type === "strobe" ? 0.88 : 0.72)
		});
	}
};

const appendClubFixtureLayers = function(buffer, args, group, clubState) {
	if (!buffer || !group || !args || !args.viewMatrix || !args.projMatrix) {
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
		appendControllerFlashlightLayers(buffer, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost);
		return;
	}
	const variantCount = Math.min(
		PASSTHROUGH_MAX_LIGHT_LAYERS,
		(group.type === "beam" ? 3 : (group.type === "wash" ? 2 : 1)) +
		(group.type === "wash" ? (surfaceBudget.washVariantCountBoost || 0) : (group.type === "beam" ? (surfaceBudget.beamVariantCountBoost || 0) : (surfaceBudget.strobeVariantCountBoost || 0)))
	);
	for (let i = 0; i < variantCount && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const variantCenter = variantCount === 1 ? 0 : (i / (variantCount - 1)) - 0.5;
		const variantOffset = variantCenter * sweep * (group.type === "beam" ? (surfaceKey === "wall" ? 0.64 : 0.52) : (surfaceKey === "floor" ? 0.3 : 0.24));
		const roomPoint = getRoomPointForFixtureGroup(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset);
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: variantCenter,
			stereoBiasOffset: stereoBiasOffset
		});
		const worldRadii = getFixtureWorldRadii(group, effectState, fillMix, surfaceBudget, surfaceKey, shouldUseSurfaceDepth(clubState, args));
		const surfaceState = getSurfaceProjectionState(
			args,
			clubState,
			roomPoint,
			group.anchorType,
			worldRadii.radiusX,
			worldRadii.radiusY
		);
		if (!surfaceState) {
			continue;
		}
		appendProjectedLightLayer(buffer, {
			centerUvX: surfaceState.maskState.x,
			centerUvY: surfaceState.maskState.y,
			colorR: group.color[0],
			colorG: group.color[1],
			colorB: group.color[2],
			radiusUvX: surfaceState.maskState.radiusX,
			radiusUvY: surfaceState.maskState.radiusY,
			rotation: surfaceState.maskState.rotation,
			softnessUv: clampNumber((group.softness == null ? 0.16 : group.softness) + surfaceBudget.softnessBias, 0.04, 0.4),
			worldCenterX: surfaceState.centerPoint.x,
			worldCenterY: surfaceState.centerPoint.y,
			worldCenterZ: surfaceState.centerPoint.z,
			worldBasisXX: surfaceState.tangentX.x,
			worldBasisXY: surfaceState.tangentX.y,
			worldBasisXZ: surfaceState.tangentX.z,
			worldBasisYX: surfaceState.tangentY.x,
			worldBasisYY: surfaceState.tangentY.y,
			worldBasisYZ: surfaceState.tangentY.z,
			worldRadiusX: surfaceState.radiusX,
			worldRadiusY: surfaceState.radiusY,
			worldSoftness: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.22, 0.05, 0.28),
			worldPlaneWidth: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.32, 0.08, 0.34),
			surfaceDepthBool: surfaceState.surfaceDepthBool,
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

const buildDirectionalLightLayers = function(args, controllerState, buffer) {
	if (!controllerState || controllerState.lightingModeKey !== "spots") {
		return buffer;
	}
	const lightingState = args.sceneLightingState;
	if (!lightingState) {
		return buffer;
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
	for (let i = 0; i < rankedLights.length && i < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const light = rankedLights[i];
		const ceilingPoint = getRoomCeilingLightPoint(light.dirX, light.dirY, light.dirZ);
		const roomTargets = [
			{
				point: ceilingPoint,
				anchorType: "ceiling",
				radiusX: clampNumber(0.48 + audioDrive * 0.34 + light.strength * 0.26 + i * 0.03, 0.32, 1.18),
				radiusY: clampNumber(0.48 + audioDrive * 0.34 + light.strength * 0.26 + i * 0.03, 0.32, 1.18),
				strength: clampNumber(0.18 + light.strength * 0.24 + audioDrive * 0.22, 0, 0.72)
			},
			{
				point: getRoomFloorLightPoint(ceilingPoint),
				anchorType: "floor",
				radiusX: clampNumber(0.64 + audioDrive * 0.44 + light.strength * 0.32 + i * 0.04, 0.42, 1.42),
				radiusY: clampNumber(0.72 + audioDrive * 0.48 + light.strength * 0.34 + i * 0.04, 0.44, 1.56),
				strength: clampNumber(0.08 + light.strength * 0.16 + audioDrive * 0.18, 0, 0.46)
			},
			{
				point: getRoomWallLightPoint(ceilingPoint, 0.62),
				anchorType: "wall",
				radiusX: clampNumber(0.58 + audioDrive * 0.28 + light.strength * 0.24 + i * 0.03, 0.36, 1.16),
				radiusY: clampNumber(0.52 + audioDrive * 0.22 + light.strength * 0.2 + i * 0.03, 0.34, 0.96),
				strength: clampNumber(0.1 + light.strength * 0.18 + audioDrive * 0.18, 0, 0.52)
			}
		];
		for (let j = 0; j < roomTargets.length && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; j += 1) {
			const roomTarget = roomTargets[j];
			if (!roomTarget.point) {
				continue;
			}
			const surfaceState = getSurfaceProjectionState(
				args,
				controllerState,
				roomTarget.point,
				roomTarget.anchorType,
				roomTarget.radiusX,
				roomTarget.radiusY
			);
			if (!surfaceState) {
				continue;
			}
			appendProjectedLightLayer(buffer, {
				centerUvX: surfaceState.maskState.x,
				centerUvY: surfaceState.maskState.y,
				colorR: light.r,
				colorG: light.g,
				colorB: light.b,
				radiusUvX: surfaceState.maskState.radiusX,
				radiusUvY: surfaceState.maskState.radiusY,
				rotation: surfaceState.maskState.rotation,
				softnessUv: 0.12,
				worldCenterX: surfaceState.centerPoint.x,
				worldCenterY: surfaceState.centerPoint.y,
				worldCenterZ: surfaceState.centerPoint.z,
				worldBasisXX: surfaceState.tangentX.x,
				worldBasisXY: surfaceState.tangentX.y,
				worldBasisXZ: surfaceState.tangentX.z,
				worldBasisYX: surfaceState.tangentY.x,
				worldBasisYY: surfaceState.tangentY.y,
				worldBasisYZ: surfaceState.tangentY.z,
				worldRadiusX: surfaceState.radiusX,
				worldRadiusY: surfaceState.radiusY,
				worldSoftness: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.22, 0.05, 0.28),
				worldPlaneWidth: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.32, 0.08, 0.34),
				surfaceDepthBool: surfaceState.surfaceDepthBool,
				alphaBlendStrength: 0.94,
				effectType: 0,
				effectPhase: 0,
				effectDensity: 0,
				effectAmount: 0,
				strength: roomTarget.strength
			});
		}
	}
	return buffer;
};

const buildFixtureLightLayers = function(args, controllerState, buffer) {
	if (!controllerState || controllerState.lightingModeKey !== "club") {
		return buffer;
	}
	const lightingState = args.sceneLightingState;
	if (!lightingState || !lightingState.fixtureGroups || !lightingState.fixtureGroups.length) {
		return buffer;
	}
	const rankedGroups = lightingState.fixtureGroups.slice(0).sort(function(a, b) {
		return (b.intensity || 0) - (a.intensity || 0);
	});
	for (let i = 0; i < rankedGroups.length && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		appendClubFixtureLayers(buffer, args, rankedGroups[i], controllerState);
	}
	return buffer;
};

// Central service entry so passthrough only consumes one shared projected-light buffer.
const buildProjectedLightLayers = function(args, controllerState) {
	const layerBuffer = getProjectedLightLayerBuffer(controllerState);
	resetProjectedLightLayerBuffer(layerBuffer);
	if (controllerState && controllerState.lightingModeKey === "club") {
		return buildFixtureLightLayers(args || {}, controllerState, layerBuffer);
	}
	return buildDirectionalLightLayers(args || {}, controllerState, layerBuffer);
};
