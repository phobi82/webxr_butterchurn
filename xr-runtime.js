// Runtime core: input, XR session bridge, and main loop.

// Desktop Input
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

	const eventRegistry = createEventListenerRegistry();

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
			eventRegistry.on(documentRef, "pointerlockchange", function() {
				pointerLockedBool = documentRef.pointerLockElement !== null;
				if (!pointerLockedBool) {
					desktopMovementState.sprintBool = false;
					desktopMovementState.crouchBool = false;
				}
				onPointerLockChange(pointerLockedBool);
			});

			eventRegistry.on(documentRef, "mousedown", function(event) {
				setPointerModifierState(event, true);
			}, true);

			eventRegistry.on(documentRef, "mouseup", function(event) {
				setPointerModifierState(event, false);
			}, true);

			eventRegistry.on(documentRef, "mousemove", function(event) {
				if (!isPointerLockInputActive()) {
					return;
				}
				desktopMovementState.lookYaw += event.movementX * mouseSensitivity;
				desktopMovementState.lookPitch = clampNumber(desktopMovementState.lookPitch - event.movementY * mouseSensitivity, -1.35, 1.35);
			});

			eventRegistry.on(documentRef, "keydown", function(event) {
				if (isXrSessionActive()) {
					return;
				}
				if (setMovementKeyState(event.code, true)) {
					event.preventDefault();
				}
			});

			eventRegistry.on(documentRef, "keyup", function(event) {
				if (setMovementKeyState(event.code, false)) {
					event.preventDefault();
				}
			});

			eventRegistry.on(windowRef, "blur", function() {
				this.releaseAllMovementKeys();
			}.bind(this));
		},
		destroy: function() {
			eventRegistry.removeAll();
		}
	};
};


// XR Session Bridge
const createXrSessionBridge = function(options) {
	const xrApi = options.xrApi || null;
	const xrWebGLLayer = options.xrWebGLLayer || null;
	const xrWebGLBinding = options.xrWebGLBinding || null;
	const xrRigidTransform = options.xrRigidTransform || null;
	const depthDataFormats = options.depthDataFormats || ["luminance-alpha", "float32"];
	const getSafeSessionDepthState = function(session) {
		let depthUsage = "", depthDataFormat = "";
		try { depthUsage = session.depthUsage || ""; } catch (e) {}
		try { depthDataFormat = session.depthDataFormat || ""; } catch (e) {}
		return {
			depthUsage: depthUsage,
			depthDataFormat: depthDataFormat,
			depthSensingActiveBool: depthUsage === "cpu-optimized" || depthUsage === "gpu-optimized"
		};
	};
	const startSessionWithDepthLadder = async function(sessionMode) {
		// VR: no depth needed, skip to plain session
		if (sessionMode !== "immersive-ar") {
			return {session: await xrApi.requestSession(sessionMode, {requiredFeatures: ["local-floor"]})};
		}
		// Step 1: GPU depth (Quest uses gpu-optimized; no projection layer needed, XRWebGLBinding handles depth queries)
		if (xrWebGLBinding) {
			try {
				const session = await xrApi.requestSession(sessionMode, {
					requiredFeatures: ["local-floor"],
					optionalFeatures: ["depth-sensing"],
					depthSensing: {
						usagePreference: ["gpu-optimized", "cpu-optimized"],
						dataFormatPreference: ["unsigned-short", "luminance-alpha", "float32"],
						formatPreference: ["unsigned-short", "luminance-alpha", "float32"],
						depthTypeRequest: ["smooth", "raw"]
					}
				});
				return {session: session};
			} catch (e) {}
		}
		// Step 2: CPU depth fallback
		try {
			const session = await xrApi.requestSession(sessionMode, {
				requiredFeatures: ["local-floor"],
				optionalFeatures: ["depth-sensing"],
				depthSensing: {
					usagePreference: ["cpu-optimized"],
					dataFormatPreference: depthDataFormats,
					formatPreference: depthDataFormats,
					depthTypeRequest: ["smooth", "raw"]
				}
			});
			return {session: session};
		} catch (e) {}
		// Step 3: plain AR, no depth
		return {session: await xrApi.requestSession(sessionMode, {requiredFeatures: ["local-floor"]})};
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
			const ladderResult = await startSessionWithDepthLadder(sessionMode);
			const session = ladderResult.session;
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
			// Create XRWebGLBinding for depth queries only (not for rendering)
			const sessionDepthState = getSafeSessionDepthState(session);
			let glBinding = null;
			if (xrWebGLBinding && sessionDepthState.depthUsage === "gpu-optimized") {
				try {
					glBinding = new xrWebGLBinding(session, gl);
				} catch (e) {
					glBinding = null;
				}
			}
			const baseRefSpace = await session.requestReferenceSpace("local-floor");
			const environmentBlendMode = session.environmentBlendMode || (sessionMode === "immersive-ar" ? "alpha-blend" : "opaque");
			return {
				session: session,
				baseRefSpace: baseRefSpace,
				sessionMode: sessionMode,
				environmentBlendMode: environmentBlendMode,
				passthroughAvailableBool: sessionMode === "immersive-ar" && environmentBlendMode !== "opaque",
				depthSensingActiveBool: sessionMode === "immersive-ar" && sessionDepthState.depthSensingActiveBool,
				depthUsage: sessionDepthState.depthUsage,
				depthDataFormat: sessionDepthState.depthDataFormat,
				glBinding: glBinding
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

// Menu Fallback
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

const DEFAULT_VISUALIZER_SELECTION_STATE = {
	modeNames: ["Toroidal"],
	currentModeIndex: 0,
	horizontalMirrorBool: false,
	presetNames: ["Preset 1"],
	currentPresetIndex: 0
};

const DEFAULT_LIGHTING_SELECTION_STATE = {
	presetNames: ["Aurora Drift"],
	currentPresetIndex: 0,
	currentPresetName: "Aurora Drift",
	currentPresetDescription: "Slow colorful overhead drift",
	currentPresetEffectName: "Aurora Drift",
	currentPresetEffectDescription: "Slow colorful overhead drift",
	currentPresetEffectIndex: 0,
	currentPresetEffectCount: 1,
	currentPresetVariantKey: "",
	currentPresetVariantIndex: 0,
	currentPresetVariantCount: 1,
	currentPresetVariantLabel: "",
	currentPresetSurfaceKey: ""
};

const SESSION_TIMEOUT_MS = 15000;
const resolvedRuntimeActionPromise = Promise.resolve();

const computeRuntimeDepthProfile = function(depthFrameKind, depthDataFormat, rawValueToMeters) {
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

const createRuntimeState = function() {
	return {
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
};

const resetRuntimeSessionState = function(state) {
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
};

const createRuntimeQueries = function(args) {
	const state = args.state;
	const desktopInput = args.desktopInput;
	const menuController = args.menuController;
	const audioController = args.audioController;
	const sceneLighting = args.sceneLighting;
	const passthroughController = args.passthroughController;
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
	const getMenuContentState = function() {
		const visualizerState = getVisualizerSelectionState() || DEFAULT_VISUALIZER_SELECTION_STATE;
		const lightingState = getLightingSelectionState() || DEFAULT_LIGHTING_SELECTION_STATE;
		const audioSourceState = audioController && audioController.getState ? audioController.getState() : {sourceKind: "none", sourceName: ""};
		const effectSemanticModeState = getEffectSemanticModeState();
		return {
			sceneTimeSeconds: state.sceneTimeSeconds,
			audioMetrics: getAudioMetrics(),
			audioSourceKind: audioSourceState.sourceKind || "none",
			audioSourceName: audioSourceState.sourceName || "",
			shaderModeNames: visualizerState.modeNames,
			currentShaderModeIndex: visualizerState.currentModeIndex,
			horizontalMirrorBool: !!visualizerState.horizontalMirrorBool,
			lightPresetNames: lightingState.presetNames,
			currentLightPresetIndex: lightingState.currentPresetIndex,
			currentLightPresetName: lightingState.currentPresetName,
			currentLightPresetDescription: lightingState.currentPresetDescription,
			currentLightPresetEffectName: lightingState.currentPresetEffectName,
			currentLightPresetEffectDescription: lightingState.currentPresetEffectDescription,
			currentLightPresetEffectIndex: lightingState.currentPresetEffectIndex,
			currentLightPresetEffectCount: lightingState.currentPresetEffectCount,
			currentLightPresetVariantKey: lightingState.currentPresetVariantKey,
			currentLightPresetVariantIndex: lightingState.currentPresetVariantIndex,
			currentLightPresetVariantCount: lightingState.currentPresetVariantCount,
			currentLightPresetVariantLabel: lightingState.currentPresetVariantLabel,
			currentLightPresetSurfaceKey: lightingState.currentPresetSurfaceKey,
			effectSemanticModeKey: effectSemanticModeState.key,
			effectSemanticModeLabel: effectSemanticModeState.label,
			presetNames: visualizerState.presetNames,
			currentPresetIndex: visualizerState.currentPresetIndex,
			xrSessionActiveBool: !!state.xrSession
		};
	};
	const getDesktopMenuInteractionState = function() {
		return {xrSessionActiveBool: !!state.xrSession, pointerLockedBool: desktopInput.isPointerLocked()};
	};
	return {
		getAudioMetrics: getAudioMetrics,
		getVisualizerSelectionState: getVisualizerSelectionState,
		getLightingSelectionState: getLightingSelectionState,
		getEffectSemanticModeState: getEffectSemanticModeState,
		getMenuContentState: getMenuContentState,
		getDesktopMenuInteractionState: getDesktopMenuInteractionState,
		updateDesktopMenuPreview: function(xrSessionActiveOverrideBool) {
			const interactionState = getDesktopMenuInteractionState();
			const xrSessionActiveBool = xrSessionActiveOverrideBool == null ? interactionState.xrSessionActiveBool : xrSessionActiveOverrideBool;
			menuController.updateDesktopPreview({
				xrSessionActiveBool: xrSessionActiveBool,
				pointerLockedBool: interactionState.pointerLockedBool,
				interactiveBool: !interactionState.pointerLockedBool && !xrSessionActiveBool,
				renderState: getMenuContentState()
			});
		}
	};
};

const createRuntimeLightingActions = function(args) {
	const sceneLighting = args.sceneLighting;
	const runtimeQueries = args.runtimeQueries;
	const runLightingAction = function(action, value) {
		if (!action) {
			return resolvedRuntimeActionPromise;
		}
		return action(value);
	};
	const selectLightingPreset = function(index) {
		return runLightingAction(sceneLighting && sceneLighting.selectPreset, index);
	};
	return {
		selectLightingPreset: selectLightingPreset,
		cycleLightingPreset: function(direction) {
			const selectionState = runtimeQueries.getLightingSelectionState();
			const count = selectionState ? selectionState.presetNames.length : 0;
			if (!count) {
				return resolvedRuntimeActionPromise;
			}
			return selectLightingPreset((selectionState.currentPresetIndex + direction + count) % count);
		},
		cycleLightingEffect: function(direction) {
			return runLightingAction(sceneLighting && sceneLighting.cycleEffect, direction < 0 ? -1 : 1);
		},
		cycleLightingVariant: function(direction) {
			return runLightingAction(sceneLighting && sceneLighting.cycleVariant, direction < 0 ? -1 : 1);
		}
	};
};

const createRuntimeMenuActions = function(args) {
	const state = args.state;
	const audioController = args.audioController;
	const menuController = args.menuController;
	const passthroughController = args.passthroughController;
	const runtimeQueries = args.runtimeQueries;
	const lightingActions = args.lightingActions;
	const invokePassthroughAction = function(methodName, value) {
		if (passthroughController && passthroughController[methodName]) {
			passthroughController[methodName](value);
		}
	};
	const createPassthroughToggleHandler = function(methodName) {
		return function() {
			invokePassthroughAction(methodName);
		};
	};
	const createPassthroughDirectionHandler = function(methodName) {
		return function(action) {
			if (action) {
				invokePassthroughAction(methodName, action.direction);
			}
		};
	};
	const createPassthroughKeyHandler = function(methodName, keyName) {
		return function(action) {
			if (action) {
				invokePassthroughAction(methodName, action[keyName]);
			}
		};
	};
	const cycleVisualizerSelection = function(action, selectionState, countKey, currentIndexKey, selectMethodName, wrapIndexBool) {
		if (!action || !state.visualizerEngine || !state.visualizerEngine[selectMethodName]) {
			return resolvedRuntimeActionPromise;
		}
		const count = selectionState ? selectionState[countKey].length : 0;
		if (!count) {
			return resolvedRuntimeActionPromise;
		}
		const nextIndex = selectionState[currentIndexKey] + (action.direction < 0 ? -1 : 1);
		return state.visualizerEngine[selectMethodName](wrapIndexBool ? (nextIndex + count) % count : nextIndex);
	};
	const handlers = {
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
		"passthroughFlashlight.toggle": createPassthroughToggleHandler("toggleFlashlight"),
		"passthroughDepth.toggle": createPassthroughToggleHandler("toggleDepth"),
		"passthroughDepthRadial.toggle": createPassthroughToggleHandler("toggleDepthRadial"),
		"passthroughDepthMotionCompensation.toggle": createPassthroughToggleHandler("toggleDepthMotionCompensation"),
		"passthroughDepthReconstruction.cycle": createPassthroughDirectionHandler("cycleDepthReconstructionMode"),
		"passthroughDepthMode.cycle": createPassthroughDirectionHandler("cycleDepthMode"),
		"depthEchoReactive.toggle": createPassthroughKeyHandler("toggleDepthEchoReactive", "key"),
		"depthDistanceReactive.toggle": createPassthroughToggleHandler("toggleDepthDistanceReactive"),
		"sceneLightingMode.cycle": createPassthroughDirectionHandler("cycleLightingMode"),
		"sceneLightingAnchorMode.cycle": createPassthroughDirectionHandler("cycleLightingAnchorMode"),
		"sceneLightPreset.cycle": function(action) {
			if (action) {
				lightingActions.cycleLightingEffect(action.direction);
			}
		},
		"visualizerMode.cycle": function(action) {
			return cycleVisualizerSelection(action, runtimeQueries.getVisualizerSelectionState(), "modeNames", "currentModeIndex", "selectMode", false);
		},
		"visualizerHorizontalMirror.toggle": function() {
			if (!state.visualizerEngine || !state.visualizerEngine.toggleHorizontalMirror) {
				return resolvedRuntimeActionPromise;
			}
			return state.visualizerEngine.toggleHorizontalMirror();
		},
		"butterchurnPreset.cycle": function(action) {
			return cycleVisualizerSelection(action, runtimeQueries.getVisualizerSelectionState(), "presetNames", "currentPresetIndex", "selectPreset", true);
		}
	};
	const dispatchMenuAction = function(action) {
		if (!action || !action.type) {
			return;
		}
		const actionHandler = handlers[action.type];
		if (!actionHandler) {
			console.warn("[MenuAction] unknown type:", action.type);
			return;
		}
		return actionHandler(action);
	};
	const dispatchDesktopMenuAction = function(action) {
		if (action && action.type === "butterchurnPreset.cycle") {
			audioController.activate();
		}
		dispatchMenuAction(action);
	};
	return {
		dispatchMenuAction: dispatchMenuAction,
		xrCallbacks: {
			dispatchMenuAction: dispatchMenuAction
		},
		desktopCallbacks: {
			dispatchMenuAction: dispatchDesktopMenuAction
		}
	};
};

const createRuntimeSceneActions = function(args) {
	const state = args.state;
	const sceneLighting = args.sceneLighting;
	const menuController = args.menuController;
	const runtimeQueries = args.runtimeQueries;
	const getFloorColors = args.getFloorColors || null;
	return {
		updateSceneLighting: function(timeSeconds) {
			if (sceneLighting) {
				sceneLighting.update(timeSeconds, runtimeQueries.getAudioMetrics());
			}
		},
		resolveFloorColors: function() {
			if (getFloorColors) {
				return getFloorColors({
					audioMetrics: runtimeQueries.getAudioMetrics(),
					menuState: menuController.getState(),
					sceneTimeSeconds: state.sceneTimeSeconds
				});
			}
			const audioMetrics = runtimeQueries.getAudioMetrics();
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
		}
	};
};

const createRuntimeSessionStateSync = function(args) {
	const state = args.state;
	const shell = args.shell;
	const menuController = args.menuController;
	return {
		updatePassthroughUiState: function() {
			menuController.setPassthroughState({
				supportedBool: !!state.xrSupportState.immersiveArSupportedBool,
				availableBool: !!state.passthroughAvailableBool,
				sessionMode: state.xrSessionMode,
				environmentBlendMode: state.xrEnvironmentBlendMode
			});
		},
		syncReadyShellState: function() {
			shell.setXrState({
				statusText: state.xrSupportState.preferredSessionMode ? "ready" : "headset not detected.",
				enterEnabledBool: !!state.xrSupportState.preferredSessionMode,
				exitEnabledBool: false
			});
		}
	};
};

const createRuntimeXrActions = function(args) {
	const state = args.state;
	const sessionBridge = args.sessionBridge;
	const locomotion = args.locomotion;
	const xrMovementState = args.xrMovementState;
	const menuController = args.menuController;
	const inputConfig = args.inputConfig || {};
	const stickDeadzone = inputConfig.stickDeadzone == null ? 0.08 : inputConfig.stickDeadzone;
	const stanceStickDeadzone = inputConfig.stanceStickDeadzone == null ? 0.22 : inputConfig.stanceStickDeadzone;
	const stanceVerticalDominanceMargin = inputConfig.stanceVerticalDominanceMargin == null ? 0.12 : inputConfig.stanceVerticalDominanceMargin;
	const getSourceStickAxes = function(gamepad) {
		const primaryX = gamepad.axes[0] || 0;
		const primaryY = gamepad.axes[1] || 0;
		const secondaryX = gamepad.axes[2] || 0;
		const secondaryY = gamepad.axes[3] || 0;
		const primaryMagnitude = Math.abs(primaryX) + Math.abs(primaryY);
		const secondaryMagnitude = Math.abs(secondaryX) + Math.abs(secondaryY);
		if (gamepad.axes.length >= 4 && secondaryMagnitude > primaryMagnitude + 0.01) {
			return {x: secondaryX, y: secondaryY};
		}
		return {x: primaryX, y: primaryY};
	};
	return {
		updateReferenceSpace: function(viewerTransform) {
			state.xrRefSpace = sessionBridge.createOffsetReferenceSpace(state.baseRefSpace, xrMovementState, viewerTransform);
		},
		getPassthroughDepthInfoByView: function(frame, pose) {
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
		},
		applyLocomotion: function(delta, pose, frame) {
			if (!state.xrSession || !pose || !frame) {
				return;
			}
			const locomotionInput = {moveX: 0, moveY: 0, turnX: 0, stanceInputY: 0, jumpRequestBool: false, airBoostActiveBool: false, rightControllerBoostDir: null, sprintActiveBool: false};
			const sources = state.xrSession.inputSources || [];
			for (let i = 0; i < sources.length; i += 1) {
				const source = sources[i];
				const gamepad = source.gamepad;
				if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) {
					continue;
				}
				const stickAxes = getSourceStickAxes(gamepad);
				if (source.handedness === "left") {
					locomotionInput.moveX = Math.abs(stickAxes.x) > stickDeadzone ? stickAxes.x : 0;
					locomotionInput.moveY = Math.abs(stickAxes.y) > stickDeadzone ? stickAxes.y : 0;
					locomotionInput.sprintActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
				}
				if (source.handedness === "right") {
					locomotionInput.turnX = Math.abs(stickAxes.x) > stickDeadzone ? stickAxes.x : 0;
					locomotionInput.stanceInputY = Math.abs(stickAxes.y) > stanceStickDeadzone && Math.abs(stickAxes.y) > Math.abs(stickAxes.x) + stanceVerticalDominanceMargin ? -stickAxes.y : 0;
					locomotionInput.jumpRequestBool = !!(gamepad.buttons[4] && gamepad.buttons[4].pressed);
					locomotionInput.airBoostActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
					const targetRayPose = state.xrRefSpace ? frame.getPose(source.targetRaySpace, state.xrRefSpace) : null;
					if (targetRayPose) {
						locomotionInput.rightControllerBoostDir = extractForwardDirectionFromQuaternion(targetRayPose.transform.orientation);
					}
				}
			}
			const basePose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : null;
			const rawViewerTransform = basePose ? basePose.transform : pose.transform;
			const menuState = menuController.getState();
			const locomotionStep = locomotion.applyXrLocomotion(xrMovementState, {
				delta: delta,
				renderedTransform: pose.transform,
				viewerTransform: rawViewerTransform,
				renderSpaceInitializedBool: state.xrRefSpace !== state.baseRefSpace,
				locomotion: locomotionInput,
				jumpMode: menuState.jumpMode,
				menuConsumesRightTriggerBool: menuState.menuConsumesRightTriggerBool
			});
			if (locomotionStep.referenceSpaceUpdateNeededBool) {
				this.updateReferenceSpace(rawViewerTransform);
			}
		},
		updateDepthAvailability: function(passthroughDepthInfoByView) {
			if (state.usableDepthAvailableBool || !passthroughDepthInfoByView.length) {
				return;
			}
			for (let i = 0; i < passthroughDepthInfoByView.length; i += 1) {
				const depthInfo = passthroughDepthInfoByView[i];
				if (!depthInfo || depthInfo.isValid === false) {
					continue;
				}
				if (typeof depthInfo.getDepthInMeters === "function") {
					state.depthFrameKind = "cpu";
				} else if (depthInfo.texture && depthInfo.textureType === "texture-array") {
					state.depthFrameKind = "gpu-array";
				} else if (depthInfo.texture) {
					state.depthFrameKind = "gpu-texture";
				}
				if (!state.depthFrameKind) {
					continue;
				}
				state.usableDepthAvailableBool = true;
				state.depthProfile = computeRuntimeDepthProfile(state.depthFrameKind, state.xrDepthDataFormat, depthInfo.rawValueToMeters);
				console.log("[DepthProfile] " + state.depthProfile.label + " linearScale=" + state.depthProfile.linearScale + " nearZ=" + state.depthProfile.nearZ);
				return;
			}
		}
	};
};

const createRuntimeFrameActions = function(args) {
	const windowRef = args.windowRef;
	const state = args.state;
	const sceneRenderer = args.sceneRenderer;
	const sceneLighting = args.sceneLighting;
	const passthroughController = args.passthroughController;
	const menuController = args.menuController;
	const runtimeQueries = args.runtimeQueries;
	const xrActions = args.xrActions;
	const sceneActions = args.sceneActions;
	const locomotion = args.locomotion;
	const desktopMovementState = args.desktopMovementState;
	const renderPolicy = args.renderPolicy || {};
	let frameBudgetOverCount = 0;
	let frameBudgetFrameCount = 0;

	const syncVisualizerFrame = function(renderPose, timeSeconds) {
		if (!state.visualizerEngine) {
			return;
		}
		if (renderPose && renderPose.transform && renderPose.views.length) {
			state.visualizerEngine.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
			state.visualizerEngine.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
		}
		state.visualizerEngine.update(timeSeconds);
	};

	const updatePassthroughFrame = function(delta, passthroughPose) {
		if (passthroughController && passthroughController.setDepthAvailability) {
			passthroughController.setDepthAvailability(state.usableDepthAvailableBool);
		}
		if (passthroughController && passthroughController.updateFrame) {
			passthroughController.updateFrame({
				delta: delta,
				audioMetrics: runtimeQueries.getAudioMetrics(),
				passthroughPose: passthroughPose || null
			});
		}
	};

	const updateFrameBudget = function(frameStartMs) {
		const frameElapsedMs = performance.now() - frameStartMs;
		frameBudgetFrameCount += 1;
		if (frameElapsedMs > 13.9) {
			frameBudgetOverCount += 1;
		}
		if (frameBudgetFrameCount < 300) {
			return;
		}
		if (frameBudgetOverCount > 15) {
			console.warn("Frame budget: " + frameBudgetOverCount + "/300 over 13.9ms");
		}
		frameBudgetOverCount = 0;
		frameBudgetFrameCount = 0;
	};

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
		menuController.updateXrInput({xrSession: state.xrSession, xrRefSpace: state.xrRefSpace, frame: frame, pose: pose, callbacks: args.menuActions.xrCallbacks});
		xrActions.applyLocomotion(delta, pose, frame);
		const renderPose = frame.getViewerPose(state.xrRefSpace) || pose;
		const passthroughPose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : renderPose;
		if (state.depthSensingActiveBool && state.xrSession && state.xrSession.depthActive === false) {
			try { state.xrSession.resumeDepthSensing(); } catch (e) { console.warn("[Depth] resumeDepthSensing failed:", e.message || e); }
		}
		const passthroughDepthInfoByView = xrActions.getPassthroughDepthInfoByView(frame, passthroughPose || renderPose);
		xrActions.updateDepthAvailability(passthroughDepthInfoByView);
		updatePassthroughFrame(delta, passthroughPose || renderPose);
		syncVisualizerFrame(renderPose, time * 0.001);
		sceneActions.updateSceneLighting(time * 0.001);
		sceneRenderer.renderXrViews({
			baseLayer: state.xrSession.renderState.baseLayer,
			depthFrameKind: state.depthFrameKind || "",
			depthProfile: state.depthProfile,
			pose: renderPose,
			passthroughPose: passthroughPose || renderPose,
			passthroughDepthInfoByView: passthroughDepthInfoByView,
			eyeDistanceMeters: menuController.getState().eyeDistanceMeters,
			visualizerEngine: state.visualizerEngine,
			glbAssetStore: state.glbAssetStore,
			sceneLighting: sceneLighting,
			menuController: menuController,
			passthroughController: passthroughController,
			menuContentState: runtimeQueries.getMenuContentState(),
			getReactiveFloorColors: sceneActions.resolveFloorColors,
			transparentBackgroundBool: state.passthroughAvailableBool,
			passthroughFallbackBool: !state.passthroughAvailableBool,
			visualizerBackgroundEnabledBool: !!renderPolicy.visualizerBackgroundEnabledBool
		});
		updateFrameBudget(frameStartMs);
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
		sceneActions.updateSceneLighting(previewTimeSeconds);
		updatePassthroughFrame(delta, null);
		sceneRenderer.renderPreviewFrame({
			previewTimeSeconds: previewTimeSeconds,
			desktopMovementState: desktopMovementState,
			visualizerEngine: state.visualizerEngine,
			glbAssetStore: state.glbAssetStore,
			sceneLighting: sceneLighting,
			menuController: menuController,
			passthroughController: passthroughController,
			menuContentState: runtimeQueries.getMenuContentState(),
			getReactiveFloorColors: sceneActions.resolveFloorColors,
			passthroughFallbackBool: true,
			visualizerBackgroundEnabledBool: !!renderPolicy.visualizerBackgroundEnabledBool
		});
		runtimeQueries.updateDesktopMenuPreview();
		windowRef.requestAnimationFrame(renderPreview);
	};

	return {
		renderXr: renderXr,
		renderPreview: renderPreview
	};
};

const createRuntimeSessionLifecycle = function(args) {
	const windowRef = args.windowRef;
	const documentRef = args.documentRef;
	const shell = args.shell;
	const sessionBridge = args.sessionBridge;
	const state = args.state;
	const locomotion = args.locomotion;
	const xrMovementState = args.xrMovementState;
	const menuController = args.menuController;
	const runtimeQueries = args.runtimeQueries;
	const sessionStateSync = args.sessionStateSync;
	const frameActions = args.frameActions;
	const endSession = function() {
		if (state.frameHandle !== null && state.xrSession) {
			state.xrSession.cancelAnimationFrame(state.frameHandle);
		}
		resetRuntimeSessionState(state);
		menuController.endSession();
		sessionStateSync.updatePassthroughUiState();
		sessionStateSync.syncReadyShellState();
		if (state.visualizerEngine) {
			applyVisualizerBackgroundComposite(state.visualizerEngine, {alpha: 1, maskCount: 0, masks: []});
			state.visualizerEngine.endSession();
		}
		xrMovementState.horizontalVelocityX = 0;
		xrMovementState.horizontalVelocityZ = 0;
		runtimeQueries.updateDesktopMenuPreview();
		windowRef.requestAnimationFrame(frameActions.renderPreview);
	};
	const startSession = async function() {
		try {
			if (shell.isCanvasPointerLocked(documentRef) && documentRef.exitPointerLock) {
				documentRef.exitPointerLock();
			}
			runtimeQueries.updateDesktopMenuPreview(true);
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
			sessionStateSync.updatePassthroughUiState();
			state.xrRefSpace = state.baseRefSpace;
			shell.setXrState({
				statusText: state.xrSessionMode === "immersive-ar" ? "session running (AR)" : "session running (VR)",
				enterEnabledBool: false,
				exitEnabledBool: true
			});
			state.lastRenderTime = 0;
			if (state.visualizerEngine) {
				state.visualizerEngine.startSession();
			}
			state.frameHandle = state.xrSession.requestAnimationFrame(frameActions.renderXr);
		} catch (error) {
			shell.setXrState({
				statusText: error.message || "session failed",
				enterEnabledBool: !!state.xrSupportState.preferredSessionMode,
				exitEnabledBool: false
			});
			resetRuntimeSessionState(state);
			sessionStateSync.updatePassthroughUiState();
			runtimeQueries.updateDesktopMenuPreview();
		}
	};
	return {
		endSession: endSession,
		startSession: startSession
	};
};

const createRuntimeEventBindings = function(args) {
	const windowRef = args.windowRef;
	const documentRef = args.documentRef;
	const shell = args.shell;
	const state = args.state;
	const sessionBridge = args.sessionBridge;
	const audioController = args.audioController;
	const menuController = args.menuController;
	const runtimeEventRegistry = args.runtimeEventRegistry;
	const desktopInput = args.desktopInput;
	const menuActions = args.menuActions;
	const runtimeQueries = args.runtimeQueries;
	const sessionLifecycle = args.sessionLifecycle;
	const tabSources = args.tabSources || {};

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

	return {
		registerEventHandlers: function() {
			desktopInput.registerEventHandlers(documentRef, windowRef);
			menuController.registerDesktopPreviewEvents({callbacks: menuActions.desktopCallbacks, getInteractionState: runtimeQueries.getDesktopMenuInteractionState});
			if (shell.enterButton) {
				runtimeEventRegistry.on(shell.enterButton, "click", function() {
					if (sessionBridge.isAvailable() && state.gl && !state.xrSession) {
						audioController.activate();
						sessionLifecycle.startSession();
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
		}
	};
};

const createRuntimeStartupActions = function(args) {
	const windowRef = args.windowRef;
	const shell = args.shell;
	const sessionBridge = args.sessionBridge;
	const sceneRenderer = args.sceneRenderer;
	const sceneLighting = args.sceneLighting;
	const audioController = args.audioController;
	const locomotion = args.locomotion;
	const createGlbAssetStore = args.createGlbAssetStore;
	const createVisualizerSourceBackend = args.createVisualizerSourceBackend;
	const createVisualizerEngine = args.createVisualizerEngine;
	const sceneGlbAssets = args.sceneGlbAssets || [];
	const state = args.state;
	const desktopMovementState = args.desktopMovementState;
	const sessionStateSync = args.sessionStateSync;
	const frameActions = args.frameActions;
	const initGlbAssets = async function() {
		state.glbAssetStore = createGlbAssetStore ? createGlbAssetStore(state.gl) : null;
		if (!state.glbAssetStore) {
			return;
		}
		try {
			state.glbAssetStore.init();
			await state.glbAssetStore.loadAssets(sceneGlbAssets);
		} catch (error) {
			console.warn("[GLB] init/load error:", error);
			shell.setStatus(error.message || "glb init failed");
		}
	};
	const initVisualizer = function() {
		state.visualizerSourceBackend = createVisualizerSourceBackend ? createVisualizerSourceBackend() : null;
		state.visualizerEngine = createVisualizerEngine ? createVisualizerEngine(state.gl) : null;
		if (!state.visualizerEngine) {
			return;
		}
		state.visualizerEngine.init({gl: state.gl, sourceBackend: state.visualizerSourceBackend || null});
		audioController.setAudioBackend(state.visualizerEngine);
		audioController.activate().catch(function() {});
		applyVisualizerBackgroundComposite(state.visualizerEngine, {alpha: 1, maskCount: 0, masks: []});
	};
	const syncSupportState = async function() {
		if (!sessionBridge.isAvailable()) {
			sessionStateSync.updatePassthroughUiState();
			shell.setXrState({statusText: "WebXR not available.", enterEnabledBool: false, exitEnabledBool: false});
			return;
		}
		state.xrSupportState = await sessionBridge.getSupportState();
		sessionStateSync.updatePassthroughUiState();
		sessionStateSync.syncReadyShellState();
	};
	return {
		start: async function() {
			args.eventBindings.registerEventHandlers();
			state.gl = sceneRenderer.init();
			if (!state.gl) {
				return;
			}
			locomotion.resetDesktopState(desktopMovementState);
			sceneLighting.update(0, emptyAudioMetrics);
			await initGlbAssets();
			initVisualizer();
			await syncSupportState();
			shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
			windowRef.requestAnimationFrame(frameActions.renderPreview);
		}
	};
};

const createRuntimePublicActions = function(args) {
	const passthroughController = args.passthroughController;
	const runtimeQueries = args.runtimeQueries;
	const lightingActions = args.lightingActions;
	const selectEffectSemanticMode = function(key) {
		if (passthroughController && passthroughController.selectEffectSemanticMode) {
			passthroughController.selectEffectSemanticMode(key);
		}
		return resolvedRuntimeActionPromise;
	};
	return Object.assign({}, lightingActions, {
		selectEffectSemanticMode: selectEffectSemanticMode,
		getEffectSemanticModeState: runtimeQueries.getEffectSemanticModeState,
		getLightingSelectionState: runtimeQueries.getLightingSelectionState
	});
};

const createRuntimeLifecycleActions = function(args) {
	const runtimeEventRegistry = args.runtimeEventRegistry;
	const desktopInput = args.desktopInput;
	const menuController = args.menuController;
	return {
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

// Runtime
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
	const state = createRuntimeState();
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
	const runtimeQueries = createRuntimeQueries({
		state: state,
		desktopInput: desktopInput,
		menuController: menuController,
		audioController: audioController,
		sceneLighting: sceneLighting,
		passthroughController: passthroughController
	});
	const lightingActions = createRuntimeLightingActions({
		sceneLighting: sceneLighting,
		runtimeQueries: runtimeQueries
	});
	const menuActions = createRuntimeMenuActions({
		state: state,
		audioController: audioController,
		menuController: menuController,
		passthroughController: passthroughController,
		runtimeQueries: runtimeQueries,
		lightingActions: lightingActions
	});
	const sceneActions = createRuntimeSceneActions({
		state: state,
		sceneLighting: sceneLighting,
		menuController: menuController,
		runtimeQueries: runtimeQueries,
		getFloorColors: getFloorColors
	});
	const xrActions = createRuntimeXrActions({
		state: state,
		sessionBridge: sessionBridge,
		locomotion: locomotion,
		xrMovementState: xrMovementState,
		menuController: menuController,
		inputConfig: inputConfig
	});
	const sessionStateSync = createRuntimeSessionStateSync({
		state: state,
		shell: shell,
		menuController: menuController
	});
	const frameActions = createRuntimeFrameActions({
		windowRef: windowRef,
		state: state,
		sceneRenderer: sceneRenderer,
		sceneLighting: sceneLighting,
		passthroughController: passthroughController,
		menuController: menuController,
		menuActions: menuActions,
		runtimeQueries: runtimeQueries,
		xrActions: xrActions,
		sceneActions: sceneActions,
		locomotion: locomotion,
		desktopMovementState: desktopMovementState,
		renderPolicy: renderPolicy
	});
	const sessionLifecycle = createRuntimeSessionLifecycle({
		windowRef: windowRef,
		documentRef: documentRef,
		shell: shell,
		sessionBridge: sessionBridge,
		state: state,
		locomotion: locomotion,
		xrMovementState: xrMovementState,
		menuController: menuController,
		runtimeQueries: runtimeQueries,
		sessionStateSync: sessionStateSync,
		frameActions: frameActions
	});
	const eventBindings = createRuntimeEventBindings({
		windowRef: windowRef,
		documentRef: documentRef,
		shell: shell,
		state: state,
		sessionBridge: sessionBridge,
		audioController: audioController,
		menuController: menuController,
		runtimeEventRegistry: runtimeEventRegistry,
		desktopInput: desktopInput,
		menuActions: menuActions,
		runtimeQueries: runtimeQueries,
		sessionLifecycle: sessionLifecycle,
		tabSources: tabSources
	});
	const startupActions = createRuntimeStartupActions({
		windowRef: windowRef,
		shell: shell,
		sessionBridge: sessionBridge,
		sceneRenderer: sceneRenderer,
		sceneLighting: sceneLighting,
		audioController: audioController,
		locomotion: locomotion,
		createGlbAssetStore: createGlbAssetStore,
		createVisualizerSourceBackend: createVisualizerSourceBackend,
		createVisualizerEngine: createVisualizerEngine,
		sceneGlbAssets: sceneGlbAssets,
		state: state,
		desktopMovementState: desktopMovementState,
		sessionStateSync: sessionStateSync,
		frameActions: frameActions,
		eventBindings: eventBindings
	});
	const publicActions = createRuntimePublicActions({
		sceneLighting: sceneLighting,
		passthroughController: passthroughController,
		runtimeQueries: runtimeQueries,
		lightingActions: lightingActions
	});
	const lifecycleActions = createRuntimeLifecycleActions({
		runtimeEventRegistry: runtimeEventRegistry,
		desktopInput: desktopInput,
		menuController: menuController
	});
	return Object.assign({
		start: startupActions.start
	}, publicActions, lifecycleActions);
};
