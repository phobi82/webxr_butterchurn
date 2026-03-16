(function() {
	// Registers visualizer modes and feeds each mode the shared frame, pose, and Butterchurn source state.
	const utils = window.xrVisualizerUtils;
	const emptyAudioMetrics = utils.emptyAudioMetrics;
	const registeredModeNames = [];
	const registeredModeFactories = {};

	window.registerXrVisualizerMode = function(name, factory) {
		if (!registeredModeFactories[name]) {
			registeredModeNames.push(name);
		}
		registeredModeFactories[name] = factory;
	};

	window.getRegisteredXrVisualizerModeNames = function() {
		return registeredModeNames.slice();
	};

	window.createXrVisualizerManager = function() {
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
			projMatrix: new Float32Array(16)
		};
		const manager = {
			gl: null,
			source: null,
			modeNames: [],
			modes: {},
			currentModeIndex: 0,
			init: function(options) {
				this.gl = options.gl;
				this.source = window.createButterchurnVisualizerSource();
				this.source.init(1, 1);
				this.modeNames = window.getRegisteredXrVisualizerModeNames ? window.getRegisteredXrVisualizerModeNames() : [];
				this.modes = {};
				for (let i = 0; i < this.modeNames.length; i += 1) {
					const modeName = this.modeNames[i];
					const factory = registeredModeFactories[modeName];
					if (!factory) {
						continue;
					}
					const mode = factory({
						gl: this.gl,
						source: this.source
					});
					if (!mode) {
						continue;
					}
					if (mode.init) {
						mode.init({
							gl: this.gl,
							source: this.source
						});
					}
					this.modes[modeName] = mode;
				}
				if (this.currentModeIndex >= this.modeNames.length) {
					this.currentModeIndex = 0;
				}
			},
			update: function(timeSeconds) {
				frameState.timeSeconds = timeSeconds;
				this.source.advanceFrame(timeSeconds);
				const mode = getActiveMode();
				if (mode && mode.update) {
					mode.update(getSourceState(), frameState);
				}
			},
			setRenderMatrices: function(viewMatrix, projMatrix) {
				frameState.viewMatrix.set(viewMatrix);
				frameState.projMatrix.set(projMatrix);
			},
			setViewFromMatrix: function(viewMatrix, projectionMatrix) {
				const forwardAngles = utils.extractForwardYawPitch(viewMatrix);
				const cameraPosition = utils.extractCameraPositionFromViewMatrix(viewMatrix);
				const fov = utils.extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				frameState.headPitch = forwardAngles.pitch;
				frameState.headPositionX = cameraPosition.x;
				frameState.headPositionY = cameraPosition.y;
				frameState.headPositionZ = cameraPosition.z;
				frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadPoseFromQuaternion: function(quaternion, projectionMatrix) {
				const forwardAngles = utils.extractForwardYawPitchFromQuaternion(quaternion);
				const fov = utils.extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				frameState.headPitch = forwardAngles.pitch;
				frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadYaw: function(rawYaw) {
				if (frameState.lastRawHeadYaw === undefined) {
					frameState.headYaw = rawYaw;
				} else {
					frameState.headYaw = utils.unwrapAngle(rawYaw, frameState.lastRawHeadYaw) + (frameState.headYaw - frameState.lastRawHeadYaw);
				}
				frameState.lastRawHeadYaw = rawYaw;
			},
			setEyeProjection: function(projectionMatrix) {
				frameState.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
				frameState.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
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
				this.source.setAudioStream(stream);
				notifyModes("onAudioChanged");
			},
			startDebugAudio: async function() {
				await this.source.startDebugAudio();
				notifyModes("onAudioChanged");
			},
			activateAudio: function() {
				return this.source.activate();
			},
			getPresetNames: function() {
				return this.source.getPresetNames();
			},
			getCurrentPresetIndex: function() {
				return this.source.getCurrentPresetIndex();
			},
			getModeNames: function() {
				return this.modeNames.slice();
			},
			getCurrentModeIndex: function() {
				return this.currentModeIndex;
			},
			getAudioMetrics: function() {
				return this.source.getAudioMetrics ? this.source.getAudioMetrics() : emptyAudioMetrics;
			},
			selectPreset: async function(index) {
				await this.source.selectPreset(index, 1.2);
				this.source.lastCanvasRenderTimeSeconds = 0;
				notifyModes("onPresetChanged");
			},
			selectMode: function(index) {
				if (!this.modeNames.length) {
					return Promise.resolve();
				}
				this.currentModeIndex = (index + this.modeNames.length) % this.modeNames.length;
				return Promise.resolve();
			},
			onSessionStart: function() {
				this.source.onSessionStart();
				notifyModes("onSessionStart");
			},
			onSessionEnd: function() {
				this.source.onSessionEnd();
				notifyModes("onSessionEnd");
			}
		};

		const getSourceState = function() {
			return manager.source.getStateSnapshot();
		};

		const notifyModes = function(methodName) {
			const sourceState = getSourceState();
			for (let i = 0; i < manager.modeNames.length; i += 1) {
				const mode = manager.modes[manager.modeNames[i]];
				if (mode && mode[methodName]) {
					mode[methodName](sourceState, frameState);
				}
			}
		};

		const getActiveMode = function() {
			return manager.modes[manager.modeNames[manager.currentModeIndex]] || null;
		};

		const drawPhase = function(methodName) {
			const mode = getActiveMode();
			if (!mode || !mode[methodName]) {
				return;
			}
			mode[methodName](getSourceState(), frameState);
		};

		return manager;
	};

	window.createXrBackgroundRenderer = function() {
		return window.createXrVisualizerManager();
	};
})();
