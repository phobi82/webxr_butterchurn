// Audio sources, analysis, and debug audio.

// Audio controller
// audio analysis shared by live sources and the debug synth
const AUDIO_FFT_SIZE = 512;
const AUDIO_SMOOTHING = 0.58; // frequency-domain smoothing, 0 = none, 1 = frozen
const AUDIO_BASS_BIN_LIMIT = 14; // bins 0-13 (~0-600 Hz at 48kHz/512 FFT)
const AUDIO_FLUX_BIN_LIMIT = 56; // bins 0-55 (~0-5.3 kHz) for spectral flux
const createAnalyserNode = function(audioContext) {
	const analyser = audioContext.createAnalyser();
	analyser.fftSize = AUDIO_FFT_SIZE;
	analyser.smoothingTimeConstant = AUDIO_SMOOTHING;
	return analyser;
};

const analyseAudioFrame = function(frequencyData, timeDomainData, previousFrequencyData) {
	let levelSum = 0;
	let bassSum = 0;
	let bassCount = 0;
	let fluxSum = 0;
	let rmsSum = 0;
	const bassBinLimit = Math.min(AUDIO_BASS_BIN_LIMIT, frequencyData.length);
	const fluxBinLimit = Math.min(AUDIO_FLUX_BIN_LIMIT, frequencyData.length);
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

// audio metric decay rates — multi-use rates are named, single-use rates are inline below
const AUDIO_DECAY_STANDARD = 0.9;
const AUDIO_DECAY_SIDE = 0.85;
const AUDIO_DECAY_BEAT_BASELINE = 0.88;
const AUDIO_DECAY_IMPACT = 0.82;

// audio analyser — all metric state is closure-scoped for direct access in the hot advanceFrame path.
// Web Audio nodes (analyserNode..previousFrequencyDataRight) are lifecycle-managed.
// 28 metric variables (audioLevel..strobeCooldownSeconds) are read via getMetrics().
const createAudioAnalyser = function() {
	let analyserNode = null;
	let frequencyData = null;
	let timeDomainData = null;
	let previousFrequencyData = null;
	let channelSplitter = null;
	let analyserLeft = null;
	let analyserRight = null;
	let frequencyDataLeft = null;
	let frequencyDataRight = null;
	let timeDomainDataLeft = null;
	let timeDomainDataRight = null;
	let previousFrequencyDataLeft = null;
	let previousFrequencyDataRight = null;
	let audioLevel = 0;
	let audioPeak = 0;
	let audioBassLevel = 0;
	let audioTransientLevel = 0;
	let audioLeftLevel = 0;
	let audioRightLevel = 0;
	let audioLeftBassLevel = 0;
	let audioRightBassLevel = 0;
	let audioMidLevel = 0;
	let audioSideLevel = 0;
	let audioStereoBalance = 0;
	let audioStereoWidth = 0;
	let audioBeatBaseline = 0;
	let audioTransientBaseline = 0;
	let beatPulse = 0;
	let kickGate = 0;
	let bassHit = 0;
	let transientGate = 0;
	let strobeGate = 0;
	let colorMomentum = 0;
	let motionEnergy = 0;
	let roomFill = 0;
	let leftImpact = 0;
	let rightImpact = 0;
	let beatCooldownSeconds = 0;
	let kickCooldownSeconds = 0;
	let transientCooldownSeconds = 0;
	let strobeCooldownSeconds = 0;
	let lastFrameTimeSeconds = 0;
	let debugAudioNodes = null;

	return {
		ensureNodes: function(audioContext) {
			if (analyserNode) {
				return;
			}
			analyserNode = createAnalyserNode(audioContext);
			frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
			timeDomainData = new Uint8Array(analyserNode.fftSize);
			previousFrequencyData = new Float32Array(analyserNode.frequencyBinCount);
			channelSplitter = audioContext.createChannelSplitter(2);
			analyserLeft = createAnalyserNode(audioContext);
			analyserRight = createAnalyserNode(audioContext);
			frequencyDataLeft = new Uint8Array(analyserLeft.frequencyBinCount);
			frequencyDataRight = new Uint8Array(analyserRight.frequencyBinCount);
			timeDomainDataLeft = new Uint8Array(analyserLeft.fftSize);
			timeDomainDataRight = new Uint8Array(analyserRight.fftSize);
			previousFrequencyDataLeft = new Float32Array(analyserLeft.frequencyBinCount);
			previousFrequencyDataRight = new Float32Array(analyserRight.frequencyBinCount);
			channelSplitter.connect(analyserLeft, 0);
			channelSplitter.connect(analyserRight, 1);
		},
		connectSource: function(node) {
			node.connect(analyserNode);
			node.connect(channelSplitter);
		},
		resetMetrics: function() {
			audioLevel = 0;
			audioPeak = 0;
			audioBassLevel = 0;
			audioTransientLevel = 0;
			audioLeftLevel = 0;
			audioRightLevel = 0;
			audioLeftBassLevel = 0;
			audioRightBassLevel = 0;
			audioMidLevel = 0;
			audioSideLevel = 0;
			audioStereoBalance = 0;
			audioStereoWidth = 0;
			audioBeatBaseline = 0;
			audioTransientBaseline = 0;
			beatPulse = 0;
			kickGate = 0;
			bassHit = 0;
			transientGate = 0;
			strobeGate = 0;
			colorMomentum = 0;
			motionEnergy = 0;
			roomFill = 0;
			leftImpact = 0;
			rightImpact = 0;
			beatCooldownSeconds = 0;
			kickCooldownSeconds = 0;
			transientCooldownSeconds = 0;
			strobeCooldownSeconds = 0;
			lastFrameTimeSeconds = 0;
			if (previousFrequencyData) { previousFrequencyData.fill(0); }
			if (previousFrequencyDataLeft) { previousFrequencyDataLeft.fill(0); }
			if (previousFrequencyDataRight) { previousFrequencyDataRight.fill(0); }
		},
		advanceFrame: function(timeSeconds) {
			if (lastFrameTimeSeconds === timeSeconds) {
				return;
			}
			let elapsedTimeSeconds = 1 / 60;
			if (lastFrameTimeSeconds > 0) {
				elapsedTimeSeconds = clampNumber(timeSeconds - lastFrameTimeSeconds, 1 / 240, 0.25);
			}
			lastFrameTimeSeconds = timeSeconds;
			if (!analyserNode || !frequencyData) {
				// no-source decay — mirrors the decay constants defined above
				audioLevel *= AUDIO_DECAY_STANDARD;
				audioPeak *= AUDIO_DECAY_STANDARD;
				audioBassLevel *= AUDIO_DECAY_STANDARD;
				audioTransientLevel *= 0.86;
				audioLeftLevel *= AUDIO_DECAY_STANDARD;
				audioRightLevel *= AUDIO_DECAY_STANDARD;
				audioLeftBassLevel *= AUDIO_DECAY_STANDARD;
				audioRightBassLevel *= AUDIO_DECAY_STANDARD;
				audioMidLevel *= AUDIO_DECAY_STANDARD;
				audioSideLevel *= AUDIO_DECAY_SIDE;
				audioStereoBalance *= 0.82;
				audioStereoWidth *= AUDIO_DECAY_SIDE;
				audioBeatBaseline *= AUDIO_DECAY_BEAT_BASELINE;
				audioTransientBaseline *= AUDIO_DECAY_BEAT_BASELINE;
				beatPulse *= 0.82;
				kickGate *= 0.76;
				bassHit *= 0.84;
				transientGate *= 0.74;
				strobeGate *= 0.68;
				colorMomentum *= AUDIO_DECAY_STANDARD;
				motionEnergy *= 0.86;
				roomFill *= 0.88;
				leftImpact *= AUDIO_DECAY_IMPACT;
				rightImpact *= AUDIO_DECAY_IMPACT;
				beatCooldownSeconds = 0;
				kickCooldownSeconds = 0;
				transientCooldownSeconds = 0;
				strobeCooldownSeconds = 0;
				return;
			}
			analyserNode.getByteFrequencyData(frequencyData);
			analyserNode.getByteTimeDomainData(timeDomainData);
			analyserLeft.getByteFrequencyData(frequencyDataLeft);
			analyserLeft.getByteTimeDomainData(timeDomainDataLeft);
			analyserRight.getByteFrequencyData(frequencyDataRight);
			analyserRight.getByteTimeDomainData(timeDomainDataRight);
			const mainStats = analyseAudioFrame(frequencyData, timeDomainData, previousFrequencyData);
			const leftStats = analyseAudioFrame(frequencyDataLeft, timeDomainDataLeft, previousFrequencyDataLeft);
			const rightStats = analyseAudioFrame(frequencyDataRight, timeDomainDataRight, previousFrequencyDataRight);
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
				const stereoBinCount = Math.min(frequencyDataLeft.length, frequencyDataRight.length);
				for (let i = 0; i < stereoBinCount; i += 1) {
					const leftMagnitude = frequencyDataLeft[i] / 255;
					const rightMagnitude = frequencyDataRight[i] / 255;
					sideSpectrumSum += Math.abs(leftMagnitude - rightMagnitude);
					midSpectrumSum += (leftMagnitude + rightMagnitude) * 0.5;
				}
				midLevelInstant = (leftLevelInstant + rightLevelInstant) * 0.5;
				sideLevelInstant = clampNumber(Math.abs(leftLevelInstant - rightLevelInstant) * 1.7 + sideSpectrumSum / Math.max(1, stereoBinCount) * 0.7, 0, 1);
				stereoWidthInstant = clampNumber(sideSpectrumSum / Math.max(0.0001, midSpectrumSum + sideSpectrumSum * 0.35), 0, 1);
				stereoBalanceInstant = clampNumber((rightLevelInstant - leftLevelInstant) / Math.max(0.0001, leftLevelInstant + rightLevelInstant), -1, 1);
			}
			const transientInstant = clampNumber(spectralFluxLevel * 7.5 + Math.max(0, combinedLevel - audioLevel) * 1.4, 0, 1);
			const levelBlend = Math.min(1, elapsedTimeSeconds * 10);
			const bassBlend = Math.min(1, elapsedTimeSeconds * 12);
			const transientBlend = Math.min(1, elapsedTimeSeconds * 16);
			const stereoBlend = Math.min(1, elapsedTimeSeconds * 8.5);
			const motionBlend = Math.min(1, elapsedTimeSeconds * 6.5);
			const bassBaselineBefore = audioBeatBaseline;
			const transientBaselineBefore = audioTransientBaseline;
			const baselineBlend = Math.min(1, elapsedTimeSeconds * 2.4);
			const transientBaselineBlend = Math.min(1, elapsedTimeSeconds * 3.2);
			const smoothedLevel = audioLevel + (combinedLevel - audioLevel) * levelBlend;
			const smoothedBassLevel = audioBassLevel + (bassLevel - audioBassLevel) * bassBlend;
			const bassRise = Math.max(0, bassLevel - bassBaselineBefore);
			const bassRiseThreshold = Math.max(0.012, bassBaselineBefore * 0.018);
			const transientThreshold = Math.max(0.04, transientBaselineBefore + 0.008);
			audioTransientLevel += (transientInstant - audioTransientLevel) * transientBlend;
			audioLevel = smoothedLevel;
			audioBassLevel = smoothedBassLevel;
			audioLeftLevel += (leftLevelInstant - audioLeftLevel) * levelBlend;
			audioRightLevel += (rightLevelInstant - audioRightLevel) * levelBlend;
			audioLeftBassLevel += (leftBassInstant - audioLeftBassLevel) * bassBlend;
			audioRightBassLevel += (rightBassInstant - audioRightBassLevel) * bassBlend;
			audioMidLevel += (midLevelInstant - audioMidLevel) * stereoBlend;
			audioSideLevel += (sideLevelInstant - audioSideLevel) * stereoBlend;
			audioStereoBalance += (stereoBalanceInstant - audioStereoBalance) * stereoBlend;
			audioStereoWidth += (stereoWidthInstant - audioStereoWidth) * stereoBlend;
			audioPeak = Math.max(combinedLevel, audioPeak - elapsedTimeSeconds * 0.65);
			audioBeatBaseline += (bassLevel - audioBeatBaseline) * baselineBlend;
			audioTransientBaseline += (transientInstant - audioTransientBaseline) * transientBaselineBlend;
			beatCooldownSeconds = Math.max(0, beatCooldownSeconds - elapsedTimeSeconds);
			kickCooldownSeconds = Math.max(0, kickCooldownSeconds - elapsedTimeSeconds);
			transientCooldownSeconds = Math.max(0, transientCooldownSeconds - elapsedTimeSeconds);
			strobeCooldownSeconds = Math.max(0, strobeCooldownSeconds - elapsedTimeSeconds);
			if (beatCooldownSeconds <= 0 && bassRise > bassRiseThreshold && transientInstant > transientThreshold && combinedLevel > 0.035) {
				beatPulse = 1;
				beatCooldownSeconds = 0.18;
			} else {
				beatPulse = Math.max(0, beatPulse - elapsedTimeSeconds * 3.6);
			}
			const kickThreshold = Math.max(0.016, bassBaselineBefore * 0.024);
			if (kickCooldownSeconds <= 0 && bassRise > kickThreshold && combinedLevel > 0.032) {
				kickGate = 1;
				kickCooldownSeconds = 0.12;
			} else {
				kickGate = Math.max(0, kickGate - elapsedTimeSeconds * 6.2);
			}
			if (transientCooldownSeconds <= 0 && transientInstant > transientThreshold && combinedLevel > 0.03) {
				transientGate = 1;
				transientCooldownSeconds = 0.07;
			} else {
				transientGate = Math.max(0, transientGate - elapsedTimeSeconds * 8.4);
			}
			if (strobeCooldownSeconds <= 0 && transientInstant > transientThreshold * 1.16 && bassRise > kickThreshold * 0.7 && combinedLevel > 0.05) {
				strobeGate = 1;
				strobeCooldownSeconds = 0.17;
			} else {
				strobeGate = Math.max(0, strobeGate - elapsedTimeSeconds * 10.5);
			}
			const bassHitInstant = clampNumber(bassRise * 18 + beatPulse * 0.35, 0, 1);
			bassHit += (bassHitInstant - bassHit) * Math.min(1, elapsedTimeSeconds * 9.5);
			const colorMomentumInstant = clampNumber(spectralFluxLevel * 4.8 + transientInstant * 0.32 + stereoWidthInstant * 0.22, 0, 1);
			colorMomentum += (colorMomentumInstant - colorMomentum) * Math.min(1, elapsedTimeSeconds * 4.2);
			const motionEnergyInstant = clampNumber(smoothedLevel * 0.28 + bassHit * 0.24 + transientGate * 0.22 + stereoWidthInstant * 0.16 + beatPulse * 0.22, 0, 1);
			motionEnergy += (motionEnergyInstant - motionEnergy) * motionBlend;
			const roomFillInstant = clampNumber(smoothedLevel * 0.5 + smoothedBassLevel * 0.8 + beatPulse * 0.18, 0, 1);
			roomFill += (roomFillInstant - roomFill) * Math.min(1, elapsedTimeSeconds * 4.6);
			const stereoAccentScale = clampNumber(0.24 + stereoWidthInstant * 0.98 + Math.abs(stereoBalanceInstant) * 0.58 + sideLevelInstant * 0.3, 0, 1);
			const leftImpactInstant = clampNumber((leftLevelInstant * 0.34 + leftBassInstant * 0.54 + Math.max(0, -stereoBalanceInstant) * 0.42 + sideLevelInstant * 0.18 + beatPulse * 0.1) * stereoAccentScale, 0, 1);
			const rightImpactInstant = clampNumber((rightLevelInstant * 0.34 + rightBassInstant * 0.54 + Math.max(0, stereoBalanceInstant) * 0.42 + sideLevelInstant * 0.18 + beatPulse * 0.1) * stereoAccentScale, 0, 1);
			leftImpact += (leftImpactInstant - leftImpact) * Math.min(1, elapsedTimeSeconds * 10.5);
			rightImpact += (rightImpactInstant - rightImpact) * Math.min(1, elapsedTimeSeconds * 10.5);
		},
		getMetrics: function() {
			return {
				level: audioLevel,
				peak: audioPeak,
				bass: audioBassLevel,
				transient: audioTransientLevel,
				beatPulse: beatPulse,
				leftLevel: audioLeftLevel,
				rightLevel: audioRightLevel,
				leftBass: audioLeftBassLevel,
				rightBass: audioRightBassLevel,
				midLevel: audioMidLevel,
				sideLevel: audioSideLevel,
				stereoBalance: audioStereoBalance,
				stereoWidth: audioStereoWidth,
				kickGate: kickGate,
				bassHit: bassHit,
				transientGate: transientGate,
				strobeGate: strobeGate,
				colorMomentum: colorMomentum,
				motionEnergy: motionEnergy,
				roomFill: roomFill,
				leftImpact: leftImpact,
				rightImpact: rightImpact
			};
		},
		createDebugAudioNodes: function(audioContext) {
			const mixGain = audioContext.createGain();
			mixGain.gain.value = 0.75;
			const bassOsc = audioContext.createOscillator();
			bassOsc.type = "sine";
			bassOsc.frequency.value = 55;
			const bassGain = audioContext.createGain();
			bassGain.gain.value = 0.055;
			const bassLfo = audioContext.createOscillator();
			bassLfo.type = "triangle";
			bassLfo.frequency.value = 1.85;
			const bassLfoGain = audioContext.createGain();
			bassLfoGain.gain.value = 0.11;
			bassOsc.connect(bassGain);
			bassGain.connect(mixGain);
			bassLfo.connect(bassLfoGain);
			bassLfoGain.connect(bassGain.gain);
			const kickOsc = audioContext.createOscillator();
			kickOsc.type = "triangle";
			kickOsc.frequency.value = 43;
			const kickGain = audioContext.createGain();
			kickGain.gain.value = 0;
			const kickBase = audioContext.createConstantSource();
			kickBase.offset.value = 0.03;
			const kickLfo = audioContext.createOscillator();
			kickLfo.type = "square";
			kickLfo.frequency.value = 2.05;
			const kickLfoGain = audioContext.createGain();
			kickLfoGain.gain.value = 0.1;
			kickOsc.connect(kickGain);
			kickGain.connect(mixGain);
			kickBase.connect(kickGain.gain);
			kickLfo.connect(kickLfoGain);
			kickLfoGain.connect(kickGain.gain);
			const midOsc = audioContext.createOscillator();
			midOsc.type = "sawtooth";
			midOsc.frequency.value = 220;
			const midGain = audioContext.createGain();
			midGain.gain.value = 0.012;
			const midLfo = audioContext.createOscillator();
			midLfo.type = "sine";
			midLfo.frequency.value = 5.1;
			const midLfoGain = audioContext.createGain();
			midLfoGain.gain.value = 0.02;
			midOsc.connect(midGain);
			midGain.connect(mixGain);
			midLfo.connect(midLfoGain);
			midLfoGain.connect(midGain.gain);
			const highOsc = audioContext.createOscillator();
			highOsc.type = "square";
			highOsc.frequency.value = 1320;
			const highGain = audioContext.createGain();
			highGain.gain.value = 0.004;
			const highLfo = audioContext.createOscillator();
			highLfo.type = "square";
			highLfo.frequency.value = 7.6;
			const highLfoGain = audioContext.createGain();
			highLfoGain.gain.value = 0.012;
			highOsc.connect(highGain);
			highGain.connect(mixGain);
			highLfo.connect(highLfoGain);
			highLfoGain.connect(highGain.gain);
			const sweepFilter = audioContext.createBiquadFilter();
			sweepFilter.type = "lowpass";
			sweepFilter.frequency.value = 1600;
			const filterLfo = audioContext.createOscillator();
			filterLfo.type = "sine";
			filterLfo.frequency.value = 0.21;
			const filterLfoGain = audioContext.createGain();
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
			debugAudioNodes = {
				inputNode: sweepFilter,
				stopNodes: [bassOsc, bassLfo, kickOsc, kickBase, kickLfo, midOsc, midLfo, highOsc, highLfo, filterLfo],
				disconnectNodes: [bassGain, bassLfoGain, kickGain, kickLfoGain, midGain, midLfoGain, highGain, highLfoGain, mixGain, sweepFilter, filterLfoGain]
			};
			return debugAudioNodes;
		},
		destroyDebugAudioNodes: function() {
			if (!debugAudioNodes) {
				return;
			}
			const stopNodes = debugAudioNodes.stopNodes || [];
			for (let i = 0; i < stopNodes.length; i += 1) {
				try { stopNodes[i].stop(); } catch (error) { console.warn("audio stop node error:", error.message); }
			}
			const disconnectNodes = debugAudioNodes.disconnectNodes || [];
			for (let i = 0; i < disconnectNodes.length; i += 1) {
				try { disconnectNodes[i].disconnect(); } catch (error) { console.warn("audio disconnect error:", error.message); }
			}
			debugAudioNodes = null;
		}
	};
};

const createAudioSourceControllerRuntime = function(options) {
	const controllerState = {
		audioBackend: null,
		activeStream: null,
		sourceKind: "none",
		sourceName: "",
		windowHandles: {}
	};
	const mediaDevices = options.mediaDevices || null;
	const openWindow = options.openWindow || function(url, windowName) {
		return window.open(url, windowName);
	};
	const controllerRuntime = {
		state: controllerState,
		openWindow: openWindow,
		setStatus: function(text) {
			if (options.setStatus) {
				options.setStatus(text);
			}
		},
		updateUiState: function() {
			if (options.onStateChange) {
				options.onStateChange({
					sourceKind: controllerState.sourceKind,
					sourceName: controllerState.sourceName,
					stopEnabledBool: controllerState.sourceKind !== "none"
				});
			}
		},
		syncBackendState: async function() {
			const audioBackend = controllerState.audioBackend;
			if (!audioBackend) {
				return;
			}
			if (controllerState.sourceKind === "debug" && audioBackend.startDebugAudio) {
				await audioBackend.startDebugAudio();
				return;
			}
			if (audioBackend.setAudioStream) {
				audioBackend.setAudioStream(controllerState.activeStream);
			}
		},
		clearActiveStream: function() {
			if (!controllerState.activeStream) {
				return;
			}
			const oldStream = controllerState.activeStream;
			controllerState.activeStream = null;
			const tracks = oldStream.getTracks();
			for (let i = 0; i < tracks.length; i += 1) {
				tracks[i].stop();
			}
		},
		requestDisplayStream: async function(optionOverrides) {
			if (!mediaDevices || !mediaDevices.getDisplayMedia) {
				throw new Error("display capture unavailable");
			}
			const optionsMap = {
				video: true,
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				},
				surfaceSwitching: "include",
				monitorTypeSurfaces: "include",
				systemAudio: "include",
				selfBrowserSurface: "exclude"
			};
			if (optionOverrides) {
				const overrideKeys = Object.keys(optionOverrides);
				for (let i = 0; i < overrideKeys.length; i += 1) {
					optionsMap[overrideKeys[i]] = optionOverrides[overrideKeys[i]];
				}
			}
			const stream = await mediaDevices.getDisplayMedia(optionsMap);
			if (!stream.getAudioTracks().length) {
				const tracks = stream.getTracks();
				for (let i = 0; i < tracks.length; i += 1) {
					tracks[i].stop();
				}
				throw new Error("shared source has no audio track");
			}
			return stream;
		},
		requestMicrophoneStream: function() {
			if (!mediaDevices || !mediaDevices.getUserMedia) {
				throw new Error("microphone capture unavailable");
			}
			return mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				},
				video: false
			});
		},
		getState: function() {
			return {
				sourceKind: controllerState.sourceKind,
				sourceName: controllerState.sourceName
			};
		}
	};
	const controllerStateRef = controllerRuntime.state;
	const resetSourceState = function() {
		controllerStateRef.sourceKind = "none";
		controllerStateRef.sourceName = "";
		controllerRuntime.updateUiState();
	};

	const bindActiveStreamLifecycle = function(stream) {
		if (!stream) {
			return;
		}
		const tracks = stream.getTracks();
		for (let i = 0; i < tracks.length; i += 1) {
			tracks[i].addEventListener("ended", function() {
				if (controllerStateRef.activeStream === stream) {
					controllerStateRef.activeStream = null;
					resetSourceState();
					controllerRuntime.syncBackendState();
				}
			});
		}
	};
	const activateAudio = async function() {
		const audioBackend = controllerStateRef.audioBackend;
		if (!audioBackend || !audioBackend.activateAudio) {
			return;
		}
		try {
			await audioBackend.activateAudio();
		} catch (error) {
		}
	};
	const setStreamSource = async function(stream, sourceName) {
		controllerRuntime.clearActiveStream();
		controllerStateRef.activeStream = stream;
		controllerStateRef.sourceKind = stream ? "stream" : "none";
		controllerStateRef.sourceName = stream ? sourceName || "shared surface" : "";
		controllerRuntime.updateUiState();
		await controllerRuntime.syncBackendState();
		bindActiveStreamLifecycle(stream);
	};
	return Object.assign(controllerRuntime, {
		activateAudio: activateAudio,
		setStreamSource: setStreamSource,
		stop: function() {
			controllerRuntime.clearActiveStream();
			resetSourceState();
			return controllerRuntime.syncBackendState();
		},
		requestSharedAudio: async function() {
			await activateAudio();
			const stream = await controllerRuntime.requestDisplayStream();
			return setStreamSource(stream);
		},
		requestMicrophoneAudio: async function() {
			await activateAudio();
			const stream = await controllerRuntime.requestMicrophoneStream();
			return setStreamSource(stream, "microphone");
		},
		requestTabAudio: async function(args) {
			args = args || {};
			await activateAudio();
			if (!controllerStateRef.windowHandles[args.key] || controllerStateRef.windowHandles[args.key].closed) {
				controllerStateRef.windowHandles[args.key] = controllerRuntime.openWindow(args.url, args.windowName);
			} else {
				controllerStateRef.windowHandles[args.key].location.href = args.url;
			}
			if (!controllerStateRef.windowHandles[args.key]) {
				throw new Error(args.blockedMessage || "tab blocked");
			}
			try { controllerStateRef.windowHandles[args.key].focus(); } catch (error) { console.warn("tab focus error:", error.message); }
			controllerRuntime.setStatus(args.selectStatus || "select the tab and enable tab audio");
			const stream = await controllerRuntime.requestDisplayStream({preferCurrentTab: false});
			await setStreamSource(stream, args.sourceName);
			controllerRuntime.setStatus(args.activeStatus || "tab audio active");
		},
		startDebugAudio: async function() {
			controllerRuntime.clearActiveStream();
			await activateAudio();
			const audioBackend = controllerStateRef.audioBackend;
			if (!audioBackend || !audioBackend.startDebugAudio) {
				return;
			}
			await audioBackend.startDebugAudio();
			controllerStateRef.sourceKind = "debug";
			controllerStateRef.sourceName = "debug signal";
			controllerRuntime.updateUiState();
		},
		setAudioBackend: function(audioBackend) {
			controllerRuntime.state.audioBackend = audioBackend || null;
			return controllerRuntime.syncBackendState();
		},
		activate: activateAudio
	});
};

const createAudioSourceController = function(options) {
	const controllerRuntime = createAudioSourceControllerRuntime(options || {});
	return {
		stop: controllerRuntime.stop,
		requestSharedAudio: controllerRuntime.requestSharedAudio,
		requestMicrophoneAudio: controllerRuntime.requestMicrophoneAudio,
		requestTabAudio: controllerRuntime.requestTabAudio,
		startDebugAudio: controllerRuntime.startDebugAudio,
		setAudioBackend: controllerRuntime.setAudioBackend,
		getState: controllerRuntime.getState,
		activate: controllerRuntime.activate
	};
};
