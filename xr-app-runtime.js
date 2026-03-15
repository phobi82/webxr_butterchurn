(function() {
	// Coordinates session lifecycle, frame loops, browser input, and feature modules as one runtime layer.
	window.createXrAppRuntime = function(options) {
		options = options || {};
		const browser = options.browser || {};
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
		const sharedResources = options.sharedResources || {};
		const factories = options.factories || {};
		const math = options.math || {};
		const sceneMath = options.sceneMath || {};
		const config = options.config || {};
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

		const getAudioMetrics = function() {
			return sharedResources.visualizerRenderer && sharedResources.visualizerRenderer.getAudioMetrics ? sharedResources.visualizerRenderer.getAudioMetrics() : config.emptyAudioMetrics;
		};

		const updateSceneLighting = function(timeSeconds) {
			if (!sharedResources.sceneLighting) {
				return;
			}
			sharedResources.sceneLighting.update(timeSeconds, getAudioMetrics());
		};

		const lerpNumber = function(startValue, endValue, mixValue) {
			return startValue + (endValue - startValue) * mixValue;
		};

		const getAudioReactiveFloorColors = function() {
			const audioMetrics = getAudioMetrics();
			const menuState = menuController.getState();
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
			const offset = math.rotateXZ(-xrMovementState.origin.x, -xrMovementState.origin.z, -xrMovementState.heading);
			state.xrRefSpace = state.baseRefSpace.getOffsetReferenceSpace(new xrRigidTransform(
				{x: offset.x, y: -(xrMovementState.origin.y + xrMovementState.effectiveEyeHeightMeters - xrMovementState.currentBaseEyeHeightMeters), z: offset.z},
				{x: 0, y: Math.sin(-xrMovementState.heading * 0.5), z: 0, w: Math.cos(-xrMovementState.heading * 0.5)}
			));
		};

		const cyclePreset = function(direction) {
			if (!sharedResources.visualizerRenderer) {
				return;
			}
			const presetNames = sharedResources.visualizerRenderer.getPresetNames();
			const presetCount = presetNames.length;
			if (!presetCount) {
				return;
			}
			let nextPresetIndex = sharedResources.visualizerRenderer.getCurrentPresetIndex();
			nextPresetIndex = (nextPresetIndex + direction + presetCount) % presetCount;
			sharedResources.visualizerRenderer.selectPreset(nextPresetIndex);
		};

		const cycleShaderMode = function(direction) {
			if (!sharedResources.visualizerRenderer || !sharedResources.visualizerRenderer.getModeNames || !sharedResources.visualizerRenderer.selectMode) {
				return;
			}
			const shaderModeNames = sharedResources.visualizerRenderer.getModeNames();
			const shaderModeCount = shaderModeNames.length;
			if (!shaderModeCount) {
				return;
			}
			let nextShaderModeIndex = sharedResources.visualizerRenderer.getCurrentModeIndex();
			nextShaderModeIndex = (nextShaderModeIndex + direction + shaderModeCount) % shaderModeCount;
			sharedResources.visualizerRenderer.selectMode(nextShaderModeIndex);
		};

		const cycleLightingPreset = function(direction) {
			if (!sharedResources.sceneLighting) {
				return;
			}
			const lightPresetNames = sharedResources.sceneLighting.getPresetNames();
			const lightPresetCount = lightPresetNames.length;
			if (!lightPresetCount) {
				return;
			}
			let nextLightPresetIndex = sharedResources.sceneLighting.getCurrentPresetIndex();
			nextLightPresetIndex = (nextLightPresetIndex + direction + lightPresetCount) % lightPresetCount;
			sharedResources.sceneLighting.selectPreset(nextLightPresetIndex);
		};

		const xrMenuActionCallbacks = {
			onShaderModeAction: cycleShaderMode,
			onLightPresetAction: cycleLightingPreset,
			onPresetAction: cyclePreset
		};
		const desktopMenuActionCallbacks = {
			onShaderModeAction: cycleShaderMode,
			onLightPresetAction: cycleLightingPreset,
			onPresetAction: function(direction) {
				audioController.activate();
				cyclePreset(direction);
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
					locomotion.moveX = Math.abs(moveAxes.x) > config.stickDeadzone ? moveAxes.x : 0;
					locomotion.moveY = Math.abs(moveAxes.y) > config.stickDeadzone ? moveAxes.y : 0;
					locomotion.sprintActiveBool = !!(gamepad.buttons[0] && gamepad.buttons[0].pressed);
				}
				if (source.handedness === "right") {
					const turnAxes = pickAxes(gamepad, true);
					locomotion.turnX = Math.abs(turnAxes.x) > config.stickDeadzone ? turnAxes.x : 0;
					locomotion.stanceInputY = Math.abs(turnAxes.y) > config.stanceStickDeadzone && Math.abs(turnAxes.y) > Math.abs(turnAxes.x) + config.stanceVerticalDominanceMargin ? -turnAxes.y : 0;
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
			const menuState = menuController.getState();
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
			return {
				sceneTimeSeconds: state.sceneTimeSeconds,
				audioMetrics: getAudioMetrics(),
				shaderModeNames: sharedResources.visualizerRenderer && sharedResources.visualizerRenderer.getModeNames ? sharedResources.visualizerRenderer.getModeNames() : ["toroidal"],
				currentShaderModeIndex: sharedResources.visualizerRenderer && sharedResources.visualizerRenderer.getCurrentModeIndex ? sharedResources.visualizerRenderer.getCurrentModeIndex() : 0,
				lightPresetNames: sharedResources.sceneLighting ? sharedResources.sceneLighting.getPresetNames() : ["Aurora Drift"],
				currentLightPresetIndex: sharedResources.sceneLighting ? sharedResources.sceneLighting.getCurrentPresetIndex() : 0,
				currentLightPresetDescription: sharedResources.sceneLighting ? sharedResources.sceneLighting.getCurrentPresetDescription() : "Slow colorful overhead drift",
				presetNames: sharedResources.visualizerRenderer ? sharedResources.visualizerRenderer.getPresetNames() : ["Preset 1"],
				currentPresetIndex: sharedResources.visualizerRenderer ? sharedResources.visualizerRenderer.getCurrentPresetIndex() : 0
			};
		};

		const updateDesktopMenuPreview = function() {
			menuController.updateDesktopPreview({
				xrSessionActiveBool: !!state.xrSession,
				pointerLockedBool: state.desktopPointerLockedBool,
				interactiveBool: !state.desktopPointerLockedBool && !state.xrSession,
				renderState: getMenuContentState()
			});
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
			if (sharedResources.visualizerRenderer) {
				if (renderPose.transform && renderPose.views.length) {
					sharedResources.visualizerRenderer.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
					sharedResources.visualizerRenderer.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
				}
				sharedResources.visualizerRenderer.update(time * 0.001);
			}
			updateSceneLighting(time * 0.001);
			sceneRenderer.renderXrViews({
				baseLayer: state.xrSession.renderState.baseLayer,
				pose: renderPose,
				eyeDistanceMeters: menuController.getState().eyeDistanceMeters,
				visualizerRenderer: sharedResources.visualizerRenderer,
				glbAssetManager: sharedResources.glbAssetManager,
				sceneLighting: sharedResources.sceneLighting,
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
			locomotionController.applyDesktopPreviewMovement(desktopMovementState, delta, menuController.getState().jumpMode);
			updateSceneLighting(previewTimeSeconds);
			sceneRenderer.renderPreviewFrame({
				previewTimeSeconds: previewTimeSeconds,
				desktopMovementState: desktopMovementState,
				visualizerRenderer: sharedResources.visualizerRenderer,
				glbAssetManager: sharedResources.glbAssetManager,
				sceneLighting: sharedResources.sceneLighting,
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
			if (sharedResources.visualizerRenderer) {
				sharedResources.visualizerRenderer.onSessionEnd();
			}
			xrMovementState.horizontalVelocityX = 0;
			xrMovementState.horizontalVelocityZ = 0;
			updateDesktopMenuPreview();
			windowRef.requestAnimationFrame(renderPreview);
		};

		const startSession = async function() {
			try {
				if (documentRef.pointerLockElement === shell.canvas && documentRef.exitPointerLock) {
					documentRef.exitPointerLock();
				}
				menuController.updateDesktopPreview({
					xrSessionActiveBool: true,
					pointerLockedBool: state.desktopPointerLockedBool,
					interactiveBool: false,
					renderState: getMenuContentState()
				});
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
				menuController.resetSessionInputState();
				updateReferenceSpace();
				shell.setXrState({
					statusText: "session running",
					enterEnabledBool: false,
					exitEnabledBool: true
				});
				state.lastRenderTime = 0;
				if (sharedResources.visualizerRenderer) {
					sharedResources.visualizerRenderer.onSessionStart();
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

		const registerEventHandlers = function() {
			menuController.registerDesktopPreviewEvents({
				callbacks: desktopMenuActionCallbacks,
				getInteractionState: function() {
					return {
						xrSessionActiveBool: !!state.xrSession,
						pointerLockedBool: state.desktopPointerLockedBool
					};
				}
			});

			shell.enterButton.addEventListener("click", function() {
				if (xrApi && state.gl && !state.xrSession) {
					audioController.activate();
					startSession();
				}
			});

			shell.audioButton.addEventListener("click", function() {
				runAudioAction(audioController.requestSharedAudio(), "audio capture failed");
			});

			shell.youtubeAudioButton.addEventListener("click", function() {
				runAudioAction(audioController.requestYoutubePlaylistAudio(), "youtube audio failed");
			});

			shell.sunoLiveRadioButton.addEventListener("click", function() {
				runAudioAction(audioController.requestSunoLiveRadioAudio(), "suno live radio audio failed");
			});

			shell.microphoneButton.addEventListener("click", function() {
				runAudioAction(audioController.requestMicrophoneAudio(), "microphone capture failed");
			});

			shell.debugAudioButton.addEventListener("click", function() {
				runAudioAction(audioController.startDebugAudio(), "debug audio failed");
			});

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
					shell.canvas.width = windowRef.innerWidth * windowRef.devicePixelRatio;
					shell.canvas.height = windowRef.innerHeight * windowRef.devicePixelRatio;
				}
			});

			shell.canvas.addEventListener("click", function() {
				if (!state.xrSession && documentRef.pointerLockElement !== shell.canvas && shell.canvas.requestPointerLock) {
					shell.canvas.requestPointerLock();
				}
			});

			shell.canvas.addEventListener("contextmenu", function(event) {
				if (!state.xrSession) {
					event.preventDefault();
				}
			});

			documentRef.addEventListener("pointerlockchange", function() {
				state.desktopPointerLockedBool = documentRef.pointerLockElement === shell.canvas;
				if (state.desktopPointerLockedBool) {
					menuController.clearDesktopPointerState();
					return;
				}
				desktopMovementState.sprintBool = false;
				desktopMovementState.crouchBool = false;
			});

			documentRef.addEventListener("mousedown", function(event) {
				if (state.xrSession || !state.desktopPointerLockedBool) {
					return;
				}
				if (event.button === 0) {
					desktopMovementState.sprintBool = true;
					event.preventDefault();
				}
				if (event.button === 2) {
					desktopMovementState.crouchBool = true;
					event.preventDefault();
				}
			}, true);

			documentRef.addEventListener("mouseup", function(event) {
				if (event.button === 0) {
					desktopMovementState.sprintBool = false;
				}
				if (event.button === 2) {
					desktopMovementState.crouchBool = false;
				}
				if (state.xrSession || !state.desktopPointerLockedBool) {
					return;
				}
				if (event.button === 0 || event.button === 2) {
					event.preventDefault();
				}
			}, true);

			documentRef.addEventListener("mousemove", function(event) {
				if (!state.desktopPointerLockedBool || state.xrSession) {
					return;
				}
				desktopMovementState.lookYaw += event.movementX * config.desktopMouseSensitivity;
				desktopMovementState.lookPitch = math.clampNumber(desktopMovementState.lookPitch - event.movementY * config.desktopMouseSensitivity, -1.35, 1.35);
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
					menuController.setDesktopPreviewVisibleBool(!menuController.isDesktopPreviewVisible());
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
				if (factories.createSceneLightingController) {
					sharedResources.sceneLighting = factories.createSceneLightingController();
					sharedResources.sceneLighting.update(0, config.emptyAudioMetrics);
				}
				if (factories.createGlbAssetManager) {
					try {
						sharedResources.glbAssetManager = factories.createGlbAssetManager({
							gl: state.gl,
							createProgram: sceneRenderer.createProgram,
							getLightingState: function() {
								return sharedResources.sceneLighting ? sharedResources.sceneLighting.getState() : null;
							},
							getSceneLightingUniformLocations: sceneMath.getSceneLightingUniformLocations,
							applySceneLightingUniforms: sceneMath.applySceneLightingUniforms,
							maxSceneLights: config.maxSceneLights,
							identityMatrix: sceneMath.identityMatrix,
							multiplyMatrices: sceneMath.multiplyMatrices,
							translateRotateYScale: sceneMath.translateRotateYScale,
							setStatus: shell.setStatus
						});
						sharedResources.glbAssetManager.init();
						await sharedResources.glbAssetManager.loadAssets(config.sceneGlbAssets);
					} catch (error) {
						shell.setStatus(error.message || "glb init failed");
					}
				}
				if (factories.createXrVisualizerManager) {
					sharedResources.visualizerRenderer = factories.createXrVisualizerManager();
					sharedResources.visualizerRenderer.init({gl: state.gl});
					audioController.setVisualizerRenderer(sharedResources.visualizerRenderer);
				}
				if (!xrApi) {
					shell.setXrState({
						statusText: "WebXR not available.",
						enterEnabledBool: false,
						exitEnabledBool: false
					});
				} else {
					const supported = await xrApi.isSessionSupported("immersive-vr");
					shell.setXrState({
						statusText: supported ? "ready" : "headset not detected.",
						enterEnabledBool: supported,
						exitEnabledBool: false
					});
				}
				windowRef.requestAnimationFrame(renderPreview);
			}
		};
	};
})();
