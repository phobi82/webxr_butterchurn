// runtime/menu-fallback.js
const createNullMenuController = function(options) {
	options = options || {};
	const state = {
		jumpMode: options.jumpMode || "double",
		menuConsumesRightTriggerBool: false,
		floorAlpha: options.floorAlpha == null ? 0.72 : options.floorAlpha,
		eyeDistanceMeters: options.eyeDistanceMeters == null ? 0.064 : options.eyeDistanceMeters,
		desktopPreviewVisibleBool: !!options.desktopPreviewVisibleBool,
		menuOpenBool: false,
		plane: {
			center: {x: 0, y: 0, z: 0},
			right: {x: 1, y: 0, z: 0},
			up: {x: 0, y: 1, z: 0},
			normal: {x: 0, y: 0, z: 1}
		},
		planeWidth: 0.74,
		planeHeight: 0.55
	};
	return {
		getState: function() {
			return state;
		},
		getControllerRays: function() {
			return [];
		},
		setPassthroughState: function() {},
		clearDesktopPointerState: function() {},
		registerDesktopPreviewEvents: function() {},
		updateDesktopPreview: function() {},
		updateXrInput: function() {},
		handleDesktopPointerUp: function() {},
		setDesktopPreviewVisibleBool: function(visibleBool) {
			state.desktopPreviewVisibleBool = !!visibleBool;
		},
		resetSessionState: function() {
			state.menuOpenBool = false;
		},
		endSession: function() {
			state.menuOpenBool = false;
		},
		renderTexture: function() {}
	};
};

// runtime/core.js
const createRuntime = function(options) {
	const windowRef = options.windowRef || window;
	const documentRef = options.documentRef || document;
	const shell = normalizeAppShell(options.shell, {documentRef: documentRef});
	const sessionBridge = options.sessionBridge;
	const audioController = options.audioController;
	const locomotion = options.locomotion;
	const menuController = options.menuController || createNullMenuController(options.menuDefaults);
	const passthroughController = options.passthroughController;
	const sceneRenderer = options.sceneRenderer;
	const sceneLighting = options.sceneLighting;
	const createGlbAssetStore = options.createGlbAssetStore;
	const createVisualizerSourceBackend = options.createVisualizerSourceBackend;
	const createVisualizerEngine = options.createVisualizerEngine;
	const getFloorColors = options.getReactiveFloorColors || null;
	const sceneGlbAssets = options.sceneGlbAssets || [];
	const inputConfig = options.inputConfig || {};
	const renderPolicy = Object.assign({
		visualizerBackgroundEnabledBool: true
	}, options.renderPolicy || {});
	const tabSources = options.tabSources || {};
	const runtimeEventRegistry = createEventListenerRegistry();
	const xrMovementState = locomotion.createXrState();
	const desktopMovementState = locomotion.createDesktopState();
	const computeDepthProfile = function(depthFrameKind, depthDataFormat, rawValueToMeters) {
		if (depthFrameKind === "cpu") {
			return {linearScale: rawValueToMeters || 0.001, nearZ: 0, label: "cpu-linear"};
		}
		if (rawValueToMeters >= 1) {
			return {linearScale: 0, nearZ: 0.1, label: "gpu-hyperbolic"};
		}
		if (depthDataFormat === "unsigned-short") {
			return {linearScale: (rawValueToMeters || 0.001) * 65535, nearZ: 0, label: "gpu-linear-u16"};
		}
		return {linearScale: rawValueToMeters || 0.001, nearZ: 0, label: "gpu-linear"};
	};
	const state = {
		gl: null,
		xrSession: null,
		xrSessionMode: "",
		xrEnvironmentBlendMode: "opaque",
		xrDepthUsage: "",
		xrDepthDataFormat: "",
		depthSensingActiveBool: false,
		glBinding: null,
		usableDepthAvailableBool: false,
		depthFrameKind: "",
		depthProfile: null,
		passthroughAvailableBool: false,
		xrSupportState: {immersiveArSupportedBool: false, immersiveVrSupportedBool: false, preferredSessionMode: ""},
		baseRefSpace: null,
		xrRefSpace: null,
		frameHandle: null,
		lastRenderTime: 0,
		previewLastRenderTime: 0,
		sceneTimeSeconds: 0,
		glbAssetStore: null,
		visualizerSourceBackend: null,
		visualizerEngine: null
	};
	const desktopInput = createDesktopInput({
		desktopMovementState: desktopMovementState,
		mouseSensitivity: inputConfig.desktopMouseSensitivity,
		clampNumber: clampNumber,
		isXrSessionActive: function() { return !!state.xrSession; },
		onPointerLockChange: function(lockedBool) {
			if (lockedBool) {
				menuController.clearDesktopPointerState();
			}
		}
	});
	const getAudioMetrics = function() {
		return state.visualizerSourceBackend && state.visualizerSourceBackend.getAudioMetrics ? state.visualizerSourceBackend.getAudioMetrics() : emptyAudioMetrics;
	};
	const getVisualizerSelectionState = function() {
		return state.visualizerEngine && state.visualizerEngine.getSelectionState ? state.visualizerEngine.getSelectionState() : null;
	};
	const getLightingSelectionState = function() {
		return sceneLighting && sceneLighting.getSelectionState ? sceneLighting.getSelectionState() : null;
	};
	const getEffectSemanticModeState = function() {
		return passthroughController && passthroughController.getEffectSemanticModeState ? passthroughController.getEffectSemanticModeState() : {key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT, label: "Current"};
	};
	const getAudioSourceState = function() {
		return audioController && audioController.getState ? audioController.getState() : {sourceKind: "none", sourceName: ""};
	};
	const updateSceneLighting = function(timeSeconds) {
		if (sceneLighting) {
			sceneLighting.update(timeSeconds, getAudioMetrics());
		}
	};
	const getAudioReactiveFloorColors = function() {
		const audioMetrics = getAudioMetrics();
		const menuState = menuController.getState();
		const audioLevel = clampNumber(audioMetrics.level || 0, 0, 1);
		const audioPeak = clampNumber(audioMetrics.peak || 0, 0, 1);
		const beatPulse = clampNumber(audioMetrics.beatPulse || 0, 0, 1);
		const transientLevel = clampNumber(audioMetrics.transient || 0, 0, 1);
		const baseHue = (state.sceneTimeSeconds * 0.03) % 1;
		const floorDrive = clampNumber(audioLevel * 0.72 + audioPeak * 0.28 + beatPulse * 0.4, 0, 1);
		const floorRgb = hslToRgb((baseHue + beatPulse * 0.03) % 1, lerpNumber(0.45, 0.98, floorDrive), lerpNumber(0.26, 0.66, floorDrive));
		const gridRgb = hslToRgb((baseHue + 0.08 + beatPulse * 0.05) % 1, lerpNumber(0.55, 1, floorDrive), lerpNumber(0.48, 0.82, clampNumber(floorDrive + transientLevel, 0, 1)));
		return {
			audioLevel: audioLevel,
			audioPeak: audioPeak,
			beatPulse: beatPulse,
			transient: transientLevel,
			floor: [floorRgb[0], floorRgb[1], floorRgb[2], menuState.floorAlpha],
			grid: [gridRgb[0], gridRgb[1], gridRgb[2], clampNumber(lerpNumber(menuState.floorAlpha * 0.72, menuState.floorAlpha, clampNumber(audioLevel * 0.85 + beatPulse * 0.35, 0, 1)), 0, 1)]
		};
	};
	const resolveFloorColors = function() {
		return getFloorColors ? getFloorColors({
			audioMetrics: getAudioMetrics(),
			menuState: menuController.getState(),
			sceneTimeSeconds: state.sceneTimeSeconds
		}) : getAudioReactiveFloorColors();
	};
	const getPassthroughDepthInfoByView = function(frame, pose) {
		if (!state.depthSensingActiveBool || !frame || !pose || !pose.views) {
			return [];
		}
		const useGlBinding = state.glBinding && typeof state.glBinding.getDepthInformation === "function";
		if (!useGlBinding && typeof frame.getDepthInformation !== "function") {
			return [];
		}
		const depthInfoByView = [];
		for (let i = 0; i < pose.views.length; i += 1) {
			let depthInfo = null;
			try {
				depthInfo = (useGlBinding ? state.glBinding.getDepthInformation(pose.views[i]) : frame.getDepthInformation(pose.views[i])) || null;
			} catch (error) {
				depthInfo = null;
			}
			depthInfoByView.push(depthInfo);
		}
		return depthInfoByView;
	};
	const updateReferenceSpace = function(viewerTransform) {
		state.xrRefSpace = sessionBridge.createOffsetReferenceSpace(state.baseRefSpace, xrMovementState, viewerTransform);
	};
	const updatePassthroughUiState = function() {
		menuController.setPassthroughState({
			supportedBool: !!state.xrSupportState.immersiveArSupportedBool,
			availableBool: !!state.passthroughAvailableBool,
			sessionMode: state.xrSessionMode,
			environmentBlendMode: state.xrEnvironmentBlendMode
		});
	};
	const cycleLightingPreset = function(direction) {
		if (!sceneLighting || !sceneLighting.selectPreset) {
			return Promise.resolve();
		}
		const selectionState = getLightingSelectionState();
		const count = selectionState ? selectionState.presetNames.length : 0;
		if (!count) {
			return Promise.resolve();
		}
		return sceneLighting.selectPreset((selectionState.currentPresetIndex + direction + count) % count);
	};
	const cycleLightingEffect = function(direction) {
		if (!sceneLighting || !sceneLighting.cycleEffect) {
			return Promise.resolve();
		}
		return sceneLighting.cycleEffect(direction < 0 ? -1 : 1);
	};
	const cycleLightingVariant = function(direction) {
		if (!sceneLighting || !sceneLighting.cycleVariant) {
			return Promise.resolve();
		}
		return sceneLighting.cycleVariant(direction < 0 ? -1 : 1);
	};
	// Action registry built once; handlers close over runtime state so they stay current.
	const menuActionHandlers = {
		"session.exit": function() {
			if (state.xrSession) {
				state.xrSession.end();
			}
		},
		"jumpMode.set": function(action) {
			if (action && menuController && menuController.setJumpMode) {
				menuController.setJumpMode(action.mode);
			}
		},
		"backgroundMixMode.select": function(action) {
			if (action && passthroughController && passthroughController.selectMixMode) {
				passthroughController.selectMixMode(action.key);
			}
		},
		"passthroughFlashlight.toggle": function() {
			if (passthroughController && passthroughController.toggleFlashlight) {
				passthroughController.toggleFlashlight();
			}
		},
		"passthroughDepth.toggle": function() {
			if (passthroughController && passthroughController.toggleDepth) {
				passthroughController.toggleDepth();
			}
		},
		"passthroughDepthRadial.toggle": function() {
			if (passthroughController && passthroughController.toggleDepthRadial) {
				passthroughController.toggleDepthRadial();
			}
		},
		"passthroughDepthMotionCompensation.toggle": function() {
			if (passthroughController && passthroughController.toggleDepthMotionCompensation) {
				passthroughController.toggleDepthMotionCompensation();
			}
		},
		"passthroughDepthReconstruction.cycle": function(action) {
			if (action && passthroughController && passthroughController.cycleDepthReconstructionMode) {
				passthroughController.cycleDepthReconstructionMode(action.direction);
			}
		},
		"passthroughDepthMode.cycle": function(action) {
			if (action && passthroughController && passthroughController.cycleDepthMode) {
				passthroughController.cycleDepthMode(action.direction);
			}
		},
		"depthEchoReactive.toggle": function(action) {
			if (action && passthroughController && passthroughController.toggleDepthEchoReactive) {
				passthroughController.toggleDepthEchoReactive(action.key);
			}
		},
		"depthDistanceReactive.toggle": function() {
			if (passthroughController && passthroughController.toggleDepthDistanceReactive) {
				passthroughController.toggleDepthDistanceReactive();
			}
		},
		"sceneLightingMode.cycle": function(action) {
			if (action && passthroughController && passthroughController.cycleLightingMode) {
				passthroughController.cycleLightingMode(action.direction);
			}
		},
		"sceneLightPreset.cycle": function(action) {
			if (action) {
				cycleLightingEffect(action.direction);
			}
		},
		"visualizerMode.cycle": function(action) {
			if (!action || !state.visualizerEngine) {
				return Promise.resolve();
			}
			const selectionState = getVisualizerSelectionState();
			const count = selectionState ? selectionState.modeNames.length : 0;
			if (!count) {
				return Promise.resolve();
			}
			return state.visualizerEngine.selectMode(selectionState.currentModeIndex + (action.direction < 0 ? -1 : 1));
		},
		"visualizerHorizontalMirror.toggle": function() {
			if (!state.visualizerEngine || !state.visualizerEngine.toggleHorizontalMirror) {
				return Promise.resolve();
			}
			return state.visualizerEngine.toggleHorizontalMirror();
		},
		"butterchurnPreset.cycle": function(action) {
			if (!action || !state.visualizerEngine) {
				return Promise.resolve();
			}
			const selectionState = getVisualizerSelectionState();
			const count = selectionState ? selectionState.presetNames.length : 0;
			if (!count) {
				return Promise.resolve();
			}
			return state.visualizerEngine.selectPreset((selectionState.currentPresetIndex + (action.direction < 0 ? -1 : 1) + count) % count);
		}
	};
	const dispatchMenuAction = function(action) {
		if (!action || !action.type) {
			return;
		}
		const actionHandler = menuActionHandlers[action.type];
		if (!actionHandler) {
			console.warn("[MenuAction] unknown type:", action.type);
			return;
		}
		return actionHandler(action);
	};
	const xrMenuActionCallbacks = {
		dispatchMenuAction: dispatchMenuAction
	};
	const desktopMenuActionCallbacks = {
		dispatchMenuAction: function(action) {
			if (action && action.type === "butterchurnPreset.cycle") {
				audioController.activate();
			}
			dispatchMenuAction(action);
		}
	};
	const pickAxes = function(gamepad, preferSecondaryBool) {
		const primaryX = gamepad.axes[0] || 0;
		const primaryY = gamepad.axes[1] || 0;
		const secondaryX = gamepad.axes[2] || 0;
		const secondaryY = gamepad.axes[3] || 0;
		if (gamepad.axes.length < 4) {
			return {x: primaryX, y: primaryY};
		}
		const primaryStrength = Math.abs(primaryX) + Math.abs(primaryY);
		const secondaryStrength = Math.abs(secondaryX) + Math.abs(secondaryY);
		if (preferSecondaryBool) {
			return secondaryStrength > 0.01 ? {x: secondaryX, y: secondaryY} : {x: primaryX, y: primaryY};
		}
		return primaryStrength > 0.01 ? {x: primaryX, y: primaryY} : {x: secondaryX, y: secondaryY};
	};
	const readLocomotionInput = function(frame) {
		const locomotionInput = {moveX: 0, moveY: 0, turnX: 0, stanceInputY: 0, jumpRequestBool: false, airBoostActiveBool: false, rightControllerBoostDir: null, sprintActiveBool: false};
		const sources = state.xrSession ? state.xrSession.inputSources || [] : [];
		for (let i = 0; i < sources.length; i += 1) {
			const source = sources[i];
			const gamepad = source.gamepad;
			if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) {
				continue;
			}
			if (source.handedness === "left") {
				const moveAxes = pickAxes(gamepad, false);
				locomotionInput.moveX = Math.abs(moveAxes.x) > inputConfig.stickDeadzone ? moveAxes.x : 0;
				locomotionInput.moveY = Math.abs(moveAxes.y) > inputConfig.stickDeadzone ? moveAxes.y : 0;
				locomotionInput.sprintActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
			}
			if (source.handedness === "right") {
				const turnAxes = pickAxes(gamepad, true);
				locomotionInput.turnX = Math.abs(turnAxes.x) > inputConfig.stickDeadzone ? turnAxes.x : 0;
				locomotionInput.stanceInputY = Math.abs(turnAxes.y) > inputConfig.stanceStickDeadzone && Math.abs(turnAxes.y) > Math.abs(turnAxes.x) + inputConfig.stanceVerticalDominanceMargin ? -turnAxes.y : 0;
				locomotionInput.jumpRequestBool = !!(gamepad.buttons[4] && gamepad.buttons[4].pressed);
				locomotionInput.airBoostActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
				const targetRayPose = state.xrRefSpace ? frame.getPose(source.targetRaySpace, state.xrRefSpace) : null;
				if (targetRayPose) {
					locomotionInput.rightControllerBoostDir = extractForwardDirectionFromQuaternion(targetRayPose.transform.orientation);
				}
			}
		}
		return locomotionInput;
	};
	const defaultVisualizerSelectionState = {modeNames: ["Toroidal"], currentModeIndex: 0, horizontalMirrorBool: false, presetNames: ["Preset 1"], currentPresetIndex: 0};
	const defaultLightingSelectionState = {presetNames: ["Aurora Drift"], currentPresetIndex: 0, currentPresetName: "Aurora Drift", currentPresetDescription: "Slow colorful overhead drift", currentPresetEffectName: "Aurora Drift", currentPresetEffectDescription: "Slow colorful overhead drift", currentPresetEffectIndex: 0, currentPresetEffectCount: 1, currentPresetVariantKey: "", currentPresetVariantIndex: 0, currentPresetVariantCount: 1, currentPresetVariantLabel: "", currentPresetSurfaceKey: ""};
	const getMenuContentState = function() {
		const vs = getVisualizerSelectionState() || defaultVisualizerSelectionState;
		const ls = getLightingSelectionState() || defaultLightingSelectionState;
		const audioSourceState = getAudioSourceState();
		const effectSemanticModeState = getEffectSemanticModeState();
		return {
			sceneTimeSeconds: state.sceneTimeSeconds,
			audioMetrics: getAudioMetrics(),
			audioSourceKind: audioSourceState.sourceKind || "none",
			audioSourceName: audioSourceState.sourceName || "",
			shaderModeNames: vs.modeNames,
			currentShaderModeIndex: vs.currentModeIndex,
			horizontalMirrorBool: !!vs.horizontalMirrorBool,
			lightPresetNames: ls.presetNames,
			currentLightPresetIndex: ls.currentPresetIndex,
			currentLightPresetName: ls.currentPresetName,
			currentLightPresetDescription: ls.currentPresetDescription,
			currentLightPresetEffectName: ls.currentPresetEffectName,
			currentLightPresetEffectDescription: ls.currentPresetEffectDescription,
			currentLightPresetEffectIndex: ls.currentPresetEffectIndex,
			currentLightPresetEffectCount: ls.currentPresetEffectCount,
			currentLightPresetVariantKey: ls.currentPresetVariantKey,
			currentLightPresetVariantIndex: ls.currentPresetVariantIndex,
			currentLightPresetVariantCount: ls.currentPresetVariantCount,
			currentLightPresetVariantLabel: ls.currentPresetVariantLabel,
			currentLightPresetSurfaceKey: ls.currentPresetSurfaceKey,
			effectSemanticModeKey: effectSemanticModeState.key,
			effectSemanticModeLabel: effectSemanticModeState.label,
			presetNames: vs.presetNames,
			currentPresetIndex: vs.currentPresetIndex,
			xrSessionActiveBool: !!state.xrSession
		};
	};
	const getDesktopMenuInteractionState = function() {
		return {xrSessionActiveBool: !!state.xrSession, pointerLockedBool: desktopInput.isPointerLocked()};
	};
	const updateDesktopMenuPreview = function(xrSessionActiveOverrideBool) {
		const interactionState = getDesktopMenuInteractionState();
		const xrSessionActiveBool = xrSessionActiveOverrideBool == null ? interactionState.xrSessionActiveBool : xrSessionActiveOverrideBool;
		menuController.updateDesktopPreview({xrSessionActiveBool: xrSessionActiveBool, pointerLockedBool: interactionState.pointerLockedBool, interactiveBool: !interactionState.pointerLockedBool && !xrSessionActiveBool, renderState: getMenuContentState()});
	};
	const applyLocomotion = function(delta, pose, frame) {
		if (!state.xrSession || !pose || !frame) {
			return;
		}
		const basePose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : null;
		const rawViewerTransform = basePose ? basePose.transform : pose.transform;
		const renderSpaceInitializedBool = state.xrRefSpace !== state.baseRefSpace;
		const menuState = menuController.getState();
		const locomotionStep = locomotion.applyXrLocomotion(xrMovementState, {delta: delta, renderedTransform: pose.transform, viewerTransform: rawViewerTransform, renderSpaceInitializedBool: renderSpaceInitializedBool, locomotion: readLocomotionInput(frame), jumpMode: menuState.jumpMode, menuConsumesRightTriggerBool: menuState.menuConsumesRightTriggerBool});
		if (locomotionStep.referenceSpaceUpdateNeededBool) {
			updateReferenceSpace(rawViewerTransform);
		}
	};
	let frameBudgetOverCount = 0;
	let frameBudgetFrameCount = 0;
	const renderXr = function(time, frame) {
		state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
		const frameStartMs = performance.now();
		const pose = frame.getViewerPose(state.xrRefSpace);
		if (!pose) {
			return;
		}
		const delta = state.lastRenderTime === 0 ? 0 : (time - state.lastRenderTime) / 1000;
		state.lastRenderTime = time;
		state.sceneTimeSeconds = time * 0.001;
		menuController.updateXrInput({xrSession: state.xrSession, xrRefSpace: state.xrRefSpace, frame: frame, pose: pose, callbacks: xrMenuActionCallbacks});
		applyLocomotion(delta, pose, frame);
		const renderPose = frame.getViewerPose(state.xrRefSpace) || pose;
		const passthroughPose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : renderPose;
		if (state.depthSensingActiveBool && state.xrSession && state.xrSession.depthActive === false) {
			try { state.xrSession.resumeDepthSensing(); } catch (e) { console.warn("[Depth] resumeDepthSensing failed:", e.message || e); }
		}
		const passthroughDepthInfoByView = getPassthroughDepthInfoByView(frame, passthroughPose || renderPose);
		if (!state.usableDepthAvailableBool && passthroughDepthInfoByView.length) {
			for (let i = 0; i < passthroughDepthInfoByView.length; i += 1) {
				const di = passthroughDepthInfoByView[i];
				if (!di || di.isValid === false) { continue; }
				if (typeof di.getDepthInMeters === "function") {
					state.depthFrameKind = "cpu";
				} else if (di.texture && di.textureType === "texture-array") {
					state.depthFrameKind = "gpu-array";
				} else if (di.texture) {
					state.depthFrameKind = "gpu-texture";
				}
				if (state.depthFrameKind) {
					state.usableDepthAvailableBool = true;
					state.depthProfile = computeDepthProfile(state.depthFrameKind, state.xrDepthDataFormat, di.rawValueToMeters);
					console.log("[DepthProfile] " + state.depthProfile.label + " linearScale=" + state.depthProfile.linearScale + " nearZ=" + state.depthProfile.nearZ);
					break;
				}
			}
		}
		if (passthroughController && passthroughController.setDepthAvailability) {
			passthroughController.setDepthAvailability(state.usableDepthAvailableBool);
		}
		if (passthroughController && passthroughController.updateFrame) {
			passthroughController.updateFrame({delta: delta, audioMetrics: getAudioMetrics(), passthroughPose: passthroughPose || renderPose});
		}
		if (state.visualizerEngine) {
			if (renderPose.transform && renderPose.views.length) {
				state.visualizerEngine.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
				state.visualizerEngine.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
			}
			state.visualizerEngine.update(time * 0.001);
		}
		updateSceneLighting(time * 0.001);
		sceneRenderer.renderXrViews({baseLayer: state.xrSession.renderState.baseLayer, depthFrameKind: state.depthFrameKind || "", depthProfile: state.depthProfile, pose: renderPose, passthroughPose: passthroughPose || renderPose, passthroughDepthInfoByView: passthroughDepthInfoByView, eyeDistanceMeters: menuController.getState().eyeDistanceMeters, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, passthroughController: passthroughController, menuContentState: getMenuContentState(), getReactiveFloorColors: resolveFloorColors, transparentBackgroundBool: state.passthroughAvailableBool, passthroughFallbackBool: !state.passthroughAvailableBool, visualizerBackgroundEnabledBool: !!renderPolicy.visualizerBackgroundEnabledBool});
		const frameElapsedMs = performance.now() - frameStartMs;
		frameBudgetFrameCount += 1;
		if (frameElapsedMs > 13.9) { frameBudgetOverCount += 1; }
		if (frameBudgetFrameCount >= 300) {
			if (frameBudgetOverCount > 15) { console.warn("Frame budget: " + frameBudgetOverCount + "/300 over 13.9ms"); }
			frameBudgetOverCount = 0;
			frameBudgetFrameCount = 0;
		}
	};
	const renderPreview = function(time) {
		if (state.xrSession) {
			return;
		}
		const previewTimeSeconds = time * 0.001;
		const delta = state.previewLastRenderTime === 0 ? 0 : Math.min(0.05, Math.max(0, previewTimeSeconds - state.previewLastRenderTime));
		state.previewLastRenderTime = previewTimeSeconds;
		state.sceneTimeSeconds = previewTimeSeconds;
		locomotion.applyDesktopPreviewMovement(desktopMovementState, delta, menuController.getState().jumpMode);
		updateSceneLighting(previewTimeSeconds);
		if (passthroughController && passthroughController.updateFrame) {
			passthroughController.updateFrame({delta: delta, audioMetrics: getAudioMetrics()});
		}
		sceneRenderer.renderPreviewFrame({previewTimeSeconds: previewTimeSeconds, desktopMovementState: desktopMovementState, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, passthroughController: passthroughController, menuContentState: getMenuContentState(), getReactiveFloorColors: resolveFloorColors, passthroughFallbackBool: true, visualizerBackgroundEnabledBool: !!renderPolicy.visualizerBackgroundEnabledBool});
		updateDesktopMenuPreview();
		windowRef.requestAnimationFrame(renderPreview);
	};
	const endSession = function() {
		if (state.frameHandle !== null && state.xrSession) {
			state.xrSession.cancelAnimationFrame(state.frameHandle);
		}
		state.frameHandle = null;
		state.xrSession = null;
		state.xrSessionMode = "";
		state.xrEnvironmentBlendMode = "opaque";
		state.xrDepthUsage = "";
		state.xrDepthDataFormat = "";
		state.depthSensingActiveBool = false;
		state.glBinding = null;
		state.usableDepthAvailableBool = false;
		state.depthFrameKind = "";
		state.depthProfile = null;
		state.passthroughAvailableBool = false;
		state.baseRefSpace = null;
		state.xrRefSpace = null;
		state.lastRenderTime = 0;
		state.previewLastRenderTime = 0;
		menuController.endSession();
		updatePassthroughUiState();
		shell.setXrState({statusText: state.xrSupportState.preferredSessionMode ? "ready" : "headset not detected.", enterEnabledBool: !!state.xrSupportState.preferredSessionMode, exitEnabledBool: false});
		if (state.visualizerEngine) {
			applyVisualizerBackgroundComposite(state.visualizerEngine, {alpha: 1, maskCount: 0, masks: []});
			state.visualizerEngine.endSession();
		}
		xrMovementState.horizontalVelocityX = 0;
		xrMovementState.horizontalVelocityZ = 0;
		updateDesktopMenuPreview();
		windowRef.requestAnimationFrame(renderPreview);
	};
	const SESSION_TIMEOUT_MS = 15000;
	const startSession = async function() {
		try {
			if (shell.isCanvasPointerLocked(documentRef) && documentRef.exitPointerLock) {
				documentRef.exitPointerLock();
			}
			updateDesktopMenuPreview(true);
			const timeoutPromise = new Promise(function(resolve, reject) {
				setTimeout(function() {
					reject(new Error("XR session request timed out after " + (SESSION_TIMEOUT_MS / 1000) + "s"));
				}, SESSION_TIMEOUT_MS);
			});
			const xrState = await Promise.race([sessionBridge.startSession(state.gl, endSession), timeoutPromise]);
			state.xrSession = xrState.session;
			state.xrSessionMode = xrState.sessionMode || "immersive-vr";
			state.xrEnvironmentBlendMode = xrState.environmentBlendMode || "opaque";
			state.xrDepthUsage = xrState.depthUsage || "";
			state.xrDepthDataFormat = xrState.depthDataFormat || "";
			state.depthSensingActiveBool = !!xrState.depthSensingActiveBool;
			state.glBinding = xrState.glBinding || null;
			state.passthroughAvailableBool = !!xrState.passthroughAvailableBool;
			state.baseRefSpace = xrState.baseRefSpace;
			locomotion.resetXrState(xrMovementState);
			menuController.resetSessionState();
			updatePassthroughUiState();
			state.xrRefSpace = state.baseRefSpace;
			shell.setXrState({statusText: state.xrSessionMode === "immersive-ar" ? "session running (AR)" : "session running (VR)", enterEnabledBool: false, exitEnabledBool: true});
			state.lastRenderTime = 0;
			if (state.visualizerEngine) {
				state.visualizerEngine.startSession();
			}
			state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
		} catch (error) {
			shell.setXrState({statusText: error.message || "session failed", enterEnabledBool: !!state.xrSupportState.preferredSessionMode, exitEnabledBool: false});
			state.xrSession = null;
			state.xrSessionMode = "";
			state.xrEnvironmentBlendMode = "opaque";
			state.xrDepthUsage = "";
			state.xrDepthDataFormat = "";
			state.depthSensingActiveBool = false;
			state.glBinding = null;
			state.usableDepthAvailableBool = false;
			state.depthFrameKind = "";
			state.passthroughAvailableBool = false;
			updatePassthroughUiState();
			updateDesktopMenuPreview();
		}
	};
	const runAudioAction = function(actionPromise, fallbackMessage) {
		actionPromise.catch(function(error) {
			shell.setStatus(error.message || fallbackMessage);
		});
	};
	const bindAsyncButton = function(button, action, fallbackMessage) {
		if (!button || !action) {
			return;
		}
		runtimeEventRegistry.on(button, "click", function() {
			runAudioAction(action(), fallbackMessage);
		});
	};
	const registerEventHandlers = function() {
		desktopInput.registerEventHandlers(documentRef, windowRef);
		menuController.registerDesktopPreviewEvents({callbacks: desktopMenuActionCallbacks, getInteractionState: getDesktopMenuInteractionState});
		if (shell.enterButton) {
			runtimeEventRegistry.on(shell.enterButton, "click", function() {
				if (sessionBridge.isAvailable() && state.gl && !state.xrSession) {
					audioController.activate();
					startSession();
				}
			});
		}
		bindAsyncButton(shell.audioButton, audioController.requestSharedAudio, "audio capture failed");
		bindAsyncButton(shell.youtubeAudioButton, function() {
			return audioController.requestTabAudio(tabSources.youtube);
		}, "youtube audio failed");
		bindAsyncButton(shell.youtubeHouseDiscoButton, function() {
			return audioController.requestTabAudio(tabSources.youtubeHouseDisco);
		}, "youtube house disco audio failed");
		bindAsyncButton(shell.sunoLiveRadioButton, function() {
			return audioController.requestTabAudio(tabSources.suno);
		}, "suno live radio audio failed");
		bindAsyncButton(shell.microphoneButton, audioController.requestMicrophoneAudio, "microphone capture failed");
		bindAsyncButton(shell.debugAudioButton, audioController.startDebugAudio, "debug audio failed");
		if (shell.stopAudioButton) {
			runtimeEventRegistry.on(shell.stopAudioButton, "click", function() {
				audioController.stop();
			});
		}
		if (shell.exitButton) {
			runtimeEventRegistry.on(shell.exitButton, "click", function() {
				if (state.xrSession) {
					state.xrSession.end();
				}
			});
		}
		runtimeEventRegistry.on(windowRef, "resize", function() {
			if (!state.xrSession) {
				shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
			}
		});
		runtimeEventRegistry.on(shell.canvas, "click", function() {
			if (!state.xrSession && !shell.isCanvasPointerLocked(documentRef)) {
				shell.requestCanvasPointerLock();
			}
		});
		runtimeEventRegistry.on(shell.canvas, "contextmenu", function(event) {
			if (!state.xrSession) {
				event.preventDefault();
			}
		});
		runtimeEventRegistry.on(documentRef, "pointerdown", function() {
			audioController.activate();
		}, {passive: true});
		runtimeEventRegistry.on(documentRef, "keydown", function() {
			audioController.activate();
		});
		runtimeEventRegistry.on(documentRef, "keydown", function(event) {
			if (state.xrSession) {
				return;
			}
			if (event.code === "KeyM" && !event.repeat) {
				menuController.setDesktopPreviewVisibleBool(!menuController.getState().desktopPreviewVisibleBool);
				event.preventDefault();
			}
		});
		runtimeEventRegistry.on(documentRef, "mouseup", function() {
			menuController.handleDesktopPointerUp();
		});
		runtimeEventRegistry.on(windowRef, "blur", function() {
			menuController.clearDesktopPointerState();
		});
	};
	return {
		start: async function() {
			registerEventHandlers();
			state.gl = sceneRenderer.init();
			if (!state.gl) {
				return;
			}
			locomotion.resetDesktopState(desktopMovementState);
			sceneLighting.update(0, emptyAudioMetrics);
			state.glbAssetStore = createGlbAssetStore ? createGlbAssetStore(state.gl) : null;
			if (state.glbAssetStore) {
				try {
					state.glbAssetStore.init();
					await state.glbAssetStore.loadAssets(sceneGlbAssets);
				} catch (error) {
					console.warn("[GLB] init/load error:", error);
					shell.setStatus(error.message || "glb init failed");
				}
			}
			state.visualizerSourceBackend = createVisualizerSourceBackend ? createVisualizerSourceBackend() : null;
			state.visualizerEngine = createVisualizerEngine ? createVisualizerEngine(state.gl) : null;
			if (state.visualizerEngine) {
				state.visualizerEngine.init({gl: state.gl, sourceBackend: state.visualizerSourceBackend || null});
			}
			if (state.visualizerEngine) {
				// Route audio control through the engine so activation and source updates use one stable adapter contract.
				audioController.setAudioBackend(state.visualizerEngine);
				audioController.activate().catch(function() {});
			}
			if (state.visualizerEngine) {
				applyVisualizerBackgroundComposite(state.visualizerEngine, {alpha: 1, maskCount: 0, masks: []});
			}
			if (!sessionBridge.isAvailable()) {
				updatePassthroughUiState();
				shell.setXrState({statusText: "WebXR not available.", enterEnabledBool: false, exitEnabledBool: false});
			} else {
				state.xrSupportState = await sessionBridge.getSupportState();
				updatePassthroughUiState();
				shell.setXrState({statusText: state.xrSupportState.preferredSessionMode ? "ready" : "headset not detected.", enterEnabledBool: !!state.xrSupportState.preferredSessionMode, exitEnabledBool: false});
			}
			shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
			windowRef.requestAnimationFrame(renderPreview);
		},
		cycleLightingEffect: cycleLightingEffect,
		cycleLightingVariant: cycleLightingVariant,
		cycleLightingPreset: cycleLightingPreset,
		selectLightingPreset: function(index) {
			if (!sceneLighting || !sceneLighting.selectPreset) {
				return Promise.resolve();
			}
			return sceneLighting.selectPreset(index);
		},
		selectEffectSemanticMode: function(key) {
			if (passthroughController && passthroughController.selectEffectSemanticMode) {
				passthroughController.selectEffectSemanticMode(key);
			}
			return Promise.resolve();
		},
		getEffectSemanticModeState: function() {
			return getEffectSemanticModeState();
		},
		getLightingSelectionState: function() {
			return getLightingSelectionState();
		},
		destroy: function() {
			runtimeEventRegistry.removeAll();
			if (desktopInput && desktopInput.destroy) {
				desktopInput.destroy();
			}
			if (menuController && menuController.destroy) {
				menuController.destroy();
			}
		}
	};
};
