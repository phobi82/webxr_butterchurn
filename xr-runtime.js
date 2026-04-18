// Runtime core: input, XR session bridge, and main loop.

// Desktop Input
const createDesktopInput = function(options) {
	const desktopMovementState = options.desktopMovementState;
	const mouseSensitivity = options.mouseSensitivity || 0.0024;
	const clampNumber = options.clampNumber;
	const runtimeState = options.runtimeState || {};
	const onPointerLockChange = options.onPointerLockChange || function() {};
	const state = {
		pointerLockedBool: false
	};

	const isPointerLockInputActive = function() {
		return state.pointerLockedBool && !runtimeState.xrSession;
	};

	const releaseAllMovementKeys = function() {
		desktopMovementState.moveForwardBool = false;
		desktopMovementState.moveBackwardBool = false;
		desktopMovementState.moveLeftBool = false;
		desktopMovementState.moveRightBool = false;
		desktopMovementState.sprintBool = false;
		desktopMovementState.crouchBool = false;
		desktopMovementState.jumpHeldBool = false;
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
		state,
		releaseAllMovementKeys,
		registerEventHandlers: function(documentRef, windowRef) {
			eventRegistry.on(documentRef, "pointerlockchange", function() {
				state.pointerLockedBool = documentRef.pointerLockElement !== null;
				if (!state.pointerLockedBool) {
					desktopMovementState.sprintBool = false;
					desktopMovementState.crouchBool = false;
				}
				onPointerLockChange(state.pointerLockedBool);
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
				if (runtimeState.xrSession) {
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
				releaseAllMovementKeys();
			});
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
	const matchDepthViewBool = options.matchDepthViewBool == null ? false : !!options.matchDepthViewBool;
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
						depthTypeRequest: ["smooth", "raw"],
						matchDepthView: matchDepthViewBool
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
					depthTypeRequest: ["smooth", "raw"],
					matchDepthView: matchDepthViewBool
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
		availableBool: !!xrApi,
		getSupportState: getSupportState,
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
				glBinding: glBinding,
				matchDepthViewBool: matchDepthViewBool
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
	const controllerRays = [];
	const setDesktopPreviewVisibleBool = function(visibleBool) {
		state.desktopPreviewVisibleBool = !!visibleBool;
	};
	const resetSessionState = function() {
		state.menuOpenBool = false;
	};
	return {
		state,
		controllerRays,
		setPassthroughState: function() {},
		clearDesktopPointerState: function() {},
		registerDesktopPreviewEvents: function() {},
		updateDesktopPreview: function() {},
		updateXrInput: function() {},
		handleDesktopPointerUp: function() {},
		setDesktopPreviewVisibleBool: setDesktopPreviewVisibleBool,
		resetSessionState: resetSessionState,
		endSession: resetSessionState,
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

const invertMatrix4 = function(sourceMatrix, targetMatrix) {
	const m = sourceMatrix;
	const inv = targetMatrix;
	inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
	inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
	inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
	inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
	inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
	inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
	inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
	inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
	inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
	inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
	inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
	inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
	inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
	inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
	inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
	inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
	const determinant = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
	if (Math.abs(determinant) < 1e-8) {
		return null;
	}
	const invDeterminant = 1 / determinant;
	for (let i = 0; i < 16; i += 1) {
		inv[i] *= invDeterminant;
	}
	return inv;
};

const ensureDepthUvInverseMatrix = function(depthInfo) {
	if (!depthInfo || !depthInfo.normDepthBufferFromNormView) {
		return;
	}
	if (depthInfo.normViewFromNormDepthBufferMatrix) {
		return;
	}
	if (depthInfo.normDepthBufferFromNormView.inverse && depthInfo.normDepthBufferFromNormView.inverse.matrix) {
		depthInfo.normViewFromNormDepthBufferMatrix = new Float32Array(depthInfo.normDepthBufferFromNormView.inverse.matrix);
		return;
	}
	const forwardMatrix = depthInfo.normDepthBufferFromNormView.matrix || depthInfo.normDepthBufferFromNormView;
	if (!forwardMatrix || forwardMatrix.length !== 16) {
		return;
	}
	const inverseMatrix = invertMatrix4(forwardMatrix, new Float32Array(16));
	if (inverseMatrix) {
		depthInfo.normViewFromNormDepthBufferMatrix = inverseMatrix;
	}
};

const buildDepthPoseState = function(timestampMs, viewMatrix, worldFromViewMatrix, projectionMatrix) {
	if (!viewMatrix || !worldFromViewMatrix || !projectionMatrix) {
		return null;
	}
	const projectionParams = extractProjectionRayParams(projectionMatrix);
	return {
		timestampMs: timestampMs || 0,
		viewMatrix: new Float32Array(viewMatrix),
		worldFromViewMatrix: new Float32Array(worldFromViewMatrix),
		projectionMatrix: new Float32Array(projectionMatrix),
		projectionParams: {
			xScale: projectionParams.xScale,
			yScale: projectionParams.yScale,
			xOffset: projectionParams.xOffset,
			yOffset: projectionParams.yOffset
		}
	};
};

const buildDepthPoseStateFromView = function(view, timestampMs) {
	if (!view || !view.transform || !view.transform.inverse || !view.transform.inverse.matrix || !view.projectionMatrix) {
		return null;
	}
	const viewMatrix = view.transform.inverse.matrix;
	const worldFromViewMatrix = view.transform.matrix || buildWorldFromViewMatrix(viewMatrix, new Float32Array(16));
	return buildDepthPoseState(timestampMs, viewMatrix, worldFromViewMatrix, view.projectionMatrix);
};

const buildDepthPoseStateFromDepthInfo = function(depthInfo, fallbackPoseState, timestampMs) {
	if (!depthInfo || !depthInfo.transform || !depthInfo.transform.inverse || !depthInfo.transform.inverse.matrix) {
		return null;
	}
	const projectionMatrix = depthInfo.projectionMatrix || (fallbackPoseState ? fallbackPoseState.projectionMatrix : null);
	if (!projectionMatrix) {
		return null;
	}
	const viewMatrix = depthInfo.transform.inverse.matrix;
	const worldFromViewMatrix = depthInfo.transform.matrix || buildWorldFromViewMatrix(viewMatrix, new Float32Array(16));
	return buildDepthPoseState(timestampMs, viewMatrix, worldFromViewMatrix, projectionMatrix);
};

const buildDepthReprojectionState = function(passthroughPose, depthInfoByView, timestampMs) {
	if (!passthroughPose || !passthroughPose.views) {
		return [];
	}
	const results = [];
	for (let i = 0; i < passthroughPose.views.length; i += 1) {
		const currentPoseState = buildDepthPoseStateFromView(passthroughPose.views[i], timestampMs);
		let sourcePoseState = buildDepthPoseStateFromDepthInfo(depthInfoByView && depthInfoByView[i] ? depthInfoByView[i] : null, currentPoseState, timestampMs);
		if (!sourcePoseState && currentPoseState) {
			sourcePoseState = buildDepthPoseState(currentPoseState.timestampMs, currentPoseState.viewMatrix, currentPoseState.worldFromViewMatrix, currentPoseState.projectionMatrix);
		}
		if (!currentPoseState || !sourcePoseState) {
			results[i] = null;
			continue;
		}
		results[i] = {
			enabledBool: true,
			sourceWorldFromViewMatrix: sourcePoseState.worldFromViewMatrix,
			sourceProjectionParams: sourcePoseState.projectionParams,
			targetViewMatrix: currentPoseState.viewMatrix,
			targetWorldFromViewMatrix: currentPoseState.worldFromViewMatrix
		};
	}
	return results;
};

const resetRuntimeSessionState = function(state) {
	state.frameHandle = null;
	state.xrSession = null;
	state.xrSessionMode = "";
	state.xrEnvironmentBlendMode = "opaque";
	state.xrDepthUsage = "";
	state.xrDepthDataFormat = "";
	state.xrDepthMatchDepthViewBool = false;
	state.depthSensingActiveBool = false;
	state.glBinding = null;
	state.usableDepthAvailableBool = false;
	state.depthProfile = null;
	state.passthroughAvailableBool = false;
	state.baseRefSpace = null;
	state.xrRefSpace = null;
	state.lastRenderTime = 0;
	state.previewLastRenderTime = 0;
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
	const visualizerSourceBackend = options.visualizerSourceBackend || null;
	const visualizerEngine = options.visualizerEngine || null;
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
	const state = {
		gl: null,
		xrSession: null,
		xrSessionMode: "",
		xrEnvironmentBlendMode: "opaque",
		xrDepthUsage: "",
		xrDepthDataFormat: "",
		xrDepthMatchDepthViewBool: false,
		depthSensingActiveBool: false,
		glBinding: null,
		usableDepthAvailableBool: false,
		depthProfile: null,
		passthroughAvailableBool: false,
		xrSupportState: {immersiveArSupportedBool: false, immersiveVrSupportedBool: false, preferredSessionMode: ""},
		baseRefSpace: null,
		xrRefSpace: null,
		frameHandle: null,
		lastRenderTime: 0,
		previewLastRenderTime: 0,
		sceneTimeSeconds: 0,
		audioMetrics: emptyAudioMetrics,
		glbAssetStore: null,
		visualizerSourceBackend: visualizerSourceBackend,
		visualizerEngine: visualizerEngine
	};
	const desktopInput = createDesktopInput({
		desktopMovementState: desktopMovementState,
		mouseSensitivity: inputConfig.desktopMouseSensitivity,
		clampNumber: clampNumber,
		runtimeState: state,
		onPointerLockChange: function(lockedBool) {
			if (lockedBool) {
				menuController.clearDesktopPointerState();
			}
		}
	});
	const buildVisualizerSelectionState = function() {
		if (!state.visualizerEngine || !state.visualizerSourceBackend) {
			return null;
		}
		return {
			modeNames: state.visualizerEngine.state.modeNames.slice(),
			currentModeIndex: state.visualizerEngine.state.currentModeIndex,
			horizontalMirrorBool: !!state.visualizerEngine.state.horizontalMirrorBool,
			presetNames: state.visualizerSourceBackend.state.presetNames.slice(),
			currentPresetIndex: state.visualizerSourceBackend.state.currentPresetIndex
		};
	};
	const buildMenuContentState = function() {
		const visualizerState = buildVisualizerSelectionState() || DEFAULT_VISUALIZER_SELECTION_STATE;
		const lightingState = sceneLighting && sceneLighting.getSelectionState ? sceneLighting.getSelectionState() || DEFAULT_LIGHTING_SELECTION_STATE : DEFAULT_LIGHTING_SELECTION_STATE;
		const audioSourceState = audioController ? audioController.state : {sourceKind: "none", sourceName: ""};
		const menuState = menuController.state;
		const passthroughState = passthroughController ? passthroughController.state : null;
		return {
			sceneTimeSeconds: state.sceneTimeSeconds,
			audioMetrics: state.audioMetrics,
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
			effectSemanticModeKey: passthroughState ? passthroughState.effectSemanticModeKey : PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: getPassthroughEffectSemanticModeLabel(passthroughState ? passthroughState.effectSemanticModeKey : PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT),
			presetNames: visualizerState.presetNames,
			currentPresetIndex: visualizerState.currentPresetIndex,
			xrSessionActiveBool: !!state.xrSession,
			menuOpenBool: !!menuState.menuOpenBool
		};
	};
	const updateDesktopMenuPreview = function(xrSessionActiveOverrideBool) {
		const pointerLockedBool = desktopInput.state.pointerLockedBool;
		const xrSessionActiveBool = xrSessionActiveOverrideBool == null ? !!state.xrSession : xrSessionActiveOverrideBool;
		menuController.updateDesktopPreview({
			xrSessionActiveBool: xrSessionActiveBool,
			pointerLockedBool: pointerLockedBool,
			interactiveBool: !pointerLockedBool && !xrSessionActiveBool,
			renderState: buildMenuContentState()
		});
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
	const updateSceneLighting = function(timeSeconds) {
		if (sceneLighting) {
			sceneLighting.update(timeSeconds, state.audioMetrics);
		}
	};
	const resolveFloorColors = function() {
		if (getFloorColors) {
			return getFloorColors({
				audioMetrics: state.audioMetrics,
				menuState: menuController.state,
				sceneTimeSeconds: state.sceneTimeSeconds
			});
		}
		const audioMetrics = state.audioMetrics;
		const menuState = menuController.state;
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
	const updatePassthroughUiState = function() {
		menuController.setPassthroughState({
			supportedBool: !!state.xrSupportState.immersiveArSupportedBool,
			availableBool: !!state.passthroughAvailableBool,
			sessionMode: state.xrSessionMode,
			environmentBlendMode: state.xrEnvironmentBlendMode
		});
	};
	const syncReadyShellState = function() {
		shell.setXrState({
			statusText: state.xrSupportState.preferredSessionMode ? "ready" : "headset not detected.",
			enterEnabledBool: !!state.xrSupportState.preferredSessionMode,
			exitEnabledBool: false
		});
	};
	const stickDeadzone = inputConfig.stickDeadzone == null ? 0.08 : inputConfig.stickDeadzone;
	const stanceStickDeadzone = inputConfig.stanceStickDeadzone == null ? 0.22 : inputConfig.stanceStickDeadzone;
	const stanceVerticalDominanceMargin = inputConfig.stanceVerticalDominanceMargin == null ? 0.12 : inputConfig.stanceVerticalDominanceMargin;
	const readSourceStickAxes = function(gamepad) {
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
	const updateReferenceSpace = function(viewerTransform) {
		state.xrRefSpace = sessionBridge.createOffsetReferenceSpace(state.baseRefSpace, xrMovementState, viewerTransform);
	};
	const collectPassthroughDepthInfoByView = function(frame, pose) {
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
			ensureDepthUvInverseMatrix(depthInfo);
			depthInfoByView.push(depthInfo);
		}
		return depthInfoByView;
	};
	const applyXrLocomotion = function(delta, pose, frame) {
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
			const stickAxes = readSourceStickAxes(gamepad);
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
		const menuState = menuController.state;
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
			updateReferenceSpace(rawViewerTransform);
		}
	};
	const updateDepthAvailability = function(passthroughDepthInfoByView) {
		let depthFrameKind = "";
		if (state.usableDepthAvailableBool || !passthroughDepthInfoByView.length) {
			return;
		}
		for (let i = 0; i < passthroughDepthInfoByView.length; i += 1) {
			const depthInfo = passthroughDepthInfoByView[i];
			if (!depthInfo || depthInfo.isValid === false) {
				continue;
			}
			if (typeof depthInfo.getDepthInMeters === "function") {
				depthFrameKind = "cpu";
			} else if (depthInfo.texture && depthInfo.textureType === "texture-array") {
				depthFrameKind = "gpu-array";
			} else if (depthInfo.texture) {
				depthFrameKind = "gpu-texture";
			}
			if (!depthFrameKind) {
				continue;
			}
			state.usableDepthAvailableBool = true;
			state.depthProfile = computeRuntimeDepthProfile(depthFrameKind, state.xrDepthDataFormat, depthInfo.rawValueToMeters);
			console.log("[DepthProfile] " + state.depthProfile.label + " linearScale=" + state.depthProfile.linearScale + " nearZ=" + state.depthProfile.nearZ);
			return;
		}
	};
	const dispatchMenuAction = function(action) {
		if (!action || !action.type) {
			return;
		}
		switch (action.type) {
			case "session.exit":
				if (state.xrSession) {
					state.xrSession.end();
				}
				return;
			case "jumpMode.set":
				if (menuController && menuController.setJumpMode) {
					menuController.setJumpMode(action.mode);
				}
				return;
			case "backgroundMixMode.select":
				if (passthroughController && passthroughController.selectMixMode) {
					passthroughController.selectMixMode(action.key);
				}
				return;
			case "passthroughFlashlight.toggle":
				if (passthroughController && passthroughController.toggleFlashlight) {
					passthroughController.toggleFlashlight();
				}
				return;
			case "passthroughDepth.toggle":
				if (passthroughController && passthroughController.toggleDepth) {
					passthroughController.toggleDepth();
				}
				return;
			case "passthroughDepthRadial.toggle":
				if (passthroughController && passthroughController.toggleDepthRadial) {
					passthroughController.toggleDepthRadial();
				}
				return;
			case "passthroughDepthMode.cycle":
				if (passthroughController && passthroughController.cycleDepthMode) {
					passthroughController.cycleDepthMode(action.direction);
				}
				return;
			case "depthEchoReactive.toggle":
				if (passthroughController && passthroughController.toggleDepthEchoReactive) {
					passthroughController.toggleDepthEchoReactive(action.key);
				}
				return;
			case "depthDistanceReactive.toggle":
				if (passthroughController && passthroughController.toggleDepthDistanceReactive) {
					passthroughController.toggleDepthDistanceReactive();
				}
				return;
			case "sceneLightingMode.cycle":
				if (passthroughController && passthroughController.cycleLightingMode) {
					passthroughController.cycleLightingMode(action.direction);
				}
				return;
			case "sceneLightingAnchorMode.cycle":
				if (passthroughController && passthroughController.cycleLightingAnchorMode) {
					passthroughController.cycleLightingAnchorMode(action.direction);
				}
				return;
			case "sceneLightPreset.cycle":
				if (sceneLighting && sceneLighting.cycleEffect) {
					sceneLighting.cycleEffect(action.direction < 0 ? -1 : 1);
				}
				return;
			case "visualizerMode.cycle":
				return cycleVisualizerSelection(action, buildVisualizerSelectionState(), "modeNames", "currentModeIndex", "selectMode", false);
			case "visualizerHorizontalMirror.toggle":
				if (!state.visualizerEngine || !state.visualizerEngine.toggleHorizontalMirror) {
					return resolvedRuntimeActionPromise;
				}
				return state.visualizerEngine.toggleHorizontalMirror();
			case "butterchurnPreset.cycle":
				return cycleVisualizerSelection(action, buildVisualizerSelectionState(), "presetNames", "currentPresetIndex", "selectPreset", true);
			default:
				console.warn("[MenuAction] unknown type:", action.type);
		}
	};
	const dispatchDesktopMenuAction = function(action) {
		if (action && action.type === "butterchurnPreset.cycle") {
			audioController.activate();
		}
		dispatchMenuAction(action);
	};
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
		state.audioMetrics = state.visualizerSourceBackend ? state.visualizerSourceBackend.state.audioMetrics : emptyAudioMetrics;
	};
	const updatePassthroughFrame = function(delta, passthroughPose) {
		if (passthroughController && passthroughController.setDepthAvailability) {
			passthroughController.setDepthAvailability(state.usableDepthAvailableBool);
		}
		if (passthroughController && passthroughController.updateFrame) {
			passthroughController.updateFrame({
				delta: delta,
				audioMetrics: state.audioMetrics,
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
		// Run locomotion before menu input so the reference space is up-to-date
		// when controller rays and menu pose are computed — prevents jitter and ray lag.
		applyXrLocomotion(delta, pose, frame);
		const renderPose = frame.getViewerPose(state.xrRefSpace) || pose;
		menuController.updateXrInput({xrSession: state.xrSession, xrRefSpace: state.xrRefSpace, frame: frame, pose: renderPose, dispatchMenuAction: dispatchMenuAction});
		const passthroughPose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : renderPose;
		if (state.depthSensingActiveBool && state.xrSession && state.xrSession.depthActive === false) {
			try { state.xrSession.resumeDepthSensing(); } catch (e) { console.warn("[Depth] resumeDepthSensing failed:", e.message || e); }
		}
		const passthroughDepthInfoByView = collectPassthroughDepthInfoByView(frame, passthroughPose || renderPose);
		const depthReprojectionByView = buildDepthReprojectionState(passthroughPose || renderPose, passthroughDepthInfoByView, time);
		updateDepthAvailability(passthroughDepthInfoByView);
		updatePassthroughFrame(delta, passthroughPose || renderPose);
		syncVisualizerFrame(renderPose, time * 0.001);
		updateSceneLighting(time * 0.001);
		sceneRenderer.renderXrViews({
			baseLayer: state.xrSession.renderState.baseLayer,
			depthProfile: state.depthProfile,
			pose: renderPose,
			passthroughPose: passthroughPose || renderPose,
			passthroughDepthInfoByView: passthroughDepthInfoByView,
			depthReprojectionByView: depthReprojectionByView,
			eyeDistanceMeters: menuController.state.eyeDistanceMeters,
			visualizerEngine: state.visualizerEngine,
			glbAssetStore: state.glbAssetStore,
			sceneLighting: sceneLighting,
			menuController: menuController,
			passthroughController: passthroughController,
			menuContentState: buildMenuContentState(),
			getReactiveFloorColors: resolveFloorColors,
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
		locomotion.applyDesktopPreviewMovement(desktopMovementState, delta, menuController.state.jumpMode);
		updateSceneLighting(previewTimeSeconds);
		updatePassthroughFrame(delta, null);
		sceneRenderer.renderPreviewFrame({
			previewTimeSeconds: previewTimeSeconds,
			desktopMovementState: desktopMovementState,
			visualizerEngine: state.visualizerEngine,
			glbAssetStore: state.glbAssetStore,
			sceneLighting: sceneLighting,
			menuController: menuController,
			passthroughController: passthroughController,
			menuContentState: buildMenuContentState(),
			getReactiveFloorColors: resolveFloorColors,
			passthroughFallbackBool: true,
			visualizerBackgroundEnabledBool: !!renderPolicy.visualizerBackgroundEnabledBool
		});
		updateDesktopMenuPreview();
		windowRef.requestAnimationFrame(renderPreview);
	};
	const endSession = function() {
		if (state.frameHandle !== null && state.xrSession) {
			state.xrSession.cancelAnimationFrame(state.frameHandle);
		}
		resetRuntimeSessionState(state);
		menuController.endSession();
		updatePassthroughUiState();
		syncReadyShellState();
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
			state.xrDepthMatchDepthViewBool = !!xrState.matchDepthViewBool;
			state.depthSensingActiveBool = !!xrState.depthSensingActiveBool;
			state.glBinding = xrState.glBinding || null;
			state.passthroughAvailableBool = !!xrState.passthroughAvailableBool;
			state.baseRefSpace = xrState.baseRefSpace;
			locomotion.resetXrState(xrMovementState);
			menuController.resetSessionState();
			updatePassthroughUiState();
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
			state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
		} catch (error) {
			shell.setXrState({
				statusText: error.message || "session failed",
				enterEnabledBool: !!state.xrSupportState.preferredSessionMode,
				exitEnabledBool: false
			});
			resetRuntimeSessionState(state);
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
	const bindTabAudioButton = function(button, tabSource, fallbackMessage) {
		if (!button || !tabSource) {
			return;
		}
		bindAsyncButton(button, function() {
			return audioController.requestTabAudio(tabSource);
		}, fallbackMessage);
	};
	const registerEventHandlers = function() {
		desktopInput.registerEventHandlers(documentRef, windowRef);
		menuController.registerDesktopPreviewEvents({
			dispatchMenuAction: dispatchDesktopMenuAction,
			runtimeState: state,
			desktopInputState: desktopInput.state
		});
		if (shell.enterButton) {
			runtimeEventRegistry.on(shell.enterButton, "click", function() {
				if (sessionBridge.availableBool && state.gl && !state.xrSession) {
					audioController.activate();
					startSession();
				}
			});
		}
		bindAsyncButton(shell.audioButton, audioController.requestSharedAudio, "audio capture failed");
		bindTabAudioButton(shell.youtubeAudioButton, tabSources.youtube, "youtube audio failed");
		bindTabAudioButton(shell.youtubeHouseDiscoButton, tabSources.youtubeHouseDisco, "youtube house disco audio failed");
		bindTabAudioButton(shell.sunoLiveRadioButton, tabSources.suno, "suno live radio audio failed");
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
				menuController.setDesktopPreviewVisibleBool(!menuController.state.desktopPreviewVisibleBool);
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
	const start = async function() {
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
		if (state.visualizerEngine && state.visualizerSourceBackend) {
			state.visualizerEngine.init({gl: state.gl, sourceBackend: state.visualizerSourceBackend});
			audioController.setAudioBackend(state.visualizerEngine);
			audioController.activate().catch(function() {});
			applyVisualizerBackgroundComposite(state.visualizerEngine, {alpha: 1, maskCount: 0, masks: []});
		}
		if (!sessionBridge.availableBool) {
			updatePassthroughUiState();
			shell.setXrState({statusText: "WebXR not available.", enterEnabledBool: false, exitEnabledBool: false});
			return;
		}
		state.xrSupportState = await sessionBridge.getSupportState();
		updatePassthroughUiState();
		syncReadyShellState();
		shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
		windowRef.requestAnimationFrame(renderPreview);
	};
	const destroy = function() {
		runtimeEventRegistry.removeAll();
		if (desktopInput && desktopInput.destroy) {
			desktopInput.destroy();
		}
		if (menuController && menuController.destroy) {
			menuController.destroy();
		}
	};
	return {
		start,
		destroy
	};
};
