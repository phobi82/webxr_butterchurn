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
			if (this.programInfo.backgroundAlphaLoc) {
				this.gl.uniform1f(this.programInfo.backgroundAlphaLoc, frameState.backgroundAlpha);
			}
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
		backgroundAlpha: 1,
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
		setBackgroundBlend: function(passthroughMix, passthroughAvailableBool) {
			frameState.backgroundAlpha = passthroughAvailableBool ? clampNumber(1 - (passthroughMix || 0), 0, 1) : 1;
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
