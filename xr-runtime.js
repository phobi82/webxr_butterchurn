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
	const createVisualizerEngine = options.createVisualizerEngine;
	const sceneGlbAssets = options.sceneGlbAssets || [];
	const inputConfig = options.inputConfig || {};
	const tabSources = options.tabSources || {};
	const xrMovementState = locomotion.createXrState();
	const desktopMovementState = locomotion.createDesktopState();
	const state = {
		gl: null,
		xrSession: null,
		xrSessionMode: "",
		xrEnvironmentBlendMode: "opaque",
		passthroughAvailableBool: false,
		xrSupportState: {immersiveArSupportedBool: false, immersiveVrSupportedBool: false, preferredSessionMode: ""},
		baseRefSpace: null,
		xrRefSpace: null,
		frameHandle: null,
		lastRenderTime: 0,
		previewLastRenderTime: 0,
		sceneTimeSeconds: 0,
		glbAssetStore: null,
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
		return state.visualizerEngine && state.visualizerEngine.getAudioMetrics ? state.visualizerEngine.getAudioMetrics() : emptyAudioMetrics;
	};
	const getVisualizerSelectionState = function() {
		return state.visualizerEngine && state.visualizerEngine.getSelectionState ? state.visualizerEngine.getSelectionState() : null;
	};
	const getLightingSelectionState = function() {
		return sceneLighting && sceneLighting.getSelectionState ? sceneLighting.getSelectionState() : null;
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
	const cycleSelection = function(controller, getSelectionState, namesKey, indexKey, selectFn, direction) {
		if (!controller) {
			return;
		}
		const selectionState = getSelectionState();
		const count = selectionState ? selectionState[namesKey].length : 0;
		if (!count) {
			return;
		}
		selectFn.call(controller, (selectionState[indexKey] + direction + count) % count);
	};
	const cyclePreset = function(direction) {
		cycleSelection(state.visualizerEngine, getVisualizerSelectionState, "presetNames", "currentPresetIndex", function(i) { this.selectPreset(i); }, direction);
	};
	const cycleShaderMode = function(direction) {
		cycleSelection(state.visualizerEngine, getVisualizerSelectionState, "modeNames", "currentModeIndex", function(i) { this.selectMode(i); }, direction);
	};
	const cycleLightingPreset = function(direction) {
		cycleSelection(sceneLighting, getLightingSelectionState, "presetNames", "currentPresetIndex", function(i) { this.selectPreset(i); }, direction);
	};
	const xrMenuActionCallbacks = {
		onShaderModeAction: cycleShaderMode,
		onLightPresetAction: cycleLightingPreset,
		onPresetAction: cyclePreset,
		onExitVrAction: function() {
			if (state.xrSession) {
				state.xrSession.end();
			}
		}
	};
	const desktopMenuActionCallbacks = {
		onShaderModeAction: cycleShaderMode,
		onLightPresetAction: cycleLightingPreset,
		onPresetAction: function(direction) {
			audioController.activate();
			cyclePreset(direction);
		},
		onExitVrAction: function() {
			if (state.xrSession) {
				state.xrSession.end();
			}
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
	const getMenuContentState = function() {
		const visualizerSelectionState = getVisualizerSelectionState();
		const lightingSelectionState = getLightingSelectionState();
		return {
			sceneTimeSeconds: state.sceneTimeSeconds,
			audioMetrics: getAudioMetrics(),
			shaderModeNames: visualizerSelectionState ? visualizerSelectionState.modeNames : ["Toroidal"],
			currentShaderModeIndex: visualizerSelectionState ? visualizerSelectionState.currentModeIndex : 0,
			lightPresetNames: lightingSelectionState ? lightingSelectionState.presetNames : ["Aurora Drift"],
			currentLightPresetIndex: lightingSelectionState ? lightingSelectionState.currentPresetIndex : 0,
			currentLightPresetDescription: lightingSelectionState ? lightingSelectionState.currentPresetDescription : "Slow colorful overhead drift",
			presetNames: visualizerSelectionState ? visualizerSelectionState.presetNames : ["Preset 1"],
			currentPresetIndex: visualizerSelectionState ? visualizerSelectionState.currentPresetIndex : 0,
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
	const renderXr = function(time, frame) {
		state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
		const pose = frame.getViewerPose(state.xrRefSpace);
		if (!pose) {
			return;
		}
		const delta = state.lastRenderTime === 0 ? 0 : (time - state.lastRenderTime) / 1000;
		state.lastRenderTime = time;
		state.sceneTimeSeconds = time * 0.001;
		applyLocomotion(delta, pose, frame);
		const renderPose = frame.getViewerPose(state.xrRefSpace) || pose;
		menuController.updateXrInput({xrSession: state.xrSession, xrRefSpace: state.xrRefSpace, frame: frame, pose: renderPose, callbacks: xrMenuActionCallbacks});
		if (passthroughController && passthroughController.updateFrame) {
			passthroughController.updateFrame({delta: delta, audioMetrics: getAudioMetrics()});
		}
		if (state.visualizerEngine) {
			if (renderPose.transform && renderPose.views.length) {
				state.visualizerEngine.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
				state.visualizerEngine.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
			}
			state.visualizerEngine.update(time * 0.001);
		}
		updateSceneLighting(time * 0.001);
		sceneRenderer.renderXrViews({baseLayer: state.xrSession.renderState.baseLayer, pose: renderPose, passthroughPose: state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : renderPose, eyeDistanceMeters: menuController.getState().eyeDistanceMeters, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, passthroughController: passthroughController, menuContentState: getMenuContentState(), getReactiveFloorColors: getAudioReactiveFloorColors, transparentBackgroundBool: state.passthroughAvailableBool, passthroughFallbackBool: !state.passthroughAvailableBool});
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
		sceneRenderer.renderPreviewFrame({previewTimeSeconds: previewTimeSeconds, desktopMovementState: desktopMovementState, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, passthroughController: passthroughController, menuContentState: getMenuContentState(), getReactiveFloorColors: getAudioReactiveFloorColors, passthroughFallbackBool: true});
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
	const startSession = async function() {
		try {
			if (shell.isCanvasPointerLocked(documentRef) && documentRef.exitPointerLock) {
				documentRef.exitPointerLock();
			}
			updateDesktopMenuPreview(true);
			const xrState = await sessionBridge.startSession(state.gl, endSession);
			state.xrSession = xrState.session;
			state.xrSessionMode = xrState.sessionMode || "immersive-vr";
			state.xrEnvironmentBlendMode = xrState.environmentBlendMode || "opaque";
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
		button.addEventListener("click", function() {
			runAudioAction(action(), fallbackMessage);
		});
	};
	const registerEventHandlers = function() {
		desktopInput.registerEventHandlers(documentRef, windowRef);
		menuController.registerDesktopPreviewEvents({callbacks: desktopMenuActionCallbacks, getInteractionState: getDesktopMenuInteractionState});
		if (shell.enterButton) {
			shell.enterButton.addEventListener("click", function() {
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
			shell.stopAudioButton.addEventListener("click", function() {
				audioController.stop();
			});
		}
		if (shell.exitButton) {
			shell.exitButton.addEventListener("click", function() {
				if (state.xrSession) {
					state.xrSession.end();
				}
			});
		}
		windowRef.addEventListener("resize", function() {
			if (!state.xrSession) {
				shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
			}
		});
		shell.canvas.addEventListener("click", function() {
			if (!state.xrSession && !shell.isCanvasPointerLocked(documentRef)) {
				shell.requestCanvasPointerLock();
			}
		});
		shell.canvas.addEventListener("contextmenu", function(event) {
			if (!state.xrSession) {
				event.preventDefault();
			}
		});
		documentRef.addEventListener("pointerdown", function() {
			audioController.activate();
		}, {passive: true});
		documentRef.addEventListener("keydown", function() {
			audioController.activate();
		});
		documentRef.addEventListener("keydown", function(event) {
			if (state.xrSession) {
				return;
			}
			if (event.code === "KeyM" && !event.repeat) {
				menuController.setDesktopPreviewVisibleBool(!menuController.getState().desktopPreviewVisibleBool);
				event.preventDefault();
			}
		});
		documentRef.addEventListener("mouseup", function() {
			menuController.handleDesktopPointerUp();
		});
		windowRef.addEventListener("blur", function() {
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
					shell.setStatus(error.message || "glb init failed");
				}
			}
			state.visualizerEngine = createVisualizerEngine ? createVisualizerEngine(state.gl) : null;
			if (state.visualizerEngine) {
				audioController.setAudioBackend(state.visualizerEngine);
				audioController.activate().catch(function() {});
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
		cycleLightingPreset: cycleLightingPreset,
		selectLightingPreset: function(index) {
			if (!sceneLighting || !sceneLighting.selectPreset) {
				return Promise.resolve();
			}
			return sceneLighting.selectPreset(index);
		},
		getLightingSelectionState: function() {
			return getLightingSelectionState();
		}
	};
};
