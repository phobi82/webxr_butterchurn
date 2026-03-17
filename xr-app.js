// core/visualizer/fullscreen-texture-mode.js
const createFullscreenTextureMode = function(spec) {
	spec = spec || {};
	return {
		gl: null,
		sourceBackend: null,
		programInfo: null,
		positionBuffer: null,
		sourceTexture: null,
		lastUploadedCanvasVersion: -1,
		lastUploadedWidth: 0,
		lastUploadedHeight: 0,
		lastPreparedTimeSeconds: -1,
		lastPreparedWidth: 0,
		lastPreparedHeight: 0,
		init: function(options) {
			this.gl = options.gl;
			this.sourceBackend = options.sourceBackend;
			this.programInfo = createFullscreenProgramInfo(this.gl, spec.fragmentSource, !!spec.includeAudioUniformsBool, spec.label || "Visualizer mode");
			this.positionBuffer = createFullscreenTriangleBuffer(this.gl);
			this.sourceTexture = this.gl.createTexture();
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
		},
		uploadSourceTexture: function(sourceCanvas) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
			this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
		},
		update: function() {
		},
		onPresetChanged: function() {
			this.lastUploadedCanvasVersion = -1;
			this.lastPreparedTimeSeconds = -1;
		},
		onAudioChanged: function() {
			this.lastUploadedCanvasVersion = -1;
			this.lastPreparedTimeSeconds = -1;
		},
		prepareSourceFrame: function(width, height, timeSeconds) {
			this.sourceBackend.ensureCanvasSize(width, height);
			this.sourceBackend.advanceFrame(timeSeconds);
			if (this.lastPreparedTimeSeconds === timeSeconds && width === this.lastPreparedWidth && height === this.lastPreparedHeight) {
				return this.sourceBackend.getState();
			}
			this.sourceBackend.renderCanvas(timeSeconds);
			this.lastPreparedTimeSeconds = timeSeconds;
			this.lastPreparedWidth = width;
			this.lastPreparedHeight = height;
			return this.sourceBackend.getState();
		},
		drawPreScene: function(sourceState, frameState) {
			const viewport = this.gl.getParameter(this.gl.VIEWPORT);
			const width = viewport[2];
			const height = viewport[3];
			sourceState = this.prepareSourceFrame(width, height, frameState.timeSeconds);
			const sourceCanvas = sourceState.textureSource;
			if (!sourceCanvas) {
				return;
			}
			if (sourceState.canvasRenderVersion !== this.lastUploadedCanvasVersion || width !== this.lastUploadedWidth || height !== this.lastUploadedHeight) {
				this.uploadSourceTexture(sourceCanvas);
				this.lastUploadedCanvasVersion = sourceState.canvasRenderVersion;
				this.lastUploadedWidth = width;
				this.lastUploadedHeight = height;
			}
			const orientationOffset = spec.getOrientationOffset ? spec.getOrientationOffset(sourceState, frameState) : {x: 0, y: 0};
			this.gl.disable(this.gl.DEPTH_TEST);
			this.gl.disable(this.gl.CULL_FACE);
			this.gl.useProgram(this.programInfo.program);
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
			this.gl.enableVertexAttribArray(this.programInfo.positionLoc);
			this.gl.vertexAttribPointer(this.programInfo.positionLoc, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.activeTexture(this.gl.TEXTURE0);
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.uniform1i(this.programInfo.sourceTextureLoc, 0);
			this.gl.uniform2f(this.programInfo.viewportSizeLoc, width, height);
			this.gl.uniform2f(this.programInfo.eyeCenterOffsetLoc, frameState.eyeCenterOffsetX, frameState.eyeCenterOffsetY);
			this.gl.uniform2f(this.programInfo.orientationOffsetLoc, orientationOffset.x, orientationOffset.y);
			if (this.programInfo.audioMetricsLoc) {
				const audioMetrics = sourceState.audioMetrics || {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
				this.gl.uniform4f(this.programInfo.audioMetricsLoc, audioMetrics.level, audioMetrics.peak, audioMetrics.bass, audioMetrics.transient);
			}
			if (this.programInfo.beatPulseLoc) {
				this.gl.uniform1f(this.programInfo.beatPulseLoc, sourceState.audioMetrics ? sourceState.audioMetrics.beatPulse : 0);
			}
			if (spec.applyUniforms) {
				spec.applyUniforms(this.gl, this.programInfo, sourceState, frameState);
			}
			this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
			this.gl.enable(this.gl.DEPTH_TEST);
			this.gl.enable(this.gl.CULL_FACE);
		}
	};
};

// core/visualizer/engine.js
const createVisualizerEngine = function(options) {
	const createSourceBackend = options.createSourceBackend;
	const modeDefinitions = options.modes || [];
	const frameState = {
		timeSeconds: 0,
		headYaw: 0,
		headPitch: 0,
		headHorizontalFov: Math.PI / 2,
		headVerticalFov: Math.PI / 2,
		headPositionX: 0,
		headPositionY: 0,
		headPositionZ: 0,
		eyeCenterOffsetX: 0,
		eyeCenterOffsetY: 0,
		viewMatrix: new Float32Array(16),
		projMatrix: new Float32Array(16),
		lastRawHeadYaw: undefined
	};
	const setHeadYaw = function(rawYaw) {
		if (frameState.lastRawHeadYaw === undefined) {
			frameState.headYaw = rawYaw;
		} else {
			frameState.headYaw = unwrapAngle(rawYaw, frameState.lastRawHeadYaw) + (frameState.headYaw - frameState.lastRawHeadYaw);
		}
		frameState.lastRawHeadYaw = rawYaw;
	};
	const setProjectionState = function(projectionMatrix) {
		frameState.projMatrix.set(projectionMatrix);
		frameState.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
		frameState.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
	};
	const engine = {
		gl: null,
		sourceBackend: null,
		modeNames: [],
		modes: {},
		currentModeIndex: 0,
		init: function(args) {
			this.gl = args.gl;
			this.sourceBackend = createSourceBackend(args.sourceBackendOptions || null);
			this.sourceBackend.init(1, 1);
			this.modeNames = [];
			this.modes = {};
			for (let i = 0; i < modeDefinitions.length; i += 1) {
				const definition = modeDefinitions[i];
				const mode = definition.create({gl: this.gl, sourceBackend: this.sourceBackend});
				if (!mode) {
					continue;
				}
				if (mode.init) {
					mode.init({gl: this.gl, sourceBackend: this.sourceBackend});
				}
				this.modeNames.push(definition.name);
				this.modes[definition.name] = mode;
			}
			if (this.currentModeIndex >= this.modeNames.length) {
				this.currentModeIndex = 0;
			}
		},
		update: function(timeSeconds) {
			frameState.timeSeconds = timeSeconds;
			this.sourceBackend.advanceFrame(timeSeconds);
			const mode = getActiveMode();
			if (mode && mode.update) {
				mode.update(getSourceState(), frameState);
			}
		},
		setRenderView: function(viewMatrix, projectionMatrix) {
			frameState.viewMatrix.set(viewMatrix);
			setProjectionState(projectionMatrix);
		},
		setPreviewView: function(viewMatrix, projectionMatrix) {
			const forwardAngles = extractForwardYawPitch(viewMatrix);
			const cameraPosition = extractCameraPositionFromViewMatrix(viewMatrix);
			const fov = extractProjectionFov(projectionMatrix);
			this.setRenderView(viewMatrix, projectionMatrix);
			setHeadYaw(forwardAngles.yaw);
			frameState.headPitch = forwardAngles.pitch;
			frameState.headPositionX = cameraPosition.x;
			frameState.headPositionY = cameraPosition.y;
			frameState.headPositionZ = cameraPosition.z;
			frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
			frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
		},
		setHeadPoseFromQuaternion: function(quaternion, projectionMatrix) {
			const forwardAngles = extractForwardYawPitchFromQuaternion(quaternion);
			const fov = extractProjectionFov(projectionMatrix);
			setHeadYaw(forwardAngles.yaw);
			frameState.headPitch = forwardAngles.pitch;
			frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
			frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
			setProjectionState(projectionMatrix);
		},
		setHeadPosition: function(x, y, z) {
			frameState.headPositionX = x;
			frameState.headPositionY = y;
			frameState.headPositionZ = z;
		},
		drawPreScene: function() {
			drawPhase("drawPreScene");
		},
		drawWorld: function() {
			drawPhase("drawWorld");
		},
		drawPostScene: function() {
			drawPhase("drawPostScene");
		},
		setAudioStream: function(stream) {
			this.sourceBackend.setAudioStream(stream);
			notifyModes("onAudioChanged");
		},
		startDebugAudio: async function() {
			await this.sourceBackend.startDebugAudio();
			notifyModes("onAudioChanged");
		},
		activateAudio: function() {
			return this.sourceBackend.activate();
		},
		getAudioMetrics: function() {
			return this.sourceBackend.getAudioMetrics ? this.sourceBackend.getAudioMetrics() : emptyAudioMetrics;
		},
		getSelectionState: function() {
			return {
				modeNames: this.modeNames.slice(),
				currentModeIndex: this.currentModeIndex,
				presetNames: this.sourceBackend.getPresetNames(),
				currentPresetIndex: this.sourceBackend.getCurrentPresetIndex()
			};
		},
		selectPreset: async function(index) {
			await this.sourceBackend.selectPreset(index, 1.2);
			this.sourceBackend.lastCanvasRenderTimeSeconds = 0;
			notifyModes("onPresetChanged");
		},
		selectMode: function(index) {
			if (!this.modeNames.length) {
				return Promise.resolve();
			}
			this.currentModeIndex = (index + this.modeNames.length) % this.modeNames.length;
			return Promise.resolve();
		},
		startSession: function() {
			this.sourceBackend.startSession();
			notifyModes("onSessionStart");
		},
		endSession: function() {
			this.sourceBackend.endSession();
			notifyModes("onSessionEnd");
		}
	};
	const getSourceState = function() {
		return engine.sourceBackend.getState();
	};
	const getActiveMode = function() {
		return engine.modes[engine.modeNames[engine.currentModeIndex]] || null;
	};
	const notifyModes = function(methodName) {
		const sourceState = getSourceState();
		for (let i = 0; i < engine.modeNames.length; i += 1) {
			const mode = engine.modes[engine.modeNames[i]];
			if (mode && mode[methodName]) {
				mode[methodName](sourceState, frameState);
			}
		}
	};
	const drawPhase = function(methodName) {
		const mode = getActiveMode();
		if (!mode || !mode[methodName]) {
			return;
		}
		mode[methodName](getSourceState(), frameState);
	};
	return engine;
};

// adapters/butterchurn-source.js
const defaultPresetName = "martin - mucus cervix";

const createButterchurnSource = function(options) {
	options = options || {};
	const windowRef = options.windowRef || window;
	const documentRef = options.documentRef || document;
	const audioContextCtor = options.audioContextCtor || windowRef.AudioContext || windowRef.webkitAudioContext;
	const butterchurnApi = options.butterchurnApi || (windowRef.butterchurn && windowRef.butterchurn.createVisualizer ? windowRef.butterchurn : windowRef.butterchurn && windowRef.butterchurn.default && windowRef.butterchurn.default.createVisualizer ? windowRef.butterchurn.default : null);
	const butterchurnPresetsApi = options.butterchurnPresetsApi || (windowRef.butterchurnPresets && windowRef.butterchurnPresets.getPresets ? windowRef.butterchurnPresets : windowRef.butterchurnPresets && windowRef.butterchurnPresets.default && windowRef.butterchurnPresets.default.getPresets ? windowRef.butterchurnPresets.default : null);
	const createCanvasElement = function(width, height) {
		const canvas = documentRef.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.style.display = "none";
		return canvas;
	};
	const audioAnalyser = createAudioAnalyser();
	return {
		canvas: null,
		visualizer: null,
		audioContext: null,
		audioNode: null,
		audioStream: null,
		audioSourceKind: "none",
		activatedBool: false,
		presetNames: [],
		presetMap: {},
		currentPresetIndex: 0,
		currentWidth: 0,
		currentHeight: 0,
		currentTimeSeconds: 0,
		lastCanvasRenderTimeSeconds: 0,
		presetVersion: 0,
		audioVersion: 0,
		canvasRenderVersion: 0,
		init: function(width, height) {
			this.canvas = createCanvasElement(width, height);
			this.currentWidth = width;
			this.currentHeight = height;
			this.presetMap = butterchurnPresetsApi ? butterchurnPresetsApi.getPresets() : {};
			this.presetNames = Object.keys(this.presetMap).sort();
			this.currentPresetIndex = Math.max(0, this.presetNames.indexOf(defaultPresetName));
			this.presetVersion = 1;
		},
		advanceFrame: function(timeSeconds) {
			this.currentTimeSeconds = typeof timeSeconds === "number" ? timeSeconds : 0;
			audioAnalyser.advanceFrame(this.currentTimeSeconds);
		},
		activate: function() {
			if (!butterchurnApi || !this.presetNames.length || this.activatedBool) {
				if (this.audioContext && this.audioContext.state === "suspended") {
					return this.audioContext.resume().catch(function() {});
				}
				return Promise.resolve();
			}
			this.audioContext = new audioContextCtor();
			this.visualizer = butterchurnApi.createVisualizer(this.audioContext, this.canvas, {
				width: this.currentWidth,
				height: this.currentHeight,
				meshWidth: 32,
				meshHeight: 24,
				pixelRatio: 1,
				textureRatio: 1
			});
			this.activatedBool = true;
			this.visualizer.setOutputAA(false);
			this.visualizer.setRendererSize(this.currentWidth, this.currentHeight, {meshWidth: 32, meshHeight: 24, pixelRatio: 1, textureRatio: 1});
			this.visualizer.setInternalMeshSize(32, 24);
			this.selectPreset(this.currentPresetIndex, 0);
			if (this.audioSourceKind === "debug") {
				this.startDebugAudio();
			} else if (this.audioStream) {
				this.setAudioStream(this.audioStream);
			}
			if (this.audioContext.state === "suspended") {
				return this.audioContext.resume().catch(function() {});
			}
			return Promise.resolve();
		},
		ensureCanvasSize: function(width, height) {
			width = Math.max(1, width | 0);
			height = Math.max(1, height | 0);
			if (!this.canvas || width === this.currentWidth && height === this.currentHeight) {
				return;
			}
			this.currentWidth = width;
			this.currentHeight = height;
			this.canvas.width = width;
			this.canvas.height = height;
			if (this.visualizer) {
				this.visualizer.setRendererSize(width, height, {meshWidth: 32, meshHeight: 24, pixelRatio: 1, textureRatio: 1});
			}
		},
		disconnectCurrentAudioInput: function() {
			if (this.audioNode) {
				try { this.visualizer.disconnectAudio(this.audioNode); } catch (error) {}
				try { this.audioNode.disconnect(); } catch (error) {}
				this.audioNode = null;
			}
			audioAnalyser.destroyDebugAudioNodes();
		},
		attachAudioNode: function(node) {
			audioAnalyser.ensureNodes(this.audioContext);
			this.audioNode = node;
			audioAnalyser.connectSource(this.audioNode);
			this.visualizer.connectAudio(this.audioNode);
		},
		setAudioStream: function(stream) {
			if (this.audioSourceKind !== "stream" || this.audioStream !== stream) {
				this.audioVersion += 1;
			}
			this.audioStream = stream;
			this.audioSourceKind = stream ? "stream" : "none";
			if (!this.visualizer || !this.audioContext) {
				if (!stream) {
					audioAnalyser.resetMetrics();
				}
				return;
			}
			this.disconnectCurrentAudioInput();
			if (!stream) {
				audioAnalyser.resetMetrics();
				return;
			}
			this.attachAudioNode(this.audioContext.createMediaStreamSource(stream));
		},
		startDebugAudio: function() {
			if (this.audioSourceKind !== "debug") {
				this.audioVersion += 1;
			}
			this.audioStream = null;
			this.audioSourceKind = "debug";
			if (!this.visualizer || !this.audioContext) {
				return Promise.resolve();
			}
			this.disconnectCurrentAudioInput();
			const nodes = audioAnalyser.createDebugAudioNodes(this.audioContext);
			this.attachAudioNode(nodes.inputNode);
			return Promise.resolve();
		},
		selectPreset: function(index, blendTimeSeconds) {
			if (!this.presetNames.length) {
				return Promise.resolve();
			}
			const nextPresetIndex = (index + this.presetNames.length) % this.presetNames.length;
			if (nextPresetIndex !== this.currentPresetIndex) {
				this.currentPresetIndex = nextPresetIndex;
				this.presetVersion += 1;
			}
			if (!this.visualizer) {
				return Promise.resolve();
			}
			this.visualizer.loadPreset(this.presetMap[this.presetNames[this.currentPresetIndex]], blendTimeSeconds || 0);
			return Promise.resolve();
		},
		renderCanvas: function(timeSeconds) {
			this.advanceFrame(timeSeconds);
			if (!this.visualizer) {
				return;
			}
			let elapsedTimeSeconds = 1 / 60;
			if (this.lastCanvasRenderTimeSeconds > 0) {
				elapsedTimeSeconds = clampNumber(timeSeconds - this.lastCanvasRenderTimeSeconds, 1 / 240, 0.25);
			}
			this.lastCanvasRenderTimeSeconds = timeSeconds;
			this.visualizer.render({elapsedTime: elapsedTimeSeconds});
			this.canvasRenderVersion += 1;
		},
		getPresetNames: function() {
			return this.presetNames.slice();
		},
		getCurrentPresetIndex: function() {
			return this.currentPresetIndex;
		},
		getAudioMetrics: function() {
			return audioAnalyser.getMetrics();
		},
		getState: function() {
			const presetName = this.presetNames[this.currentPresetIndex] || "";
			return {
				presetName: presetName,
				presetVersion: this.presetVersion,
				audioVersion: this.audioVersion,
				canvasRenderVersion: this.canvasRenderVersion,
				canvas: this.canvas,
				textureSource: this.canvas,
				audioMetrics: audioAnalyser.getMetrics(),
				timeSeconds: this.currentTimeSeconds
			};
		},
		startSession: function() {
			this.activate();
		},
		endSession: function() {
		}
	};
};

// core/runtime.js
const createRuntime = function(options) {
	const windowRef = options.windowRef || window;
	const documentRef = options.documentRef || document;
	const shell = options.shell;
	const sessionBridge = options.sessionBridge;
	const audioController = options.audioController;
	const locomotion = options.locomotion;
	const menuController = options.menuController;
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
	const updateReferenceSpace = function() {
		state.xrRefSpace = sessionBridge.createOffsetReferenceSpace(state.baseRefSpace, xrMovementState);
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
	const xrMenuActionCallbacks = {onShaderModeAction: cycleShaderMode, onLightPresetAction: cycleLightingPreset, onPresetAction: cyclePreset};
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
			currentPresetIndex: visualizerSelectionState ? visualizerSelectionState.currentPresetIndex : 0
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
		const viewerTransform = basePose ? basePose.transform : pose.transform;
		const menuState = menuController.getState();
		const locomotionStep = locomotion.applyXrLocomotion(xrMovementState, {delta: delta, viewerTransform: viewerTransform, turnAnchorPosition: basePose ? viewerTransform.position : null, locomotion: readLocomotionInput(frame), jumpMode: menuState.jumpMode, menuOpenBool: menuState.menuOpenBool});
		if (locomotionStep.referenceSpaceUpdateNeededBool) {
			updateReferenceSpace();
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
		if (state.visualizerEngine) {
			if (renderPose.transform && renderPose.views.length) {
				state.visualizerEngine.setHeadPosition(renderPose.transform.position.x, renderPose.transform.position.y, renderPose.transform.position.z);
				state.visualizerEngine.setHeadPoseFromQuaternion(renderPose.transform.orientation, renderPose.views[0].projectionMatrix);
			}
			state.visualizerEngine.update(time * 0.001);
		}
		updateSceneLighting(time * 0.001);
		sceneRenderer.renderXrViews({baseLayer: state.xrSession.renderState.baseLayer, pose: renderPose, eyeDistanceMeters: menuController.getState().eyeDistanceMeters, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, menuContentState: getMenuContentState(), getReactiveFloorColors: getAudioReactiveFloorColors});
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
		sceneRenderer.renderPreviewFrame({previewTimeSeconds: previewTimeSeconds, desktopMovementState: desktopMovementState, visualizerEngine: state.visualizerEngine, glbAssetStore: state.glbAssetStore, sceneLighting: sceneLighting, menuController: menuController, menuContentState: getMenuContentState(), getReactiveFloorColors: getAudioReactiveFloorColors});
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
		shell.setXrState({statusText: sessionBridge.isAvailable() ? "ready" : "headset not detected.", enterEnabledBool: sessionBridge.isAvailable(), exitEnabledBool: false});
		if (state.visualizerEngine) {
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
			state.baseRefSpace = xrState.baseRefSpace;
			locomotion.resetXrState(xrMovementState);
			menuController.resetSessionState();
			updateReferenceSpace();
			shell.setXrState({statusText: "session running", enterEnabledBool: false, exitEnabledBool: true});
			state.lastRenderTime = 0;
			if (state.visualizerEngine) {
				state.visualizerEngine.startSession();
			}
			state.frameHandle = state.xrSession.requestAnimationFrame(renderXr);
		} catch (error) {
			shell.setXrState({statusText: error.message || "session failed", enterEnabledBool: sessionBridge.isAvailable(), exitEnabledBool: false});
			state.xrSession = null;
			updateDesktopMenuPreview();
		}
	};
	const runAudioAction = function(actionPromise, fallbackMessage) {
		actionPromise.catch(function(error) {
			shell.setStatus(error.message || fallbackMessage);
		});
	};
	const bindAsyncButton = function(button, action, fallbackMessage) {
		button.addEventListener("click", function() {
			runAudioAction(action(), fallbackMessage);
		});
	};
	const registerEventHandlers = function() {
		desktopInput.registerEventHandlers(documentRef, windowRef);
		menuController.registerDesktopPreviewEvents({callbacks: desktopMenuActionCallbacks, getInteractionState: getDesktopMenuInteractionState});
		shell.enterButton.addEventListener("click", function() {
			if (sessionBridge.isAvailable() && state.gl && !state.xrSession) {
				audioController.activate();
				startSession();
			}
		});
		bindAsyncButton(shell.audioButton, audioController.requestSharedAudio, "audio capture failed");
		bindAsyncButton(shell.youtubeAudioButton, function() {
			return audioController.requestTabAudio(tabSources.youtube);
		}, "youtube audio failed");
		bindAsyncButton(shell.sunoLiveRadioButton, function() {
			return audioController.requestTabAudio(tabSources.suno);
		}, "suno live radio audio failed");
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
			}
			if (!sessionBridge.isAvailable()) {
				shell.setXrState({statusText: "WebXR not available.", enterEnabledBool: false, exitEnabledBool: false});
			} else {
				const supportedBool = await sessionBridge.isSupported();
				shell.setXrState({statusText: supportedBool ? "ready" : "headset not detected.", enterEnabledBool: supportedBool, exitEnabledBool: false});
			}
			shell.syncCanvasToViewport({width: windowRef.innerWidth, height: windowRef.innerHeight, pixelRatio: windowRef.devicePixelRatio});
			windowRef.requestAnimationFrame(renderPreview);
		}
	};
};

// app/config.js
const appConfig = {
	shell: {
		title: "WebXR Visualizer Foundation",
		xrHintText: "VR: left stick move, right stick turn, A jump, Y menu, trigger menu select / slider drag.",
		desktopHintText: "Desktop: click view + mouse look, WASD move, left mouse sprint, right mouse crouch, Space jump, M menu.",
		audioHintText: "YouTube Playlist and Suno Live Radio open the tab automatically. In the share dialog, choose that tab and enable tab audio.",
		panelStyle: {left: "12px", top: "12px"},
		canvasStyle: {width: "100vw", height: "100vh"}
	},
	audio: {
		youtubePlaylistUrl: "https://www.youtube.com/playlist?list=PLIEp7kQLbRSheVOUHZLuqj3fHO415l3Y-&autoplay=1",
		youtubeWindowName: "webxrYoutubePlaylist",
		sunoLiveRadioUrl: "https://suno.com/labs/live-radio",
		sunoWindowName: "webxrSunoLiveRadio"
	},
	locomotion: {
		walkSpeed: 4,
		sprintMultiplier: 2,
		turnSpeed: 2,
		jumpSpeed: 3.55,
		jumpHoldBoostSpeed: 6.5,
		jumpHoldMaxSeconds: 0.22,
		airBoostSpeed: 14,
		airMomentumDrag: 0.35,
		groundMomentumDrag: 10,
		doubleJumpMaxCount: 2,
		jumpGravity: -8.6,
		fallResetY: -25,
		playerRadius: 0.32,
		playerHeadClearance: 0.12,
		defaultEyeHeight: 1.7,
		tiptoeEyeHeightBoost: 0.3,
		crouchMinEyeHeight: 0.5,
		crouchSpeed: 1.8,
		climbSpeed: 2.4,
		stepHeight: 0.5,
		desktopStartZ: 5.6,
		desktopStartPitch: -0.16
	},
	menu: {
		rayLength: 4,
		eyeDistanceMin: 0.02,
		eyeDistanceMax: 0.2,
		floorAlphaMin: 0,
		floorAlphaMax: 1,
		desktopMenuPreviewWidthPixels: 420,
		jumpModeDoubleMinU: 0.1,
		jumpModeDoubleMaxU: 0.45,
		jumpModeMultiMinU: 0.55,
		jumpModeMultiMaxU: 0.9,
		menuSliderMinU: 0.18,
		menuSliderMaxU: 0.82,
		menuSliderHalfHeight: 0.055,
		presetPrevMinU: 0.08,
		presetPrevMaxU: 0.22,
		presetNextMinU: 0.78,
		presetNextMaxU: 0.92,
		initialJumpMode: "double",
		initialFloorAlpha: 0.72,
		initialEyeDistanceMeters: 0.064,
		initialDesktopPreviewVisibleBool: true,
		previewStyle: {right: "12px", top: "12px"}
	},
	runtime: {
		desktopMouseSensitivity: 0.0024,
		stickDeadzone: 0.08,
		stanceStickDeadzone: 0.22,
		stanceVerticalDominanceMargin: 0.12
	},
	scene: {
		floorHalfSize: 40,
		menuWidth: 0.74,
		sceneGlbAssets: [
			{
				url: "https://phobi82.github.io/Phobis-Crystal-Lake/goat.glb",
				position: {x: -1.4, y: 0.256, z: -2.6},
				scale: 1,
				rotationY: -0.55,
				collisionBool: true
			}
		],
		levelBoxes: [
			{x: 0, y: 0.6, z: -6, width: 2.4, height: 1.2, depth: 2.4, color: [0.2, 0.72, 1, 0.72]},
			{x: -3.6, y: 0.9, z: -10.5, width: 2.6, height: 1.8, depth: 2.6, color: [1, 0.55, 0.2, 0.72]},
			{x: 4.2, y: 1.3, z: -13.5, width: 3, height: 2.6, depth: 3, color: [0.3, 1, 0.55, 0.72]},
			{x: 0, y: 1.2, z: -18, width: 8, height: 2.4, depth: 1.3, color: [1, 0.28, 0.42, 0.68]},
			{x: -8.5, y: 1.6, z: -8, width: 1.2, height: 3.2, depth: 10, color: [0.95, 0.2, 0.8, 0.48]},
			{x: 8.5, y: 1.6, z: -8, width: 1.2, height: 3.2, depth: 10, color: [0.1, 0.95, 0.9, 0.48]}
		]
	}
};

// app/create-app.js
const createApp = function(projectConfig) {
	projectConfig = projectConfig || {};
	const config = {
		shell: Object.assign({}, appConfig.shell, projectConfig.shell || {}),
		audio: Object.assign({}, appConfig.audio, projectConfig.audio || {}),
		locomotion: Object.assign({}, appConfig.locomotion, projectConfig.locomotion || {}),
		menu: Object.assign({}, appConfig.menu, projectConfig.menu || {}),
		runtime: Object.assign({}, appConfig.runtime, projectConfig.runtime || {}),
		scene: Object.assign({}, appConfig.scene, projectConfig.scene || {})
	};
	let assetStoreRef = null;
	document.body.style.backgroundColor = "#000020";
	document.body.style.color = "#ffff00";
	document.body.style.margin = "0";
	document.body.style.overflow = "hidden";
	document.body.style.fontFamily = "Arial, sans-serif";
	const shell = createShell({
		title: config.shell.title,
		xrHintText: config.shell.xrHintText,
		desktopHintText: config.shell.desktopHintText,
		audioHintText: config.shell.audioHintText,
		panelStyle: config.shell.panelStyle,
		canvasStyle: config.shell.canvasStyle,
		documentRef: document
	});
	const menuView = createMenuView(Object.assign({documentRef: document}, config.menu));
	const menuController = createMenuController(Object.assign({menuView: menuView, menuWidth: config.scene.menuWidth}, config.menu));
	const audioController = createAudioSourceController({
		setStatus: shell.setStatus,
		mediaDevices: navigator.mediaDevices || null,
		openWindow: function(url, windowName) {
			return window.open(url, windowName);
		},
		onStateChange: shell.setAudioState
	});
	const sceneLighting = createSceneLighting();
	const collisionWorld = createCollisionWorld({
		staticBoxes: config.scene.levelBoxes,
		dynamicBoxSources: [function() {
			return assetStoreRef && assetStoreRef.getCollisionBoxes ? assetStoreRef.getCollisionBoxes() : [];
		}],
		floorHalfSize: config.scene.floorHalfSize,
		playerRadius: config.locomotion.playerRadius,
		stepHeight: config.locomotion.stepHeight
	});
	const locomotion = createLocomotion(Object.assign({world: collisionWorld}, config.locomotion));
	const sessionBridge = createXrSessionBridge({
		xrApi: navigator.xr || null,
		xrWebGLLayer: window.XRWebGLLayer || null,
		xrRigidTransform: window.XRRigidTransform || null
	});
	const sceneRenderer = createSceneRenderer({
		canvas: shell.canvas,
		onInitFailure: function() {
			shell.setXrState({statusText: "WebGL not available.", enterEnabledBool: false, exitEnabledBool: false});
		},
		clampNumber: function(value, minValue, maxValue) {
			return Math.max(minValue, Math.min(maxValue, value));
		},
		levelBoxes: config.scene.levelBoxes,
		floorHalfSize: config.scene.floorHalfSize,
		menuWidth: config.scene.menuWidth,
		maxSceneLights: MAX_DIRECTIONAL_LIGHTS,
		getLightingUniformLocations: getLightingUniformLocations,
		applyLightingUniforms: applyLightingUniforms
	});
	const runtime = createRuntime({
		windowRef: window,
		documentRef: document,
		shell: shell,
		sessionBridge: sessionBridge,
		audioController: audioController,
		locomotion: locomotion,
		menuController: menuController,
		sceneRenderer: sceneRenderer,
		sceneLighting: sceneLighting,
		createGlbAssetStore: function(gl) {
			assetStoreRef = createGlbAssetStore({
				gl: gl,
				fetchFn: window.fetch ? window.fetch.bind(window) : null,
				createImageBitmapFn: window.createImageBitmap ? window.createImageBitmap.bind(window) : null,
				imageCtor: window.Image,
				blobCtor: window.Blob,
				textDecoderCtor: window.TextDecoder,
				urlApi: window.URL,
				setStatus: shell.setStatus,
				getLightingState: function() {
					return sceneLighting.getState();
				},
				getLightingUniformLocations: getLightingUniformLocations,
				applyLightingUniforms: applyLightingUniforms,
				maxSceneLights: MAX_DIRECTIONAL_LIGHTS
			});
			return assetStoreRef;
		},
		createVisualizerEngine: function(gl) {
			const engine = createVisualizerEngine({
				createSourceBackend: function() {
					return createButterchurnSource({windowRef: window, documentRef: document});
				},
				modes: visualizerModeDefinitions
			});
			engine.init({gl: gl});
			return engine;
		},
		sceneGlbAssets: config.scene.sceneGlbAssets,
		inputConfig: config.runtime,
		tabSources: {
			youtube: {key: "youtube", url: config.audio.youtubePlaylistUrl, windowName: config.audio.youtubeWindowName, sourceName: "YouTube playlist", blockedMessage: "youtube tab blocked", selectStatus: "select the YouTube tab and enable tab audio", activeStatus: "youtube tab audio active"},
			suno: {key: "suno", url: config.audio.sunoLiveRadioUrl, windowName: config.audio.sunoWindowName, sourceName: "Suno Live Radio", blockedMessage: "suno live radio tab blocked", selectStatus: "select the Suno Live Radio tab and enable tab audio", activeStatus: "suno live radio tab audio active"}
		}
	});
	return runtime;
};

createApp(appConfig).start();
