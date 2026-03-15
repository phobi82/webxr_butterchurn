(function() {
	// Owns Butterchurn, audio analysis, debug audio, and the shared preset/canvas state for all modes.
	const utils = window.xrVisualizerUtils;
	const defaultPresetName = "martin - mucus cervix";

	const createCanvas = function(width, height) {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.style.display = "none";
		return canvas;
	};

	const createAnalyser = function(audioContext) {
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.58;
		return analyser;
	};

	const analyseAudioFrame = function(frequencyData, timeDomainData, previousFrequencyData) {
		let levelSum = 0;
		let bassSum = 0;
		let bassCount = 0;
		let fluxSum = 0;
		let rmsSum = 0;
		const bassBinLimit = Math.min(14, frequencyData.length);
		const fluxBinLimit = Math.min(56, frequencyData.length);
		for (let i = 0; i < frequencyData.length; i += 1) {
			const currentMagnitude = frequencyData[i] / 255;
			levelSum += frequencyData[i];
			if (i < bassBinLimit) {
				bassSum += frequencyData[i];
				bassCount += 1;
			}
			if (i < fluxBinLimit) {
				fluxSum += Math.max(0, currentMagnitude - previousFrequencyData[i]);
			}
			previousFrequencyData[i] = currentMagnitude;
		}
		for (let i = 0; i < timeDomainData.length; i += 1) {
			const centeredSample = (timeDomainData[i] - 128) / 128;
			rmsSum += centeredSample * centeredSample;
		}
		const averageLevel = levelSum / Math.max(1, frequencyData.length * 255);
		const bassLevel = bassCount ? bassSum / (bassCount * 255) : averageLevel;
		const rmsLevel = Math.sqrt(rmsSum / Math.max(1, timeDomainData.length));
		return {
			combinedLevel: Math.max(averageLevel, rmsLevel * 1.7),
			bassLevel: bassLevel,
			spectralFluxLevel: fluxBinLimit ? fluxSum / fluxBinLimit : 0
		};
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
			audioTimeDomainData: null,
			previousFrequencyData: null,
			audioChannelSplitter: null,
			audioAnalyserLeft: null,
			audioAnalyserRight: null,
			audioAnalyserLeftData: null,
			audioAnalyserRightData: null,
			audioTimeDomainLeftData: null,
			audioTimeDomainRightData: null,
			previousLeftFrequencyData: null,
			previousRightFrequencyData: null,
			audioStream: null,
			audioSourceKind: "none",
			debugAudioNodes: null,
			activatedBool: false,
			presetNames: [],
			presetMap: {},
			currentPresetIndex: 0,
			currentWidth: 0,
			currentHeight: 0,
			lastFrameTimeSeconds: 0,
			lastCanvasRenderTimeSeconds: 0,
			audioLevel: 0,
			audioPeak: 0,
			audioBassLevel: 0,
			audioTransientLevel: 0,
			audioLeftLevel: 0,
			audioRightLevel: 0,
			audioLeftBassLevel: 0,
			audioRightBassLevel: 0,
			audioMidLevel: 0,
			audioSideLevel: 0,
			audioStereoBalance: 0,
			audioStereoWidth: 0,
			audioBeatBaseline: 0,
			audioTransientBaseline: 0,
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
				if (this.audioSourceKind === "debug") {
					this.startDebugAudio();
				} else if (this.audioStream) {
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
				this.audioLeftLevel = 0;
				this.audioRightLevel = 0;
				this.audioLeftBassLevel = 0;
				this.audioRightBassLevel = 0;
				this.audioMidLevel = 0;
				this.audioSideLevel = 0;
				this.audioStereoBalance = 0;
				this.audioStereoWidth = 0;
				this.audioBeatBaseline = 0;
				this.audioTransientBaseline = 0;
				this.beatPulse = 0;
				this.beatCooldownSeconds = 0;
				if (this.previousFrequencyData) {
					this.previousFrequencyData.fill(0);
				}
				if (this.previousLeftFrequencyData) {
					this.previousLeftFrequencyData.fill(0);
				}
				if (this.previousRightFrequencyData) {
					this.previousRightFrequencyData.fill(0);
				}
			},
			ensureAudioAnalyser: function() {
				if (this.audioAnalyser) {
					return;
				}
				this.audioAnalyser = createAnalyser(this.audioContext);
				this.audioAnalyserData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
				this.audioTimeDomainData = new Uint8Array(this.audioAnalyser.fftSize);
				this.previousFrequencyData = new Float32Array(this.audioAnalyser.frequencyBinCount);
				this.audioChannelSplitter = this.audioContext.createChannelSplitter(2);
				this.audioAnalyserLeft = createAnalyser(this.audioContext);
				this.audioAnalyserRight = createAnalyser(this.audioContext);
				this.audioAnalyserLeftData = new Uint8Array(this.audioAnalyserLeft.frequencyBinCount);
				this.audioAnalyserRightData = new Uint8Array(this.audioAnalyserRight.frequencyBinCount);
				this.audioTimeDomainLeftData = new Uint8Array(this.audioAnalyserLeft.fftSize);
				this.audioTimeDomainRightData = new Uint8Array(this.audioAnalyserRight.fftSize);
				this.previousLeftFrequencyData = new Float32Array(this.audioAnalyserLeft.frequencyBinCount);
				this.previousRightFrequencyData = new Float32Array(this.audioAnalyserRight.frequencyBinCount);
				this.audioChannelSplitter.connect(this.audioAnalyserLeft, 0);
				this.audioChannelSplitter.connect(this.audioAnalyserRight, 1);
			},
			destroyDebugAudioNodes: function() {
				if (!this.debugAudioNodes) {
					return;
				}
				const stopNodes = this.debugAudioNodes.stopNodes || [];
				for (let i = 0; i < stopNodes.length; i += 1) {
					try {
						stopNodes[i].stop();
					} catch (error) {
					}
				}
				const disconnectNodes = this.debugAudioNodes.disconnectNodes || [];
				for (let i = 0; i < disconnectNodes.length; i += 1) {
					try {
						disconnectNodes[i].disconnect();
					} catch (error) {
					}
				}
				this.debugAudioNodes = null;
			},
			disconnectCurrentAudioInput: function() {
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
				this.destroyDebugAudioNodes();
			},
			attachAudioNode: function(node) {
				this.ensureAudioAnalyser();
				this.audioNode = node;
				this.audioNode.connect(this.audioAnalyser);
				this.audioNode.connect(this.audioChannelSplitter);
				this.visualizer.connectAudio(this.audioNode);
			},
			createDebugAudioNodes: function() {
				const mixGain = this.audioContext.createGain();
				mixGain.gain.value = 0.75;

				const bassOsc = this.audioContext.createOscillator();
				bassOsc.type = "sine";
				bassOsc.frequency.value = 55;
				const bassGain = this.audioContext.createGain();
				bassGain.gain.value = 0.055;
				const bassLfo = this.audioContext.createOscillator();
				bassLfo.type = "triangle";
				bassLfo.frequency.value = 1.85;
				const bassLfoGain = this.audioContext.createGain();
				bassLfoGain.gain.value = 0.11;
				bassOsc.connect(bassGain);
				bassGain.connect(mixGain);
				bassLfo.connect(bassLfoGain);
				bassLfoGain.connect(bassGain.gain);

				const kickOsc = this.audioContext.createOscillator();
				kickOsc.type = "triangle";
				kickOsc.frequency.value = 43;
				const kickGain = this.audioContext.createGain();
				kickGain.gain.value = 0;
				const kickBase = this.audioContext.createConstantSource();
				kickBase.offset.value = 0.03;
				const kickLfo = this.audioContext.createOscillator();
				kickLfo.type = "square";
				kickLfo.frequency.value = 2.05;
				const kickLfoGain = this.audioContext.createGain();
				kickLfoGain.gain.value = 0.1;
				kickOsc.connect(kickGain);
				kickGain.connect(mixGain);
				kickBase.connect(kickGain.gain);
				kickLfo.connect(kickLfoGain);
				kickLfoGain.connect(kickGain.gain);

				const midOsc = this.audioContext.createOscillator();
				midOsc.type = "sawtooth";
				midOsc.frequency.value = 220;
				const midGain = this.audioContext.createGain();
				midGain.gain.value = 0.012;
				const midLfo = this.audioContext.createOscillator();
				midLfo.type = "sine";
				midLfo.frequency.value = 5.1;
				const midLfoGain = this.audioContext.createGain();
				midLfoGain.gain.value = 0.02;
				midOsc.connect(midGain);
				midGain.connect(mixGain);
				midLfo.connect(midLfoGain);
				midLfoGain.connect(midGain.gain);

				const highOsc = this.audioContext.createOscillator();
				highOsc.type = "square";
				highOsc.frequency.value = 1320;
				const highGain = this.audioContext.createGain();
				highGain.gain.value = 0.004;
				const highLfo = this.audioContext.createOscillator();
				highLfo.type = "square";
				highLfo.frequency.value = 7.6;
				const highLfoGain = this.audioContext.createGain();
				highLfoGain.gain.value = 0.012;
				highOsc.connect(highGain);
				highGain.connect(mixGain);
				highLfo.connect(highLfoGain);
				highLfoGain.connect(highGain.gain);

				const sweepFilter = this.audioContext.createBiquadFilter();
				sweepFilter.type = "lowpass";
				sweepFilter.frequency.value = 1600;
				const filterLfo = this.audioContext.createOscillator();
				filterLfo.type = "sine";
				filterLfo.frequency.value = 0.21;
				const filterLfoGain = this.audioContext.createGain();
				filterLfoGain.gain.value = 1200;
				mixGain.connect(sweepFilter);
				filterLfo.connect(filterLfoGain);
				filterLfoGain.connect(sweepFilter.frequency);

				bassOsc.start();
				bassLfo.start();
				kickOsc.start();
				kickBase.start();
				kickLfo.start();
				midOsc.start();
				midLfo.start();
				highOsc.start();
				highLfo.start();
				filterLfo.start();

				return {
					inputNode: sweepFilter,
					stopNodes: [bassOsc, bassLfo, kickOsc, kickBase, kickLfo, midOsc, midLfo, highOsc, highLfo, filterLfo],
					disconnectNodes: [bassGain, bassLfoGain, kickGain, kickLfoGain, midGain, midLfoGain, highGain, highLfoGain, mixGain, sweepFilter, filterLfoGain]
				};
			},
			advanceFrame: function(timeSeconds) {
				if (this.lastFrameTimeSeconds === timeSeconds) {
					return;
				}
				let elapsedTimeSeconds = 1 / 60;
				if (this.lastFrameTimeSeconds > 0) {
					elapsedTimeSeconds = utils.clampNumber(timeSeconds - this.lastFrameTimeSeconds, 1 / 240, 0.25);
				}
				this.lastFrameTimeSeconds = timeSeconds;
				if (
					this.audioAnalyser && this.audioAnalyserData && this.audioTimeDomainData && this.previousFrequencyData &&
					this.audioAnalyserLeft && this.audioAnalyserLeftData && this.audioTimeDomainLeftData && this.previousLeftFrequencyData &&
					this.audioAnalyserRight && this.audioAnalyserRightData && this.audioTimeDomainRightData && this.previousRightFrequencyData
				) {
					this.audioAnalyser.getByteFrequencyData(this.audioAnalyserData);
					this.audioAnalyser.getByteTimeDomainData(this.audioTimeDomainData);
					this.audioAnalyserLeft.getByteFrequencyData(this.audioAnalyserLeftData);
					this.audioAnalyserLeft.getByteTimeDomainData(this.audioTimeDomainLeftData);
					this.audioAnalyserRight.getByteFrequencyData(this.audioAnalyserRightData);
					this.audioAnalyserRight.getByteTimeDomainData(this.audioTimeDomainRightData);
					const mainStats = analyseAudioFrame(this.audioAnalyserData, this.audioTimeDomainData, this.previousFrequencyData);
					const leftStats = analyseAudioFrame(this.audioAnalyserLeftData, this.audioTimeDomainLeftData, this.previousLeftFrequencyData);
					const rightStats = analyseAudioFrame(this.audioAnalyserRightData, this.audioTimeDomainRightData, this.previousRightFrequencyData);
					const combinedLevel = mainStats.combinedLevel;
					const bassLevel = mainStats.bassLevel;
					const spectralFluxLevel = mainStats.spectralFluxLevel;
					const monoFallbackBool = combinedLevel > 0.02 && (
						leftStats.combinedLevel < combinedLevel * 0.12 && rightStats.combinedLevel > combinedLevel * 0.6 ||
						rightStats.combinedLevel < combinedLevel * 0.12 && leftStats.combinedLevel > combinedLevel * 0.6
					);
					let leftLevelInstant = leftStats.combinedLevel;
					let rightLevelInstant = rightStats.combinedLevel;
					let leftBassInstant = leftStats.bassLevel;
					let rightBassInstant = rightStats.bassLevel;
					let midLevelInstant = 0;
					let sideLevelInstant = 0;
					let stereoWidthInstant = 0;
					let stereoBalanceInstant = 0;
					if (monoFallbackBool) {
						leftLevelInstant = combinedLevel;
						rightLevelInstant = combinedLevel;
						leftBassInstant = bassLevel;
						rightBassInstant = bassLevel;
						midLevelInstant = combinedLevel;
					} else {
						let sideSpectrumSum = 0;
						let midSpectrumSum = 0;
						const stereoBinCount = Math.min(this.audioAnalyserLeftData.length, this.audioAnalyserRightData.length);
						for (let i = 0; i < stereoBinCount; i += 1) {
							const leftMagnitude = this.audioAnalyserLeftData[i] / 255;
							const rightMagnitude = this.audioAnalyserRightData[i] / 255;
							sideSpectrumSum += Math.abs(leftMagnitude - rightMagnitude);
							midSpectrumSum += (leftMagnitude + rightMagnitude) * 0.5;
						}
						midLevelInstant = (leftLevelInstant + rightLevelInstant) * 0.5;
						sideLevelInstant = utils.clampNumber(
							Math.abs(leftLevelInstant - rightLevelInstant) * 1.7 + sideSpectrumSum / Math.max(1, stereoBinCount) * 0.7,
							0,
							1
						);
						stereoWidthInstant = utils.clampNumber(
							sideSpectrumSum / Math.max(0.0001, midSpectrumSum + sideSpectrumSum * 0.35),
							0,
							1
						);
						stereoBalanceInstant = utils.clampNumber(
							(rightLevelInstant - leftLevelInstant) / Math.max(0.0001, leftLevelInstant + rightLevelInstant),
							-1,
							1
						);
					}
					const transientInstant = utils.clampNumber(spectralFluxLevel * 7.5 + Math.max(0, combinedLevel - this.audioLevel) * 1.4, 0, 1);
					const levelBlend = Math.min(1, elapsedTimeSeconds * 10);
					const bassBlend = Math.min(1, elapsedTimeSeconds * 12);
					const transientBlend = Math.min(1, elapsedTimeSeconds * 16);
					const stereoBlend = Math.min(1, elapsedTimeSeconds * 8.5);
					const bassBaselineBefore = this.audioBeatBaseline;
					const transientBaselineBefore = this.audioTransientBaseline;
					const baselineBlend = Math.min(1, elapsedTimeSeconds * 2.4);
					const transientBaselineBlend = Math.min(1, elapsedTimeSeconds * 3.2);
					const smoothedLevel = this.audioLevel + (combinedLevel - this.audioLevel) * levelBlend;
					const smoothedBassLevel = this.audioBassLevel + (bassLevel - this.audioBassLevel) * bassBlend;
					const bassRise = Math.max(0, bassLevel - bassBaselineBefore);
					const bassRiseThreshold = Math.max(0.012, bassBaselineBefore * 0.018);
					const transientThreshold = Math.max(0.04, transientBaselineBefore + 0.008);
					this.audioTransientLevel += (transientInstant - this.audioTransientLevel) * transientBlend;
					this.audioLevel = smoothedLevel;
					this.audioBassLevel = smoothedBassLevel;
					this.audioLeftLevel += (leftLevelInstant - this.audioLeftLevel) * levelBlend;
					this.audioRightLevel += (rightLevelInstant - this.audioRightLevel) * levelBlend;
					this.audioLeftBassLevel += (leftBassInstant - this.audioLeftBassLevel) * bassBlend;
					this.audioRightBassLevel += (rightBassInstant - this.audioRightBassLevel) * bassBlend;
					this.audioMidLevel += (midLevelInstant - this.audioMidLevel) * stereoBlend;
					this.audioSideLevel += (sideLevelInstant - this.audioSideLevel) * stereoBlend;
					this.audioStereoBalance += (stereoBalanceInstant - this.audioStereoBalance) * stereoBlend;
					this.audioStereoWidth += (stereoWidthInstant - this.audioStereoWidth) * stereoBlend;
					this.audioPeak = Math.max(combinedLevel, this.audioPeak - elapsedTimeSeconds * 0.65);
					this.audioBeatBaseline += (bassLevel - this.audioBeatBaseline) * baselineBlend;
					this.audioTransientBaseline += (transientInstant - this.audioTransientBaseline) * transientBaselineBlend;
					this.beatCooldownSeconds = Math.max(0, this.beatCooldownSeconds - elapsedTimeSeconds);
					if (
						this.beatCooldownSeconds <= 0 &&
						bassRise > bassRiseThreshold &&
						transientInstant > transientThreshold &&
						combinedLevel > 0.035
					) {
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
					this.audioLeftLevel *= 0.9;
					this.audioRightLevel *= 0.9;
					this.audioLeftBassLevel *= 0.9;
					this.audioRightBassLevel *= 0.9;
					this.audioMidLevel *= 0.9;
					this.audioSideLevel *= 0.85;
					this.audioStereoBalance *= 0.82;
					this.audioStereoWidth *= 0.85;
					this.audioBeatBaseline *= 0.88;
					this.audioTransientBaseline *= 0.88;
					this.beatPulse *= 0.82;
					this.beatCooldownSeconds = 0;
				}
			},
			setAudioStream: function(stream) {
				if (this.audioSourceKind !== "stream" || this.audioStream !== stream) {
					this.audioVersion += 1;
				}
				this.audioStream = stream;
				this.audioSourceKind = stream ? "stream" : "none";
				if (!this.visualizer || !this.audioContext) {
					if (!stream) {
						this.resetAudioMetrics();
					}
					return;
				}
				this.disconnectCurrentAudioInput();
				if (!stream) {
					this.resetAudioMetrics();
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
				this.debugAudioNodes = this.createDebugAudioNodes();
				this.attachAudioNode(this.debugAudioNodes.inputNode);
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
					elapsedTimeSeconds = utils.clampNumber(timeSeconds - this.lastCanvasRenderTimeSeconds, 1 / 240, 0.25);
				}
				this.lastCanvasRenderTimeSeconds = timeSeconds;
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
					beatPulse: this.beatPulse,
					leftLevel: this.audioLeftLevel,
					rightLevel: this.audioRightLevel,
					leftBass: this.audioLeftBassLevel,
					rightBass: this.audioRightBassLevel,
					midLevel: this.audioMidLevel,
					sideLevel: this.audioSideLevel,
					stereoBalance: this.audioStereoBalance,
					stereoWidth: this.audioStereoWidth
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
					timeSeconds: this.lastFrameTimeSeconds
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
