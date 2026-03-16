(function() {
	// Coordinates session lifecycle, frame loops, browser input, and feature modules as one runtime layer.
	window.createXrAppRuntime = function(options) {
		options = options || {};
		const services = options.services || {};
		const browser = services.browser || {};
		const windowRef = browser.windowRef || window;
		const documentRef = browser.documentRef || document;
		const xrApi = browser.xrApi || options.xrApi || null;
		const xrWebGLLayer = browser.xrWebGLLayer || windowRef.XRWebGLLayer || null;
		const xrRigidTransform = browser.xrRigidTransform || windowRef.XRRigidTransform || null;
		const shell = options.shell;
		const audioController = options.audioController;
		const locomotionController = options.locomotionController;
		const menuController = options.menuController;
		const sceneRenderer = options.sceneRenderer;
		const resources = services.resources || {};
		resources.scene = resources.scene || {};
		resources.visualizer = resources.visualizer || {};
		const sceneResources = resources.scene;
		const visualizerResources = resources.visualizer;
		const inputConfig = services.input || {};
		const math = services.math || {};
		const sceneServices = services.scene || {};
		const sceneLightingServices = sceneServices.lighting || {};
		const glbAssetServices = sceneServices.glbAssets || {};
		const visualizerServices = services.visualizer || {};
		const fallbackShaderModeNames = ["toroidal"];
		const fallbackLightPresetNames = ["Aurora Drift"];
		const fallbackPresetNames = ["Preset 1"];
		const fallbackLightPresetDescription = "Slow colorful overhead drift";
		const emptyAudioMetrics = sceneServices.emptyAudioMetrics || {};
		const sceneGlbAssets = sceneServices.sceneGlbAssets || [];
		const maxSceneLights = sceneServices.maxSceneLights || 0;
		const xrMovementState = locomotionController.createXrState();
		const desktopMovementState = locomotionController.createDesktopState();
		const state = {
			gl: null,
			xrSession: null,
			baseRefSpace: null,
			xrRefSpace: null,
			frameHandle: null,
			lastRenderTime: 0,
			previewLastRenderTime: 0,
			sceneTimeSeconds: 0,
			desktopPointerLockedBool: false
		};

		const runAudioAction = function(actionPromise, fallbackMessage) {
			actionPromise.catch(function(error) {
				shell.setStatus(error.message || fallbackMessage);
			});
		};

		const getMenuState = function() {
			return menuController.getState();
		};

		const getLightingController = function() {
			return sceneResources.lightingController || null;
		};

		const getVisualizerManager = function() {
			return visualizerResources.manager || null;
		};

		const getAudioMetrics = function() {
			const visualizerManager = getVisualizerManager();
			return visualizerManager && visualizerManager.getAudioMetrics ? visualizerManager.getAudioMetrics() : emptyAudioMetrics;
		};
		const getVisualizerSelectionState = function() {
			const visualizerManager = getVisualizerManager();
			return visualizerManager && visualizerManager.getSelectionState ? visualizerManager.getSelectionState() : null;
		};
		const getLightingSelectionState = function() {
			const lightingController = getLightingController();
			return lightingController && lightingController.getSelectionState ? lightingController.getSelectionState() : null;
		};

		const updateSceneLighting = function(timeSeconds) {
			const lightingController = getLightingController();
			if (!lightingController) {
				return;
			}
			lightingController.update(timeSeconds, getAudioMetrics());
		};

		const lerpNumber = function(startValue, endValue, mixValue) {
			return startValue + (endValue - startValue) * mixValue;
		};

		const getAudioReactiveFloorColors = function() {
			const audioMetrics = getAudioMetrics();
			const menuState = getMenuState();
			const audioLevel = math.clampNumber(audioMetrics.level || 0, 0, 1);
			const audioPeak = math.clampNumber(audioMetrics.peak || 0, 0, 1);
			const beatPulse = math.clampNumber(audioMetrics.beatPulse || 0, 0, 1);
			const transientLevel = math.clampNumber(audioMetrics.transient || 0, 0, 1);
			const baseHue = (state.sceneTimeSeconds * 0.03) % 1;
			const floorDrive = math.clampNumber(audioLevel * 0.72 + audioPeak * 0.28 + beatPulse * 0.4, 0, 1);
			const floorRgb = math.hslToRgb((baseHue + beatPulse * 0.03) % 1, lerpNumber(0.45, 0.98, floorDrive), lerpNumber(0.26, 0.66, floorDrive));
			const gridRgb = math.hslToRgb((baseHue + 0.08 + beatPulse * 0.05) % 1, lerpNumber(0.55, 1, floorDrive), lerpNumber(0.48, 0.82, math.clampNumber(floorDrive + transientLevel, 0, 1)));
			return {
				audioLevel: audioLevel,
				audioPeak: audioPeak,
				beatPulse: beatPulse,
				transient: transientLevel,
				floor: [floorRgb[0], floorRgb[1], floorRgb[2], menuState.floorAlpha],
				grid: [gridRgb[0], gridRgb[1], gridRgb[2], math.clampNumber(lerpNumber(menuState.floorAlpha * 0.72, menuState.floorAlpha, math.clampNumber(audioLevel * 0.85 + beatPulse * 0.35, 0, 1)), 0, 1)]
			};
		};

		const updateReferenceSpace = function() {
			if (!state.baseRefSpace) {
				return;
			}
			// XR origin offsets keep locomotion in app space while the headset still runs in local-floor space.
			const offset = math.rotateXZ(-xrMovementState.origin.x, -xrMovementState.origin.z, -xrMovementState.heading);
			state.xrRefSpace = state.baseRefSpace.getOffsetReferenceSpace(new xrRigidTransform(
				{x: offset.x, y: -(xrMovementState.origin.y + xrMovementState.effectiveEyeHeightMeters - xrMovementState.currentBaseEyeHeightMeters), z: offset.z},
				{x: 0, y: Math.sin(-xrMovementState.heading * 0.5), z: 0, w: Math.cos(-xrMovementState.heading * 0.5)}
			));
		};

		const cyclePreset = function(direction) {
			const visualizerManager = getVisualizerManager();
			if (!visualizerManager) {
				return;
			}
			const visualizerSelectionState = getVisualizerSelectionState();
			const presetCount = visualizerSelectionState ? visualizerSelectionState.presetNames.length : 0;
			if (!presetCount) {
				return;
			}
			let nextPresetIndex = visualizerSelectionState.currentPresetIndex;
			nextPresetIndex = (nextPresetIndex + direction + presetCount) % presetCount;
			visualizerManager.selectPreset(nextPresetIndex);
		};

		const cycleShaderMode = function(direction) {
			const visualizerManager = getVisualizerManager();
			if (!visualizerManager || !visualizerManager.selectMode) {
				return;
			}
			const visualizerSelectionState = getVisualizerSelectionState();
			const shaderModeCount = visualizerSelectionState ? visualizerSelectionState.modeNames.length : 0;
			if (!shaderModeCount) {
				return;
			}
			let nextShaderModeIndex = visualizerSelectionState.currentModeIndex;
			nextShaderModeIndex = (nextShaderModeIndex + direction + shaderModeCount) % shaderModeCount;
			visualizerManager.selectMode(nextShaderModeIndex);
		};

		const cycleLightingPreset = function(direction) {
			const lightingController = getLightingController();
			if (!lightingController) {
				return;
			}
			const lightingSelectionState = getLightingSelectionState();
			const lightPresetCount = lightingSelectionState ? lightingSelectionState.presetNames.length : 0;
			if (!lightPresetCount) {
				return;
			}
			let nextLightPresetIndex = lightingSelectionState.currentPresetIndex;
			nextLightPresetIndex = (nextLightPresetIndex + direction + lightPresetCount) % lightPresetCount;
			lightingController.selectPreset(nextLightPresetIndex);
		};

		const xrMenuActionCallbacks = {
			onShaderModeAction: cycleShaderMode,
			onLightPresetAction: cycleLightingPreset,
			onPresetAction: cyclePreset
		};
		const cyclePresetFromDesktop = function(direction) {
			audioController.activate();
			cyclePreset(direction);
		};
		const desktopMenuActionCallbacks = {
			onShaderModeAction: cycleShaderMode,
			onLightPresetAction: cycleLightingPreset,
			onPresetAction: cyclePresetFromDesktop
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
			const locomotion = {
				moveX: 0,
				moveY: 0,
				turnX: 0,
				stanceInputY: 0,
				jumpRequestBool: false,
				airBoostActiveBool: false,
				rightControllerBoostDir: null,
				sprintActiveBool: false
			};
			const sources = state.xrSession ? state.xrSession.inputSources || [] : [];
			for (let i = 0; i < sources.length; i += 1) {
				const source = sources[i];
				const gamepad = source.gamepad;
				if (!gamepad || !gamepad.axes || gamepad.axes.length < 2) {
					continue;
				}
				if (source.handedness === "left") {
					const moveAxes = pickAxes(gamepad, false);
					locomotion.moveX = Math.abs(moveAxes.x) > inputConfig.stickDeadzone ? moveAxes.x : 0;
					locomotion.moveY = Math.abs(moveAxes.y) > inputConfig.stickDeadzone ? moveAxes.y : 0;
					locomotion.sprintActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
				}
				if (source.handedness === "right") {
					const turnAxes = pickAxes(gamepad, true);
					locomotion.turnX = Math.abs(turnAxes.x) > inputConfig.stickDeadzone ? turnAxes.x : 0;
					locomotion.stanceInputY = Math.abs(turnAxes.y) > inputConfig.stanceStickDeadzone && Math.abs(turnAxes.y) > Math.abs(turnAxes.x) + inputConfig.stanceVerticalDominanceMargin ? -turnAxes.y : 0;
					locomotion.jumpRequestBool = !!(gamepad.buttons[4] && gamepad.buttons[4].pressed);
					locomotion.airBoostActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
					const targetRayPose = state.xrRefSpace ? frame.getPose(source.targetRaySpace, state.xrRefSpace) : null;
					if (targetRayPose) {
						locomotion.rightControllerBoostDir = math.extractForwardDirectionFromQuaternion(targetRayPose.transform.orientation);
					}
				}
			}
			return locomotion;
		};

		const updateMenuInput = function(frame, pose) {
			menuController.updateXrInput({
				xrSession: state.xrSession,
				xrRefSpace: state.xrRefSpace,
				frame: frame,
				pose: pose,
				callbacks: xrMenuActionCallbacks
			});
		};

		const applyLocomotion = function(delta, pose, frame) {
			if (!state.xrSession || !pose || !frame) {
				return;
			}
			const basePose = state.baseRefSpace ? frame.getViewerPose(state.baseRefSpace) : null;
			const viewerTransform = basePose ? basePose.transform : pose.transform;
			const menuState = getMenuState();
			const locomotionStep = locomotionController.applyXrLocomotion(xrMovementState, {
				delta: delta,
				viewerTransform: viewerTransform,
				turnAnchorPosition: basePose ? viewerTransform.position : null,
				locomotion: readLocomotionInput(frame),
				jumpMode: menuState.jumpMode,
				menuOpenBool: menuState.menuOpenBool
			});
			if (locomotionStep.referenceSpaceUpdateNeededBool) {
				updateReferenceSpace();
			}
		};

		const getMenuContentState = function() {
			const visualizerSelectionState = getVisualizerSelectionState();
			const lightingSelectionState = getLightingSelectionState();
			return {
				sceneTimeSeconds: state.sceneTimeSeconds,
				audioMetrics: getAudioMetrics(),
				shaderModeNames: visualizerSelectionState ? visualizerSelectionState.modeNames : fallbackShaderModeNames,
				currentShaderModeIndex: visualizerSelectionState ? visualizerSelectionState.currentModeIndex : 0,
				lightPresetNames: lightingSelectionState ? lightingSelectionState.presetNames : fallbackLightPresetNames,
				currentLightPresetIndex: lightingSelectionState ? lightingSelectionState.currentPresetIndex : 0,
				currentLightPresetDescription: lightingSelectionState ? lightingSelectionState.currentPresetDescription : fallbackLightPresetDescription,
				presetNames: visualizerSelectionState ? visualizerSelectionState.presetNames : fallbackPresetNames,
				currentPresetIndex: visualizerSelectionState ? visualizerSelectionState.currentPresetIndex : 0
			};
		};

		const getDesktopMenuInteractionState = function() {
			return {
				xrSessionActiveBool: !!state.xrSession,
				pointerLockedBool: state.desktopPointerLockedBool
			};
		};

		const updateDesktopMenuPreview = function(xrSessionActiveOverrideBool) {
			const interactionState = getDesktopMenuInteractionState();
			const xrSessionActiveBool = xrSessionActiveOverrideBool == null ? interactionState.xrSessionActiveBool : xrSessionActiveOverrideBool;
			menuController.updateDesktopPreview({
				xrSessionActiveBool: xrSessionActiveBool,
				pointerLockedBool: interactionState.pointerLockedBool,
				interactiveBool: !interactionState.pointerLockedBool && !xrSessionActiveBool,
				renderState: getMenuContentState()
			});
		};

		const isDesktopPointerLockInputActive = function() {
			return state.desktopPointerLockedBool && !state.xrSession;
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
			updateMenuInput(frame, renderPose);
			const visualizerManager = getVisualizerManager();
			if (visualizerManager) {
				if (renderPose.transform && renderPose.views.length) {
					visualizerManager.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
					visualizerManager.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
				}
				visualizerManager.update(time * 0.001);
			}
			updateSceneLighting(time * 0.001);
			sceneRenderer.renderXrViews({
				baseLayer: state.xrSession.renderState.baseLayer,
				pose: renderPose,
				eyeDistanceMeters: getMenuState().eyeDistanceMeters,
				visualizerManager: visualizerManager,
				glbAssetManager: sceneResources.assetManager,
				sceneLighting: getLightingController(),
				menuController: menuController,
				menuContentState: getMenuContentState(),
				getReactiveFloorColors: getAudioReactiveFloorColors
			});
		};

		const renderPreview = function(time) {
			if (state.xrSession) {
				return;
			}
			const previewTimeSeconds = time * 0.001;
			const delta = state.previewLastRenderTime === 0 ? 0 : Math.min(0.05, Math.max(0, previewTimeSeconds - state.previewLastRenderTime));
			state.previewLastRenderTime = previewTimeSeconds;
			state.sceneTimeSeconds = previewTimeSeconds;
			locomotionController.applyDesktopPreviewMovement(desktopMovementState, delta, getMenuState().jumpMode);
			updateSceneLighting(previewTimeSeconds);
			sceneRenderer.renderPreviewFrame({
				previewTimeSeconds: previewTimeSeconds,
				desktopMovementState: desktopMovementState,
				visualizerManager: getVisualizerManager(),
				glbAssetManager: sceneResources.assetManager,
				sceneLighting: getLightingController(),
				menuController: menuController,
				menuContentState: getMenuContentState(),
				getReactiveFloorColors: getAudioReactiveFloorColors
			});
			updateDesktopMenuPreview();
			windowRef.requestAnimationFrame(renderPreview);
		};

		const endSession = function() {
			if (state.frameHandle !== null && state.xrSession) {
				state.xrSession.cancelAnimationFrame(state.frameHandle);
			}
			state.frameHandle = null;
			state.xrSession = null;
			state.baseRefSpace = null;
			state.xrRefSpace = null;
			state.lastRenderTime = 0;
			state.previewLastRenderTime = 0;
			menuController.endSession();
			shell.setXrState({
				statusText: xrApi ? "ready" : "headset not detected.",
				enterEnabledBool: !!xrApi,
				exitEnabledBool: false
			});
			const visualizerManager = getVisualizerManager();
			if (visualizerManager) {
				visualizerManager.endSession();
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
				state.xrSession = await xrApi.requestSession("immersive-vr", {requiredFeatures: ["local-floor"]});
				state.xrSession.addEventListener("end", endSession);
				await state.gl.makeXRCompatible();
				let framebufferScaleFactor = 1;
				if (xrWebGLLayer && typeof xrWebGLLayer.getNativeFramebufferScaleFactor === "function") {
					framebufferScaleFactor = xrWebGLLayer.getNativeFramebufferScaleFactor(state.xrSession) || 1;
				}
				state.xrSession.updateRenderState({
					baseLayer: new xrWebGLLayer(state.xrSession, state.gl, {
						framebufferScaleFactor: framebufferScaleFactor
					})
				});
				state.baseRefSpace = await state.xrSession.requestReferenceSpace("local-floor");
				locomotionController.resetXrState(xrMovementState);
				menuController.resetSessionState();
				updateReferenceSpace();
				shell.setXrState({
					statusText: "session running",
					enterEnabledBool: false,
					exitEnabledBool: true
				});
				state.lastRenderTime = 0;
				const visualizerManager = getVisualizerManager();
				if (visualizerManager) {
					visualizerManager.startSession();
				}
				state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
			} catch (error) {
				shell.setXrState({
					statusText: error.message || "session failed",
					enterEnabledBool: !!xrApi,
					exitEnabledBool: false
				});
				state.xrSession = null;
				updateDesktopMenuPreview();
			}
		};

		const setDesktopMovementKeyState = function(code, pressedBool) {
			if (code === "KeyW") {
				desktopMovementState.moveForwardBool = pressedBool;
				return true;
			}
			if (code === "KeyS") {
				desktopMovementState.moveBackwardBool = pressedBool;
				return true;
			}
			if (code === "KeyA") {
				desktopMovementState.moveLeftBool = pressedBool;
				return true;
			}
			if (code === "KeyD") {
				desktopMovementState.moveRightBool = pressedBool;
				return true;
			}
			if (code === "Space") {
				desktopMovementState.jumpHeldBool = pressedBool;
				return true;
			}
			return false;
		};

		const releaseDesktopMovementKeys = function() {
			desktopMovementState.moveForwardBool = false;
			desktopMovementState.moveBackwardBool = false;
			desktopMovementState.moveLeftBool = false;
			desktopMovementState.moveRightBool = false;
			desktopMovementState.sprintBool = false;
			desktopMovementState.crouchBool = false;
			desktopMovementState.jumpHeldBool = false;
		};

		const setDesktopPointerModifierState = function(event, pressedBool) {
			if (!isDesktopPointerLockInputActive()) {
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

		const bindAsyncButton = function(button, action, fallbackMessage) {
			button.addEventListener("click", function() {
				runAudioAction(action(), fallbackMessage);
			});
		};

		const registerEventHandlers = function() {
			menuController.registerDesktopPreviewEvents({
				callbacks: desktopMenuActionCallbacks,
				getInteractionState: getDesktopMenuInteractionState
			});

			shell.enterButton.addEventListener("click", function() {
				if (xrApi && state.gl && !state.xrSession) {
					audioController.activate();
					startSession();
				}
			});

			bindAsyncButton(shell.audioButton, audioController.requestSharedAudio, "audio capture failed");
			bindAsyncButton(shell.youtubeAudioButton, audioController.requestYoutubePlaylistAudio, "youtube audio failed");
			bindAsyncButton(shell.sunoLiveRadioButton, audioController.requestSunoLiveRadioAudio, "suno live radio audio failed");
			bindAsyncButton(shell.microphoneButton, audioController.requestMicrophoneAudio, "microphone capture failed");
			bindAsyncButton(shell.debugAudioButton, audioController.startDebugAudio, "debug audio failed");

			shell.stopAudioButton.addEventListener("click", function() {
				audioController.stop();
			});

			shell.exitButton.addEventListener("click", function() {
				if (state.xrSession) {
					state.xrSession.end();
				}
			});

			windowRef.addEventListener("resize", function() {
				if (!state.xrSession) {
					shell.syncCanvasToViewport({
						width: windowRef.innerWidth,
						height: windowRef.innerHeight,
						pixelRatio: windowRef.devicePixelRatio
					});
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

			documentRef.addEventListener("pointerlockchange", function() {
				state.desktopPointerLockedBool = shell.isCanvasPointerLocked(documentRef);
				if (state.desktopPointerLockedBool) {
					menuController.clearDesktopPointerState();
					return;
				}
				desktopMovementState.sprintBool = false;
				desktopMovementState.crouchBool = false;
			});

			documentRef.addEventListener("mousedown", function(event) {
				setDesktopPointerModifierState(event, true);
			}, true);

			documentRef.addEventListener("mouseup", function(event) {
				setDesktopPointerModifierState(event, false);
			}, true);

			documentRef.addEventListener("mousemove", function(event) {
				if (!isDesktopPointerLockInputActive()) {
					return;
				}
				desktopMovementState.lookYaw += event.movementX * inputConfig.desktopMouseSensitivity;
				desktopMovementState.lookPitch = math.clampNumber(desktopMovementState.lookPitch - event.movementY * inputConfig.desktopMouseSensitivity, -1.35, 1.35);
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
					menuController.setDesktopPreviewVisibleBool(!getMenuState().desktopPreviewVisibleBool);
					event.preventDefault();
					return;
				}
				if (setDesktopMovementKeyState(event.code, true)) {
					event.preventDefault();
				}
			});

			documentRef.addEventListener("keyup", function(event) {
				if (setDesktopMovementKeyState(event.code, false)) {
					event.preventDefault();
				}
			});

			documentRef.addEventListener("mouseup", function() {
				menuController.handleDesktopPointerUp();
			});

			windowRef.addEventListener("blur", function() {
				releaseDesktopMovementKeys();
				menuController.clearDesktopPointerState();
			});
		};

		return {
			init: async function() {
				registerEventHandlers();
				state.gl = sceneRenderer.init();
				if (!state.gl) {
					return;
				}
				locomotionController.resetDesktopState(desktopMovementState);
				if (sceneLightingServices.createController) {
					sceneResources.lightingController = sceneLightingServices.createController();
					sceneResources.lightingController.update(0, emptyAudioMetrics);
				}
				if (glbAssetServices.createManager) {
					try {
						sceneResources.assetManager = glbAssetServices.createManager({
							gl: state.gl,
							fetchFn: glbAssetServices.fetchFn,
							createImageBitmapFn: glbAssetServices.createImageBitmapFn,
							imageCtor: glbAssetServices.imageCtor,
							blobCtor: glbAssetServices.blobCtor,
							textDecoderCtor: glbAssetServices.textDecoderCtor,
							urlApi: glbAssetServices.urlApi,
							createProgram: sceneRenderer.createProgram,
							getLightingState: function() {
								return sceneResources.lightingController ? sceneResources.lightingController.getState() : null;
							},
							getSceneLightingUniformLocations: sceneLightingServices.getUniformLocations,
							applySceneLightingUniforms: sceneLightingServices.applyUniforms,
							maxSceneLights: maxSceneLights,
							identityMatrix: glbAssetServices.identityMatrix,
							multiplyMatrices: glbAssetServices.multiplyMatrices,
							translateRotateYScale: glbAssetServices.translateRotateYScale,
							setStatus: shell.setStatus
						});
						sceneResources.assetManager.init();
						await sceneResources.assetManager.loadAssets(sceneGlbAssets);
					} catch (error) {
						shell.setStatus(error.message || "glb init failed");
					}
				}
				if (visualizerServices.createManager) {
					visualizerResources.manager = visualizerServices.createManager({
						createVisualizerSource: visualizerServices.createVisualizerSource,
						getModeNames: visualizerServices.getModeNames,
						visualizerSourceOptions: visualizerServices.visualizerSourceOptions
					});
					visualizerResources.manager.init({gl: state.gl});
					audioController.setVisualizerManager(visualizerResources.manager);
				}
				if (!xrApi) {
					shell.setXrState({
						statusText: "WebXR not available.",
						enterEnabledBool: false,
						exitEnabledBool: false
					});
				} else {
					const supportedBool = await xrApi.isSessionSupported("immersive-vr");
					shell.setXrState({
						statusText: supportedBool ? "ready" : "headset not detected.",
						enterEnabledBool: supportedBool,
						exitEnabledBool: false
					});
				}
				shell.syncCanvasToViewport({
					width: windowRef.innerWidth,
					height: windowRef.innerHeight,
					pixelRatio: windowRef.devicePixelRatio
				});
				windowRef.requestAnimationFrame(renderPreview);
			}
		};
	};
})();
