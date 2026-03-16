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

	window.createXrVisualizerManager = function(options) {
		options = options || {};
		const createVisualizerSource = options.createVisualizerSource || window.createButterchurnVisualizerSource;
		const getModeNames = options.getModeNames || window.getRegisteredXrVisualizerModeNames;
		const visualizerSourceOptions = options.visualizerSourceOptions || null;
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
		const setHeadYaw = function(rawYaw) {
			if (frameState.lastRawHeadYaw === undefined) {
				frameState.headYaw = rawYaw;
			} else {
				frameState.headYaw = utils.unwrapAngle(rawYaw, frameState.lastRawHeadYaw) + (frameState.headYaw - frameState.lastRawHeadYaw);
			}
			frameState.lastRawHeadYaw = rawYaw;
		};
		const setProjectionState = function(projectionMatrix) {
			frameState.projMatrix.set(projectionMatrix);
			frameState.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
			frameState.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
		};
		const manager = {
			gl: null,
			visualizerSource: null,
			modeNames: [],
			modes: {},
			currentModeIndex: 0,
			init: function(options) {
				this.gl = options.gl;
				this.visualizerSource = createVisualizerSource(visualizerSourceOptions);
				this.visualizerSource.init(1, 1);
				this.modeNames = getModeNames ? getModeNames() : [];
				this.modes = {};
				for (let i = 0; i < this.modeNames.length; i += 1) {
					const modeName = this.modeNames[i];
					const factory = registeredModeFactories[modeName];
					if (!factory) {
						continue;
					}
					const mode = factory({
						gl: this.gl,
						visualizerSource: this.visualizerSource
					});
					if (!mode) {
						continue;
					}
					if (mode.init) {
						mode.init({
							gl: this.gl,
							visualizerSource: this.visualizerSource
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
				this.visualizerSource.advanceFrame(timeSeconds);
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
				const forwardAngles = utils.extractForwardYawPitch(viewMatrix);
				const cameraPosition = utils.extractCameraPositionFromViewMatrix(viewMatrix);
				const fov = utils.extractProjectionFov(projectionMatrix);
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
				const forwardAngles = utils.extractForwardYawPitchFromQuaternion(quaternion);
				const fov = utils.extractProjectionFov(projectionMatrix);
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
				this.visualizerSource.setAudioStream(stream);
				notifyModes("onAudioChanged");
			},
			startDebugAudio: async function() {
				await this.visualizerSource.startDebugAudio();
				notifyModes("onAudioChanged");
			},
			activateAudio: function() {
				return this.visualizerSource.activate();
			},
			getAudioMetrics: function() {
				return this.visualizerSource.getAudioMetrics ? this.visualizerSource.getAudioMetrics() : emptyAudioMetrics;
			},
			getSelectionState: function() {
				return {
					modeNames: this.modeNames.slice(),
					currentModeIndex: this.currentModeIndex,
					presetNames: this.visualizerSource.getPresetNames(),
					currentPresetIndex: this.visualizerSource.getCurrentPresetIndex()
				};
			},
			selectPreset: async function(index) {
				await this.visualizerSource.selectPreset(index, 1.2);
				this.visualizerSource.lastCanvasRenderTimeSeconds = 0;
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
				this.visualizerSource.startSession();
				notifyModes("onSessionStart");
			},
			endSession: function() {
				this.visualizerSource.endSession();
				notifyModes("onSessionEnd");
			}
		};

		const getSourceState = function() {
			return manager.visualizerSource.getState();
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

})();
