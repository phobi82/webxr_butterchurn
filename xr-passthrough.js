const PASSTHROUGH_DEPTH_MOTION_SMOOTHING_SECONDS = 0.05;

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
		lightingAnchorModeKey: options.initialLightingAnchorModeKey || PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO,
		lightingDarkness: options.initialLightingDarkness == null ? 0.05 : options.initialLightingDarkness,
		effectSemanticModeKey: options.initialEffectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
		effectAdditiveShare: options.initialEffectAdditiveShare == null ? 1 : options.initialEffectAdditiveShare,
		effectAlphaBlendShare: options.initialEffectAlphaBlendShare == null ? 1 : options.initialEffectAlphaBlendShare,
		manualMix: options.initialManualMix == null ? 0 : options.initialManualMix,
		audioReactiveIntensity: options.initialAudioReactiveIntensity == null ? 0.7 : options.initialAudioReactiveIntensity,
		flashlightRadius: options.initialFlashlightRadius == null ? 0.15 : options.initialFlashlightRadius,
		flashlightSoftness: options.initialFlashlightSoftness == null ? 0.05 : options.initialFlashlightSoftness,
		depthModeKey: options.initialDepthModeKey || "distance",
		depthRadialBool: options.initialDepthRadialBool == null ? true : !!options.initialDepthRadialBool,
		depthMotionCompensationBool: options.initialDepthMotionCompensationBool == null ? true : !!options.initialDepthMotionCompensationBool,
		depthMotionCompensationFactor: options.initialDepthMotionCompensationFactor == null ? 2.8 : options.initialDepthMotionCompensationFactor,
		depthThreshold: 0.80,
		depthFade: 0.20,
		depthDistanceReactiveBool: false,
		depthDistanceReactiveIntensity: options.initialDepthDistanceReactiveIntensity == null ? 1 : options.initialDepthDistanceReactiveIntensity,
		depthDistanceMrRetain: 0.3,
		depthReconstructionModeKey: options.initialDepthReconstructionModeKey || "heightmap",
		depthEchoPhase: 0,
		depthEchoWavelength: 3,
		depthEchoDutyCycle: 0.25,
		depthEchoFade: 1,
		depthEchoPhaseSpeed: 5,
		depthEchoReactiveIntensity: options.initialDepthEchoReactiveIntensity == null ? 1 : options.initialDepthEchoReactiveIntensity,
		depthEchoPhaseOffset: 0,
		depthEchoMrRetain: options.initialDepthEchoMrRetain == null ? 0.95 : options.initialDepthEchoMrRetain,
		depthEchoPhaseReactiveBool: false,
		depthEchoPhaseSpeedReactiveBool: false,
		depthEchoWavelengthReactiveBool: false,
		depthEchoDutyCycleReactiveBool: true,
		depthEchoFadeReactiveBool: false,
		depthMrRetain: 0,
		usableDepthAvailableBool: false,
		depthVisualMaskingEnabledBool: options.depthVisualMaskingEnabledBool == null ? true : !!options.depthVisualMaskingEnabledBool,
		depthMotionCompensationByView: [],
		filteredDepthMotionVelocityByView: [],
		previousDepthMotionPoseByView: [],
		smoothedAudioDrive: 0,
		smoothedBlendDrive: 0
	};

	const getDepthModeFloat = function(depthModeKey) {
		return depthModeKey === "echo" ? 1 : 0;
	};

	const getDepthMrRetainForMode = function(depthModeKey) {
		return depthModeKey === "echo" ? state.depthEchoMrRetain : state.depthDistanceMrRetain;
	};

	const buildDepthProjectionParams = function(projMatrix) {
		const rayParams = extractProjectionRayParams(projMatrix);
		return {
			xScale: rayParams.xScale,
			yScale: rayParams.yScale,
			xOffset: rayParams.xOffset,
			yOffset: rayParams.yOffset
		};
	};

	const buildOrientationBasis = function(quaternion) {
		return {
			right: {
				x: 1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z),
				y: 2 * (quaternion.x * quaternion.y + quaternion.w * quaternion.z),
				z: 2 * (quaternion.x * quaternion.z - quaternion.w * quaternion.y)
			},
			up: {
				x: 2 * (quaternion.x * quaternion.y - quaternion.w * quaternion.z),
				y: 1 - 2 * (quaternion.x * quaternion.x + quaternion.z * quaternion.z),
				z: 2 * (quaternion.y * quaternion.z + quaternion.w * quaternion.x)
			}
		};
	};

	const getDepthMotionSmoothingAlpha = function(delta) {
		const safeDelta = Math.max(1 / 240, delta || 1 / 240);
		const tau = Math.max(0.001, PASSTHROUGH_DEPTH_MOTION_SMOOTHING_SECONDS);
		return 1 - Math.exp(-safeDelta / tau);
	};

	const clearDepthMotionCompensation = function() {
		state.depthMotionCompensationByView.length = 0;
	};

	const resetDepthMotionCompensationFilter = function() {
		clearDepthMotionCompensation();
		state.filteredDepthMotionVelocityByView.length = 0;
		state.previousDepthMotionPoseByView.length = 0;
	};

	const updateDepthMotionCompensation = function(passthroughPose, delta) {
		clearDepthMotionCompensation();
		if (!state.depthMotionCompensationBool || !passthroughPose || !passthroughPose.views || !passthroughPose.views.length || !Number.isFinite(delta) || delta <= 0) {
			resetDepthMotionCompensationFilter();
			return;
		}
		for (let i = 0; i < passthroughPose.views.length; i += 1) {
			const view = passthroughPose.views[i];
			const transform = view && view.transform;
			const orientation = transform && transform.orientation;
			const position = transform && transform.position;
			if (!orientation || !position || !view.projectionMatrix) {
				state.previousDepthMotionPoseByView[i] = null;
				state.depthMotionCompensationByView[i] = {x: 0, y: 0};
				state.filteredDepthMotionVelocityByView[i] = {x: 0, y: 0};
				continue;
			}
			const currentYawPitch = extractForwardYawPitchFromQuaternion(orientation);
			const previousPose = state.previousDepthMotionPoseByView[i];
			let velocityX = 0;
			let velocityY = 0;
			if (previousPose && previousPose.position && previousPose.orientation) {
				const previousYaw = previousPose.yaw;
				const previousPitch = previousPose.pitch;
				const yawDelta = unwrapAngle(currentYawPitch.yaw, previousYaw) - previousYaw;
				const pitchDelta = unwrapAngle(currentYawPitch.pitch, previousPitch) - previousPitch;
				const positionDeltaX = position.x - previousPose.position.x;
				const positionDeltaY = position.y - previousPose.position.y;
				const positionDeltaZ = position.z - previousPose.position.z;
				const orientationBasis = buildOrientationBasis(orientation);
				const localDeltaX =
					positionDeltaX * orientationBasis.right.x +
					positionDeltaY * orientationBasis.right.y +
					positionDeltaZ * orientationBasis.right.z;
				const localDeltaY =
					positionDeltaX * orientationBasis.up.x +
					positionDeltaY * orientationBasis.up.y +
					positionDeltaZ * orientationBasis.up.z;
				const projectionParams = buildDepthProjectionParams(view.projectionMatrix);
				const referenceDepth = Math.max(state.depthModeKey === "distance" ? state.depthThreshold : 1, 0.35);
				const safeDelta = Math.max(delta, 1 / 240);
				velocityX = ((yawDelta + (localDeltaX / referenceDepth)) * projectionParams.xScale * 0.5) / safeDelta;
				velocityY = ((pitchDelta + (localDeltaY / referenceDepth)) * projectionParams.yScale * 0.5) / safeDelta;
			}
			const rawVelocity = {
				x: clampNumber(velocityX, -7.5, 7.5),
				y: clampNumber(velocityY, -7.5, 7.5)
			};
			const previousFilteredVelocity = state.filteredDepthMotionVelocityByView[i] || {x: 0, y: 0};
			const velocityAlpha = getDepthMotionSmoothingAlpha(delta);
			const filteredVelocity = {
				x: lerpNumber(previousFilteredVelocity.x, rawVelocity.x, velocityAlpha),
				y: lerpNumber(previousFilteredVelocity.y, rawVelocity.y, velocityAlpha)
			};
			if (Math.abs(filteredVelocity.x) < 0.005) {
				filteredVelocity.x = 0;
			}
			if (Math.abs(filteredVelocity.y) < 0.005) {
				filteredVelocity.y = 0;
			}
			state.filteredDepthMotionVelocityByView[i] = filteredVelocity;
			const compensationScale = clampNumber(state.depthMotionCompensationFactor, 0, 5);
			state.depthMotionCompensationByView[i] = {
				x: clampNumber(filteredVelocity.x * delta * compensationScale, -0.35, 0.35),
				y: clampNumber(filteredVelocity.y * delta * compensationScale, -0.35, 0.35)
			};
			state.previousDepthMotionPoseByView[i] = {
				position: {x: position.x, y: position.y, z: position.z},
				orientation: {x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w},
				yaw: currentYawPitch.yaw,
				pitch: currentYawPitch.pitch
			};
		}
		state.previousDepthMotionPoseByView.length = passthroughPose.views.length;
	};

	state.depthMrRetain = getDepthMrRetainForMode(state.depthModeKey);

	const quantizeDepthEchoPhaseSpeed = function(value) {
		return clampNumber(Math.round(value * 10) / 10, -10, 10);
	};

	const quantizeDepthEchoWavelength = function(value) {
		return clampNumber(Math.round(value * 10) / 10, 0.1, 10);
	};

	const wrapEchoPhase = function(phaseValue, wavelength) {
		wavelength = Math.max(0.1, wavelength || 0.1);
		return ((phaseValue % wavelength) + wavelength) % wavelength;
	};

	const applyReactiveDelta = function(baseValue, reactiveValue, intensity) {
		return baseValue + (reactiveValue - baseValue) * clampNumber(intensity, -1, 1);
	};

	const getEffectiveDistanceDepthState = function() {
		var effectiveThreshold = state.depthThreshold;
		if (state.depthDistanceReactiveBool) {
			effectiveThreshold = clampNumber(
				state.depthThreshold + (state.smoothedAudioDrive - 0.5) * 16 * clampNumber(state.depthDistanceReactiveIntensity, -1, 1),
				0,
				8
			);
		}
		return {
			depthMode: getDepthModeFloat(state.depthModeKey),
			depthThreshold: effectiveThreshold,
			depthFade: state.depthFade,
			depthEchoWavelength: state.depthEchoWavelength,
			depthEchoDutyCycle: state.depthEchoDutyCycle,
			depthEchoFade: state.depthEchoFade,
			depthPhaseOffset: wrapEchoPhase(state.depthEchoPhase + state.depthEchoPhaseOffset, state.depthEchoWavelength),
			depthMrRetain: state.depthMrRetain,
			depthRadialBool: state.depthRadialBool
		};
	};

	const getEffectiveEchoDepthState = function() {
		var effectiveWavelength = state.depthEchoWavelength;
		var effectiveDutyCycle = state.depthEchoDutyCycle;
		var effectiveFade = state.depthEchoFade;
		var audioDrive = clampNumber(state.smoothedAudioDrive, 0, 1);
		var reactiveIntensity = clampNumber(state.depthEchoReactiveIntensity, -1, 1);
		if (state.depthEchoWavelengthReactiveBool) {
			effectiveWavelength = clampNumber(
				applyReactiveDelta(state.depthEchoWavelength, state.depthEchoWavelength * lerpNumber(1.45, 0.55, audioDrive), reactiveIntensity),
				0.1,
				10
			);
		}
		if (state.depthEchoDutyCycleReactiveBool) {
			effectiveDutyCycle = clampNumber(
				applyReactiveDelta(state.depthEchoDutyCycle, state.depthEchoDutyCycle + (audioDrive - 0.5) * 3.2, reactiveIntensity),
				0,
				1
			);
		}
		if (state.depthEchoFadeReactiveBool) {
			effectiveFade = clampNumber(
				applyReactiveDelta(state.depthEchoFade, state.depthEchoFade + (audioDrive - 0.5) * 1.8, reactiveIntensity),
				0,
				1
			);
		}
		var effectivePhase = wrapEchoPhase(state.depthEchoPhase + state.depthEchoPhaseOffset, effectiveWavelength);
		if (state.depthEchoPhaseReactiveBool) {
			effectivePhase = wrapEchoPhase(effectivePhase + audioDrive * effectiveWavelength * reactiveIntensity * 2, effectiveWavelength);
		}
		return {
			depthMode: getDepthModeFloat(state.depthModeKey),
			depthThreshold: state.depthThreshold,
			depthFade: state.depthFade,
			depthEchoWavelength: effectiveWavelength,
			depthEchoDutyCycle: effectiveDutyCycle,
			depthEchoFade: effectiveFade,
			depthPhaseOffset: effectivePhase,
			depthMrRetain: state.depthMrRetain,
			depthRadialBool: state.depthRadialBool
		};
	};

	const buildDepthRenderState = function(args) {
		const baseState = state.depthModeKey === "echo" ? getEffectiveEchoDepthState() : getEffectiveDistanceDepthState();
		baseState.depthProjectionParams = buildDepthProjectionParams(args && (args.depthProjMatrix || args.projMatrix));
		const viewIndex = args && args.viewIndex != null ? args.viewIndex : 0;
		const motionCompensation = state.depthMotionCompensationByView[viewIndex];
		baseState.depthMotionCompensation = motionCompensation ? {x: motionCompensation.x, y: motionCompensation.y} : {x: 0, y: 0};
		return baseState;
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
			const targetBlendDrive = getPassthroughBlendDrive(args.audioMetrics);
			const delta = clampNumber(args.delta == null ? 1 / 60 : args.delta, 0, 0.1);
			const smoothFactor = clampNumber(delta * 9.5, 0.05, 1);
			state.smoothedAudioDrive = lerpNumber(state.smoothedAudioDrive, targetDrive, smoothFactor);
			state.smoothedBlendDrive = lerpNumber(state.smoothedBlendDrive, targetBlendDrive, smoothFactor);
			var effectivePhaseSpeed = state.depthEchoPhaseSpeed;
			if (state.depthEchoPhaseSpeedReactiveBool) {
				effectivePhaseSpeed = clampNumber(
					applyReactiveDelta(state.depthEchoPhaseSpeed, state.depthEchoPhaseSpeed + (state.smoothedBlendDrive - 0.5) * 20, state.depthEchoReactiveIntensity),
					-10,
					10
				);
			}
			state.depthEchoPhaseOffset += effectivePhaseSpeed * delta;
			if (state.depthEchoWavelength > 0.0001 && Number.isFinite(state.depthEchoPhaseOffset)) {
				state.depthEchoPhaseOffset = wrapEchoPhase(state.depthEchoPhaseOffset, state.depthEchoWavelength);
			}
			updateDepthMotionCompensation(args.passthroughPose || null, delta);
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
				depthRadialBool: state.depthRadialBool,
				depthMotionCompensationBool: state.depthMotionCompensationBool,
				depthReconstructionModes: passthroughDepthReconstructionModeDefinitions,
				selectedDepthReconstructionModeKey: state.depthReconstructionModeKey,
				depthModes: passthroughDepthModeDefinitions,
				selectedDepthModeKey: state.depthModeKey,
				usableDepthAvailableBool: state.usableDepthAvailableBool,
				passthroughControls: ptControlState.controls || [],
				distanceReactiveControl: ptControlState.distanceReactiveControl || null,
				echoReactiveControls: ptControlState.echoReactiveControls || [],
				echoReactiveIntensityVisibleBool: !!ptControlState.echoReactiveIntensityVisibleBool,
				lightingModes: passthroughLightingModeDefinitions,
				lightingAnchorModes: passthroughLightingAnchorModeDefinitions,
				selectedLightingModeKey: state.lightingModeKey,
				selectedLightingAnchorModeKey: state.lightingAnchorModeKey,
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
		toggleDepthRadial: function() { state.depthRadialBool = !state.depthRadialBool; },
		toggleDepthMotionCompensation: function() {
			state.depthMotionCompensationBool = !state.depthMotionCompensationBool;
			if (!state.depthMotionCompensationBool) {
				resetDepthMotionCompensationFilter();
			}
		},
		cycleDepthReconstructionMode: function(direction) {
			state.depthReconstructionModeKey = cycleModeKey(passthroughDepthReconstructionModeDefinitions, state.depthReconstructionModeKey, direction < 0 ? -1 : 1);
		},
		cycleDepthMode: function(direction) {
			state.depthModeKey = cycleModeKey(passthroughDepthModeDefinitions, state.depthModeKey, direction < 0 ? -1 : 1);
			state.depthMrRetain = getDepthMrRetainForMode(state.depthModeKey);
		},
		getDepthProcessingConfig: function() {
			if (!state.depthActiveBool) {
				return null;
			}
			return {
				reconstructionKey: state.depthReconstructionModeKey,
				edgeAwareBool: state.depthReconstructionModeKey === "edgeAware",
				heightmapBool: state.depthReconstructionModeKey === "heightmap",
				label: state.depthReconstructionModeKey
			};
		},
		cycleLightingMode: function(direction) {
			state.lightingModeKey = cycleModeKey(passthroughLightingModeDefinitions, state.lightingModeKey, direction < 0 ? -1 : 1);
		},
		cycleLightingAnchorMode: function(direction) {
			state.lightingAnchorModeKey = cycleModeKey(passthroughLightingAnchorModeDefinitions, state.lightingAnchorModeKey, direction < 0 ? -1 : 1);
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
			if (key === "lightingAnchorMode") {
				const nextIndex = clampNumber(Math.round(value), 0, passthroughLightingAnchorModeDefinitions.length - 1);
				state.lightingAnchorModeKey = passthroughLightingAnchorModeDefinitions[nextIndex].key;
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
			if (key === "depthMotionCompensationFactor") {
				state.depthMotionCompensationFactor = clampNumber(value, 0, 5);
			}
			if (key === "depthDistanceReactiveIntensity") {
				state.depthDistanceReactiveIntensity = clampNumber(value, -1, 1);
			}
			if (key === "depthEchoPhase") {
				state.depthEchoPhase = clampNumber(value, 0, Math.max(0.1, state.depthEchoWavelength));
			}
			if (key === "depthEchoWavelength") {
				state.depthEchoWavelength = quantizeDepthEchoWavelength(value);
				state.depthEchoPhase = clampNumber(state.depthEchoPhase, 0, state.depthEchoWavelength);
				state.depthEchoPhaseOffset = wrapEchoPhase(state.depthEchoPhaseOffset, state.depthEchoWavelength);
			}
			if (key === "depthEchoDutyCycle") {
				state.depthEchoDutyCycle = clampNumber(value, 0, 1);
			}
			if (key === "depthEchoFade") {
				state.depthEchoFade = clampNumber(value, 0, 1);
			}
			if (key === "depthEchoPhaseSpeed") {
				state.depthEchoPhaseSpeed = quantizeDepthEchoPhaseSpeed(value);
			}
			if (key === "depthEchoReactiveIntensity") {
				state.depthEchoReactiveIntensity = clampNumber(value, -1, 1);
			}
			if (key === "depthMrRetain") {
				state.depthMrRetain = clampNumber(value, 0, 1);
				if (state.depthModeKey === "echo") {
					state.depthEchoMrRetain = state.depthMrRetain;
				} else {
					state.depthDistanceMrRetain = state.depthMrRetain;
				}
			}
		},
		toggleDepthDistanceReactive: function() {
			state.depthDistanceReactiveBool = !state.depthDistanceReactiveBool;
		},
		toggleDepthEchoReactive: function(key) {
			if (key === "depthEchoPhaseReactive") {
				state.depthEchoPhaseReactiveBool = !state.depthEchoPhaseReactiveBool;
			}
			if (key === "depthEchoPhaseSpeedReactive") {
				state.depthEchoPhaseSpeedReactiveBool = !state.depthEchoPhaseSpeedReactiveBool;
			}
			if (key === "depthEchoWavelengthReactive") {
				state.depthEchoWavelengthReactiveBool = !state.depthEchoWavelengthReactiveBool;
			}
			if (key === "depthEchoDutyCycleReactive") {
				state.depthEchoDutyCycleReactiveBool = !state.depthEchoDutyCycleReactiveBool;
			}
			if (key === "depthEchoFadeReactive") {
				state.depthEchoFadeReactiveBool = !state.depthEchoFadeReactiveBool;
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
			if (state.depthActiveBool && state.depthVisualMaskingEnabledBool) {
				depth = buildDepthRenderState(args);
				worldMask = buildDepthRenderState(args);
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
			const lightLayerAdditiveScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY ? 0 : clampNumber(state.effectAdditiveShare, 0, 1);
			const lightLayerAlphaBlendScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY ? 0 : clampNumber(state.effectAlphaBlendShare, 0, 1);
			return {
				visibleShare: visibleShare,
				maskCount: 0,
				masks: [],
				depth: state.depthActiveBool && state.depthVisualMaskingEnabledBool ? buildDepthRenderState(args) : null,
				depthProjectionParams: buildDepthProjectionParams(args.depthProjMatrix || args.projMatrix),
				viewWorldMatrix: args.viewMatrix ? buildWorldFromViewMatrix(args.viewMatrix) : identityMatrix(),
				darkAlpha: 1 - darkness,
				additiveColor: lightingColor,
				additiveStrength: additiveStrength,
				lightingModeKey: state.lightingModeKey,
				effectSemanticModeKey: state.effectSemanticModeKey,
				lightLayerAdditiveScale: lightLayerAdditiveScale,
				lightLayerAlphaBlendScale: lightLayerAlphaBlendScale,
				lightLayers: buildProjectedLightLayers(args, state)
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
		"precision highp float;",
		"uniform sampler2D depthTexture;",
		"uniform float depthMode;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthEchoWavelength;",
		"uniform float depthEchoDutyCycle;",
		"uniform float depthEchoFade;",
		"uniform float depthPhaseOffset;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform float depthMetricMode;",
		"uniform vec2 depthMotionCompensation;",
		"uniform vec4 depthProjectionParams;",
		"uniform mat4 depthUvTransform;",
		"varying vec2 vScreenUv;",
		"float computeDepthMask(float depthMeters){",
		"if(depthMode<0.5){return depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);}",
		"float wavelength=max(depthEchoWavelength,0.0001);",
		"float dutyCycle=clamp(depthEchoDutyCycle,0.0,1.0);",
		"float visibleWidth=wavelength*dutyCycle;",
		"if(visibleWidth<=0.0001){return 0.0;}",
		"if(visibleWidth>=wavelength-0.0001){return 1.0;}",
		"float halfPeriod=wavelength*0.5;",
		"float centeredPhase=mod(depthMeters-depthPhaseOffset+halfPeriod,wavelength)-halfPeriod;",
		"float distanceFromBandCenter=abs(centeredPhase);",
		"float hiddenWidth=wavelength-visibleWidth;",
		"float visibleHalfWidth=visibleWidth*0.5;",
		"float fadeHalfWidth=0.5*min(visibleWidth,hiddenWidth)*clamp(depthEchoFade,0.0,1.0);",
		"if(fadeHalfWidth<=0.0001){return step(distanceFromBandCenter,visibleHalfWidth);}",
		"float innerEdge=max(0.0,visibleHalfWidth-fadeHalfWidth);",
		"float outerEdge=visibleHalfWidth+fadeHalfWidth;",
		"return 1.0-smoothstep(innerEdge,outerEdge,distanceFromBandCenter);",
		"}",
		"float resolveDepthMetric(float depthMeters){",
		"if(depthMetricMode<0.5){return depthMeters;}",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 ndc=compensatedScreenUv*2.0-1.0;",
		"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
		"return depthMeters*sqrt(1.0+dot(viewRay,viewRay));",
		"}",
		"void main(){",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 depthUv=(depthUvTransform*vec4(compensatedScreenUv,0.0,1.0)).xy;",
		"float rawDepth=texture2D(depthTexture,depthUv).r;",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float valid=step(0.001,rawDepth);",
		"float mask=computeDepthMask(resolveDepthMetric(depthMeters));",
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
		"precision highp float;",
		"precision mediump sampler2DArray;",
		"uniform sampler2DArray depthTexture;",
		"uniform int depthTextureLayer;",
		"uniform float depthMode;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthEchoWavelength;",
		"uniform float depthEchoDutyCycle;",
		"uniform float depthEchoFade;",
		"uniform float depthPhaseOffset;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform float depthMetricMode;",
		"uniform vec2 depthMotionCompensation;",
		"uniform vec4 depthProjectionParams;",
		"uniform mat4 depthUvTransform;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"float computeDepthMask(float depthMeters){",
		"if(depthMode<0.5){return depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);}",
		"float wavelength=max(depthEchoWavelength,0.0001);",
		"float dutyCycle=clamp(depthEchoDutyCycle,0.0,1.0);",
		"float visibleWidth=wavelength*dutyCycle;",
		"if(visibleWidth<=0.0001){return 0.0;}",
		"if(visibleWidth>=wavelength-0.0001){return 1.0;}",
		"float halfPeriod=wavelength*0.5;",
		"float centeredPhase=mod(depthMeters-depthPhaseOffset+halfPeriod,wavelength)-halfPeriod;",
		"float distanceFromBandCenter=abs(centeredPhase);",
		"float hiddenWidth=wavelength-visibleWidth;",
		"float visibleHalfWidth=visibleWidth*0.5;",
		"float fadeHalfWidth=0.5*min(visibleWidth,hiddenWidth)*clamp(depthEchoFade,0.0,1.0);",
		"if(fadeHalfWidth<=0.0001){return step(distanceFromBandCenter,visibleHalfWidth);}",
		"float innerEdge=max(0.0,visibleHalfWidth-fadeHalfWidth);",
		"float outerEdge=visibleHalfWidth+fadeHalfWidth;",
		"return 1.0-smoothstep(innerEdge,outerEdge,distanceFromBandCenter);",
		"}",
		"float resolveDepthMetric(float depthMeters){",
		"if(depthMetricMode<0.5){return depthMeters;}",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 ndc=compensatedScreenUv*2.0-1.0;",
		"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
		"return depthMeters*sqrt(1.0+dot(viewRay,viewRay));",
		"}",
		"void main(){",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 depthUv=(depthUvTransform*vec4(compensatedScreenUv,0.0,1.0)).xy;",
		"float rawDepth=texture(depthTexture,vec3(depthUv,float(depthTextureLayer))).r;",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float valid=step(0.001,rawDepth);",
		"float mask=computeDepthMask(resolveDepthMetric(depthMeters));",
		"float punchMask=mix(1.0,mask,valid);",
		"fragColor=vec4(0.0,0.0,0.0,mix(depthMrRetain,1.0,punchMask));",
		"}"
	].join("");

	const flashlightFragSource = [
		"precision highp float;",
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
			depthMode: gl.getUniformLocation(prog, "depthMode"),
			depthThreshold: gl.getUniformLocation(prog, "depthThreshold"),
			depthFade: gl.getUniformLocation(prog, "depthFade"),
			depthEchoWavelength: gl.getUniformLocation(prog, "depthEchoWavelength"),
			depthEchoDutyCycle: gl.getUniformLocation(prog, "depthEchoDutyCycle"),
			depthEchoFade: gl.getUniformLocation(prog, "depthEchoFade"),
			depthPhaseOffset: gl.getUniformLocation(prog, "depthPhaseOffset"),
			depthMrRetain: gl.getUniformLocation(prog, "depthMrRetain"),
			rawValueToMeters: gl.getUniformLocation(prog, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(prog, "depthNearZ"),
			depthMetricMode: gl.getUniformLocation(prog, "depthMetricMode"),
			depthMotionCompensation: gl.getUniformLocation(prog, "depthMotionCompensation"),
			depthProjectionParams: gl.getUniformLocation(prog, "depthProjectionParams"),
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
		gl.uniform1f(locs.depthMode, punchState.depthMode == null ? 0 : punchState.depthMode);
		gl.uniform1f(locs.depthThreshold, punchState.depthThreshold);
		gl.uniform1f(locs.depthFade, punchState.depthFade);
		gl.uniform1f(locs.depthEchoWavelength, punchState.depthEchoWavelength == null ? 1 : punchState.depthEchoWavelength);
		gl.uniform1f(locs.depthEchoDutyCycle, punchState.depthEchoDutyCycle == null ? 0.5 : punchState.depthEchoDutyCycle);
		gl.uniform1f(locs.depthEchoFade, punchState.depthEchoFade == null ? 0 : punchState.depthEchoFade);
		gl.uniform1f(locs.depthPhaseOffset, punchState.depthPhaseOffset == null ? 0 : punchState.depthPhaseOffset);
		gl.uniform1f(locs.depthMrRetain, punchState.depthMrRetain || 0);
		gl.uniform1f(locs.rawValueToMeters, profile.linearScale);
		gl.uniform1f(locs.depthNearZ, profile.nearZ);
		gl.uniform1f(locs.depthMetricMode, punchState.depthRadialBool ? 1 : 0);
		gl.uniform2f(
			locs.depthMotionCompensation,
			punchState.depthMotionCompensation ? punchState.depthMotionCompensation.x : 0,
			punchState.depthMotionCompensation ? punchState.depthMotionCompensation.y : 0
		);
		gl.uniform4f(
			locs.depthProjectionParams,
			punchState.depthProjectionParams ? punchState.depthProjectionParams.xScale : 1,
			punchState.depthProjectionParams ? punchState.depthProjectionParams.yScale : 1,
			punchState.depthProjectionParams ? punchState.depthProjectionParams.xOffset : 0,
			punchState.depthProjectionParams ? punchState.depthProjectionParams.yOffset : 0
		);
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
