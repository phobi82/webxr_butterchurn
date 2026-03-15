(function() {
	// Owns audio source selection, stream cleanup, and renderer handoff.
	window.createXrAudioController = function(options) {
		options = options || {};
		const controller = {
			visualizerRenderer: null,
			activeStream: null,
			sourceKind: "none",
			sourceName: "",
			windowHandles: {
				youtube: null,
				suno: null
			}
		};

		const updateUiState = function() {
			if (options.onStateChange) {
				options.onStateChange({
					sourceKind: controller.sourceKind,
					sourceName: controller.sourceName,
					stopEnabledBool: controller.sourceKind !== "none"
				});
			}
		};

		const setStatus = function(text) {
			if (options.setStatus) {
				options.setStatus(text);
			}
		};

		const getRenderer = function() {
			return controller.visualizerRenderer;
		};

		// Replays the current controller state into a renderer after init or source changes.
		const applyRendererAudioState = function() {
			const renderer = getRenderer();
			if (!renderer) {
				return Promise.resolve();
			}
			if (controller.sourceKind === "debug" && renderer.startDebugAudio) {
				return renderer.startDebugAudio();
			}
			if (renderer.setAudioStream) {
				renderer.setAudioStream(controller.activeStream);
			}
			return Promise.resolve();
		};

		// Always stop old tracks so capture devices and shared tabs are released immediately.
		const clearActiveStream = function() {
			if (!controller.activeStream) {
				return;
			}
			const oldStream = controller.activeStream;
			controller.activeStream = null;
			const tracks = oldStream.getTracks();
			for (let i = 0; i < tracks.length; i += 1) {
				tracks[i].stop();
			}
		};

		const resetSourceState = function() {
			controller.sourceKind = "none";
			controller.sourceName = "";
			updateUiState();
		};

		// Stream sources share the same attach path and ended handling.
		const setStreamSource = async function(stream, sourceName) {
			clearActiveStream();
			controller.activeStream = stream;
			controller.sourceKind = stream ? "stream" : "none";
			controller.sourceName = stream ? sourceName || "shared surface" : "";
			updateUiState();
			await applyRendererAudioState();
			if (!stream) {
				return;
			}
			const tracks = stream.getTracks();
			for (let i = 0; i < tracks.length; i += 1) {
				tracks[i].addEventListener("ended", function() {
					if (controller.activeStream === stream) {
						controller.activeStream = null;
						resetSourceState();
						applyRendererAudioState();
					}
				});
			}
		};

		const activateAudio = async function() {
			const renderer = getRenderer();
			if (!renderer || !renderer.activateAudio) {
				return;
			}
			try {
				await renderer.activateAudio();
			} catch (error) {
			}
		};

		const runActivated = async function(action) {
			await activateAudio();
			return action();
		};

		// Display capture is reused for generic sharing and tab-audio flows.
		const requestDisplayAudio = async function(sourceName, optionOverrides) {
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
			const stream = await navigator.mediaDevices.getDisplayMedia(optionsMap);
			if (!stream.getAudioTracks().length) {
				const tracks = stream.getTracks();
				for (let i = 0; i < tracks.length; i += 1) {
					tracks[i].stop();
				}
				throw new Error("shared source has no audio track");
			}
			return setStreamSource(stream, sourceName || "shared surface");
		};

		const requestMicrophoneAudio = async function() {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				},
				video: false
			});
			return setStreamSource(stream, "microphone");
		};

		// Reuse one window per external source so repeated clicks stay predictable.
		const openSourceWindow = function(key, url, windowName, blockedMessage) {
			if (!controller.windowHandles[key] || controller.windowHandles[key].closed) {
				controller.windowHandles[key] = window.open(url, windowName);
			} else {
				controller.windowHandles[key].location.href = url;
			}
			if (!controller.windowHandles[key]) {
				throw new Error(blockedMessage);
			}
			try {
				controller.windowHandles[key].focus();
			} catch (error) {
			}
		};

		return {
			setVisualizerRenderer: function(renderer) {
				controller.visualizerRenderer = renderer || null;
				return applyRendererAudioState();
			},
			activate: function() {
				return activateAudio();
			},
			stop: function() {
				clearActiveStream();
				resetSourceState();
				return applyRendererAudioState();
			},
			requestSharedAudio: function() {
				return runActivated(requestDisplayAudio);
			},
			requestMicrophoneAudio: function() {
				return runActivated(requestMicrophoneAudio);
			},
			requestYoutubePlaylistAudio: function() {
				return runActivated(async function() {
					openSourceWindow("youtube", options.youtubePlaylistUrl, options.youtubeWindowName, "youtube tab blocked");
					setStatus("select the YouTube tab and enable tab audio");
					await requestDisplayAudio("YouTube playlist", {preferCurrentTab: false});
					setStatus("youtube tab audio active");
				});
			},
			requestSunoLiveRadioAudio: function() {
				return runActivated(async function() {
					openSourceWindow("suno", options.sunoLiveRadioUrl, options.sunoWindowName, "suno live radio tab blocked");
					setStatus("select the Suno Live Radio tab and enable tab audio");
					await requestDisplayAudio("Suno Live Radio", {preferCurrentTab: false});
					setStatus("suno live radio tab audio active");
				});
			},
			startDebugAudio: function() {
				clearActiveStream();
				return runActivated(async function() {
					const renderer = getRenderer();
					if (!renderer || !renderer.startDebugAudio) {
						return;
					}
					await renderer.startDebugAudio();
					controller.sourceKind = "debug";
					controller.sourceName = "debug signal";
					updateUiState();
				});
			}
		};
	};
})();
