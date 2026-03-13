(function() {
	const utils = window.xrVisualizerUtils;
	const defaultPresetName = "martin - mucus cervix";

	const createCanvas = function(width, height) {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.style.display = "none";
		return canvas;
	};

	window.createButterchurnVisualizerSource = function() {
		const butterchurnApi = window.butterchurn && window.butterchurn.createVisualizer ? window.butterchurn : window.butterchurn && window.butterchurn.default && window.butterchurn.default.createVisualizer ? window.butterchurn.default : null;
		const butterchurnPresetsApi = window.butterchurnPresets && window.butterchurnPresets.getPresets ? window.butterchurnPresets : window.butterchurnPresets && window.butterchurnPresets.default && window.butterchurnPresets.default.getPresets ? window.butterchurnPresets.default : null;
		return {
			canvas: null,
			visualizer: null,
			audioContext: null,
			audioNode: null,
			audioAnalyser: null,
			audioAnalyserData: null,
			audioStream: null,
			activatedBool: false,
			presetNames: [],
			presetMap: {},
			currentPresetIndex: 0,
			currentWidth: 0,
			currentHeight: 0,
			lastRenderTimeSeconds: 0,
			audioLevel: 0,
			audioPeak: 0,
			audioBassLevel: 0,
			audioTransientLevel: 0,
			beatPulse: 0,
			beatCooldownSeconds: 0,
			presetVersion: 0,
			audioVersion: 0,
			canvasRenderVersion: 0,
			init: function(width, height) {
				this.canvas = createCanvas(width, height);
				this.currentWidth = width;
				this.currentHeight = height;
				this.presetMap = butterchurnPresetsApi ? butterchurnPresetsApi.getPresets() : {};
				this.presetNames = Object.keys(this.presetMap).sort();
				this.currentPresetIndex = Math.max(0, this.presetNames.indexOf(defaultPresetName));
				this.presetVersion = 1;
			},
			activate: function() {
				if (!butterchurnApi || !this.presetNames.length || this.activatedBool) {
					if (this.audioContext && this.audioContext.state === "suspended") {
						return this.audioContext.resume().catch(function() {
						});
					}
					return Promise.resolve();
				}
				this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
				this.visualizer.setRendererSize(this.currentWidth, this.currentHeight, {
					meshWidth: 32,
					meshHeight: 24,
					pixelRatio: 1,
					textureRatio: 1
				});
				this.visualizer.setInternalMeshSize(32, 24);
				this.selectPreset(this.currentPresetIndex, 0);
				if (this.audioStream) {
					this.setAudioStream(this.audioStream);
				}
				if (this.audioContext.state === "suspended") {
					return this.audioContext.resume().catch(function() {
					});
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
					this.visualizer.setRendererSize(width, height, {
						meshWidth: 32,
						meshHeight: 24,
						pixelRatio: 1,
						textureRatio: 1
					});
				}
			},
			resetAudioMetrics: function() {
				this.audioLevel = 0;
				this.audioPeak = 0;
				this.audioBassLevel = 0;
				this.audioTransientLevel = 0;
				this.beatPulse = 0;
				this.beatCooldownSeconds = 0;
			},
			setAudioStream: function(stream) {
				if (this.audioStream !== stream) {
					this.audioVersion += 1;
				}
				this.audioStream = stream;
				if (!this.visualizer || !this.audioContext) {
					return;
				}
				if (this.audioNode) {
					try {
						this.visualizer.disconnectAudio(this.audioNode);
					} catch (error) {
					}
					try {
						this.audioNode.disconnect();
					} catch (error) {
					}
					this.audioNode = null;
				}
				if (!stream) {
					this.resetAudioMetrics();
					return;
				}
				if (!this.audioAnalyser) {
					this.audioAnalyser = this.audioContext.createAnalyser();
					this.audioAnalyser.fftSize = 256;
					this.audioAnalyser.smoothingTimeConstant = 0.82;
					this.audioAnalyserData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
				}
				this.audioNode = this.audioContext.createMediaStreamSource(stream);
				this.audioNode.connect(this.audioAnalyser);
				this.visualizer.connectAudio(this.audioNode);
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
				if (!this.visualizer) {
					return;
				}
				let elapsedTimeSeconds = 1 / 60;
				if (this.lastRenderTimeSeconds > 0) {
					elapsedTimeSeconds = utils.clampNumber(timeSeconds - this.lastRenderTimeSeconds, 1 / 240, 0.25);
				}
				this.lastRenderTimeSeconds = timeSeconds;
				if (this.audioAnalyser && this.audioAnalyserData) {
					this.audioAnalyser.getByteFrequencyData(this.audioAnalyserData);
					let levelSum = 0;
					let bassSum = 0;
					let bassCount = 0;
					for (let i = 0; i < this.audioAnalyserData.length; i += 1) {
						levelSum += this.audioAnalyserData[i];
						if (i < 12) {
							bassSum += this.audioAnalyserData[i];
							bassCount += 1;
						}
					}
					const averageLevel = levelSum / (this.audioAnalyserData.length * 255);
					const bassLevel = bassCount ? bassSum / (bassCount * 255) : averageLevel;
					const smoothedLevel = this.audioLevel + (averageLevel - this.audioLevel) * 0.16;
					const smoothedBassLevel = this.audioBassLevel + (bassLevel - this.audioBassLevel) * 0.18;
					const transientLevel = Math.max(0, averageLevel - smoothedLevel * 0.82);
					const beatThreshold = Math.max(0.03, smoothedBassLevel * 0.24);
					this.audioTransientLevel += (transientLevel - this.audioTransientLevel) * 0.35;
					this.audioLevel = smoothedLevel;
					this.audioBassLevel = smoothedBassLevel;
					this.audioPeak = Math.max(averageLevel, this.audioPeak - elapsedTimeSeconds * 0.65);
					this.beatCooldownSeconds = Math.max(0, this.beatCooldownSeconds - elapsedTimeSeconds);
					if (this.beatCooldownSeconds <= 0 && bassLevel - smoothedBassLevel > beatThreshold && transientLevel > 0.018) {
						this.beatPulse = 1;
						this.beatCooldownSeconds = 0.18;
					} else {
						this.beatPulse = Math.max(0, this.beatPulse - elapsedTimeSeconds * 3.6);
					}
				} else {
					this.audioLevel *= 0.9;
					this.audioPeak *= 0.9;
					this.audioBassLevel *= 0.9;
					this.audioTransientLevel *= 0.86;
					this.beatPulse *= 0.82;
					this.beatCooldownSeconds = 0;
				}
				this.visualizer.render({elapsedTime: elapsedTimeSeconds});
				this.canvasRenderVersion += 1;
			},
			getCurrentTextureSource: function() {
				return this.canvas;
			},
			getCurrentPresetName: function() {
				return this.presetNames[this.currentPresetIndex] || "";
			},
			getCurrentPresetObject: function() {
				const presetName = this.getCurrentPresetName();
				return presetName ? this.presetMap[presetName] || null : null;
			},
			getPresetNames: function() {
				return this.presetNames.slice();
			},
			getCurrentPresetIndex: function() {
				return this.currentPresetIndex;
			},
			getAudioLevel: function() {
				return this.audioLevel;
			},
			getAudioPeak: function() {
				return this.audioPeak;
			},
			getBeatPulse: function() {
				return this.beatPulse;
			},
			getAudioMetrics: function() {
				return {
					level: this.audioLevel,
					peak: this.audioPeak,
					bass: this.audioBassLevel,
					transient: this.audioTransientLevel,
					beatPulse: this.beatPulse
				};
			},
			getStateSnapshot: function() {
				return {
					presetName: this.getCurrentPresetName(),
					presetObject: this.getCurrentPresetObject(),
					presetVersion: this.presetVersion,
					audioVersion: this.audioVersion,
					canvasRenderVersion: this.canvasRenderVersion,
					canvas: this.canvas,
					textureSource: this.canvas,
					audioMetrics: this.getAudioMetrics(),
					timeSeconds: this.lastRenderTimeSeconds
				};
			},
			onSessionStart: function() {
				this.activate();
			},
			onSessionEnd: function() {
			}
		};
	};
})();
