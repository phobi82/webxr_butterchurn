(function() {
	// Registers visualizer modes and feeds each mode the shared frame, pose, and Butterchurn source state.
	const utils = window.xrVisualizerUtils;
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
		return {
			gl: null,
			source: null,
			modeNames: [],
			modes: {},
			currentModeIndex: 0,
			frameState: {
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
			},
			lastSourceSnapshot: null,
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
				this.lastSourceSnapshot = this.source.getStateSnapshot();
			},
			forEachMode: function(callback) {
				for (let i = 0; i < this.modeNames.length; i += 1) {
					const mode = this.modes[this.modeNames[i]];
					if (mode) {
						callback(mode, this.modeNames[i]);
					}
				}
			},
			getActiveMode: function() {
				return this.modes[this.modeNames[this.currentModeIndex]] || null;
			},
			getSourceState: function() {
				this.lastSourceSnapshot = this.source.getStateSnapshot();
				return this.lastSourceSnapshot;
			},
			update: function(timeSeconds) {
				this.frameState.timeSeconds = timeSeconds;
				this.source.advanceFrame(timeSeconds);
				const mode = this.getActiveMode();
				if (mode && mode.update) {
					mode.update(this.getSourceState(), this.frameState);
				}
			},
			setRenderMatrices: function(viewMatrix, projMatrix) {
				for (let i = 0; i < 16; i += 1) {
					this.frameState.viewMatrix[i] = viewMatrix[i];
					this.frameState.projMatrix[i] = projMatrix[i];
				}
			},
			setViewFromMatrix: function(viewMatrix, projectionMatrix) {
				const forwardAngles = utils.extractForwardYawPitch(viewMatrix);
				const cameraPosition = utils.extractCameraPositionFromViewMatrix(viewMatrix);
				const fov = utils.extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				this.frameState.headPitch = forwardAngles.pitch;
				this.frameState.headPositionX = cameraPosition.x;
				this.frameState.headPositionY = cameraPosition.y;
				this.frameState.headPositionZ = cameraPosition.z;
				this.frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				this.frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadPoseFromQuaternion: function(quaternion, projectionMatrix) {
				const forwardAngles = utils.extractForwardYawPitchFromQuaternion(quaternion);
				const fov = utils.extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				this.frameState.headPitch = forwardAngles.pitch;
				this.frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				this.frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadYaw: function(rawYaw) {
				if (this.frameState.lastRawHeadYaw === undefined) {
					this.frameState.headYaw = rawYaw;
				} else {
					this.frameState.headYaw = utils.unwrapAngle(rawYaw, this.frameState.lastRawHeadYaw) + (this.frameState.headYaw - this.frameState.lastRawHeadYaw);
				}
				this.frameState.lastRawHeadYaw = rawYaw;
			},
			setEyeProjection: function(projectionMatrix) {
				this.frameState.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
				this.frameState.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
			},
			setHeadPosition: function(x, y, z) {
				this.frameState.headPositionX = x;
				this.frameState.headPositionY = y;
				this.frameState.headPositionZ = z;
			},
			drawPhase: function(methodName) {
				const mode = this.getActiveMode();
				if (!mode || !mode[methodName]) {
					return;
				}
				mode[methodName](this.getSourceState(), this.frameState);
			},
			drawPreScene: function() {
				this.drawPhase("drawPreScene");
			},
			drawWorld: function() {
				this.drawPhase("drawWorld");
			},
			drawPostScene: function() {
				this.drawPhase("drawPostScene");
			},
			setAudioStream: function(stream) {
				this.source.setAudioStream(stream);
				this.forEachMode(function(mode) {
					if (mode.onAudioChanged) {
						mode.onAudioChanged(this.getSourceState(), this.frameState);
					}
				}.bind(this));
			},
			startDebugAudio: function() {
				return this.source.startDebugAudio().then(function() {
					this.forEachMode(function(mode) {
						if (mode.onAudioChanged) {
							mode.onAudioChanged(this.getSourceState(), this.frameState);
						}
					}.bind(this));
				}.bind(this));
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
			getAudioLevel: function() {
				return this.source.getAudioLevel ? this.source.getAudioLevel() : 0;
			},
			getAudioPeak: function() {
				return this.source.getAudioPeak ? this.source.getAudioPeak() : 0;
			},
			getBeatPulse: function() {
				return this.source.getBeatPulse ? this.source.getBeatPulse() : 0;
			},
			getAudioMetrics: function() {
				return this.source.getAudioMetrics ? this.source.getAudioMetrics() : {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
			},
			selectPreset: function(index) {
				return this.source.selectPreset(index, 1.2).then(function() {
					this.source.lastCanvasRenderTimeSeconds = 0;
					this.forEachMode(function(mode) {
						if (mode.onPresetChanged) {
							mode.onPresetChanged(this.getSourceState(), this.frameState);
						}
					}.bind(this));
				}.bind(this));
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
				this.forEachMode(function(mode) {
					if (mode.onSessionStart) {
						mode.onSessionStart(this.getSourceState(), this.frameState);
					}
				}.bind(this));
			},
			onSessionEnd: function() {
				this.source.onSessionEnd();
				this.forEachMode(function(mode) {
					if (mode.onSessionEnd) {
						mode.onSessionEnd(this.getSourceState(), this.frameState);
					}
				}.bind(this));
			},
			getShaderModeNames: function() {
				return this.getModeNames();
			},
			getCurrentShaderModeIndex: function() {
				return this.getCurrentModeIndex();
			},
			selectShaderMode: function(index) {
				return this.selectMode(index);
			}
		};
	};

	window.createXrBackgroundRenderer = function() {
		return window.createXrVisualizerManager();
	};
})();
