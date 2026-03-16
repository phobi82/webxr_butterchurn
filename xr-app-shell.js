(function() {
	// Owns the browser UI shell so the app entry can focus on composition and runtime wiring.
	window.createXrAppShell = function(options) {
		options = options || {};
		const documentRef = options.documentRef || document;
		const rootElement = options.rootElement || documentRef.body;
		const panelParentElement = options.panelParentElement || rootElement;
		const canvasParentElement = options.canvasParentElement || rootElement;
		const applyStyles = function(element, styleMap) {
			if (!styleMap) {
				return;
			}
			const styleKeys = Object.keys(styleMap);
			for (let i = 0; i < styleKeys.length; i += 1) {
				element.style[styleKeys[i]] = styleMap[styleKeys[i]];
			}
		};
		const panel = documentRef.createElement("div");
		applyStyles(panel, {
			position: "fixed",
			left: "12px",
			top: "12px",
			display: "flex",
			flexDirection: "column",
			gap: "8px",
			padding: "10px",
			backgroundColor: "rgba(0, 0, 32, 0.88)",
			border: "1px solid #ffff00",
			zIndex: "10"
		});
		applyStyles(panel, options.panelStyle);
		panelParentElement.appendChild(panel);

		const title = documentRef.createElement("div");
		title.textContent = options.title || "WebXR Visualizer Foundation";
		title.style.fontWeight = "bold";
		panel.appendChild(title);

		const statusLabel = documentRef.createElement("div");
		statusLabel.textContent = "XR: checking support...";
		statusLabel.style.fontSize = "14px";
		panel.appendChild(statusLabel);

		const xrHint = documentRef.createElement("div");
		xrHint.textContent = options.xrHintText || "";
		xrHint.style.fontSize = "13px";
		xrHint.style.color = "#00ff00";
		panel.appendChild(xrHint);

		const desktopHint = documentRef.createElement("div");
		desktopHint.textContent = options.desktopHintText || "";
		desktopHint.style.fontSize = "13px";
		desktopHint.style.color = "#00ff00";
		panel.appendChild(desktopHint);

		const xrSection = documentRef.createElement("div");
		xrSection.style.display = "flex";
		xrSection.style.flexDirection = "column";
		xrSection.style.gap = "6px";
		xrSection.style.padding = "8px";
		xrSection.style.border = "1px solid rgba(255, 255, 0, 0.35)";
		panel.appendChild(xrSection);

		const xrSectionLabel = documentRef.createElement("div");
		xrSectionLabel.textContent = "XR";
		xrSectionLabel.style.fontSize = "12px";
		xrSectionLabel.style.fontWeight = "bold";
		xrSectionLabel.style.color = "#00ff00";
		xrSection.appendChild(xrSectionLabel);

		const xrButtonRow = documentRef.createElement("div");
		xrButtonRow.style.display = "flex";
		xrButtonRow.style.flexWrap = "wrap";
		xrButtonRow.style.gap = "8px";
		xrSection.appendChild(xrButtonRow);

		const enterButton = documentRef.createElement("button");
		enterButton.textContent = "Enter VR";
		xrButtonRow.appendChild(enterButton);

		const exitButton = documentRef.createElement("button");
		exitButton.textContent = "Exit VR";
		exitButton.disabled = true;
		xrButtonRow.appendChild(exitButton);

		const audioSection = documentRef.createElement("div");
		audioSection.style.display = "flex";
		audioSection.style.flexDirection = "column";
		audioSection.style.gap = "6px";
		audioSection.style.padding = "8px";
		audioSection.style.border = "1px solid rgba(255, 255, 0, 0.35)";
		panel.appendChild(audioSection);

		const audioSectionLabel = documentRef.createElement("div");
		audioSectionLabel.textContent = "Audio";
		audioSectionLabel.style.fontSize = "12px";
		audioSectionLabel.style.fontWeight = "bold";
		audioSectionLabel.style.color = "#00ff00";
		audioSection.appendChild(audioSectionLabel);

		const audioSourceRow = documentRef.createElement("div");
		audioSourceRow.style.display = "flex";
		audioSourceRow.style.flexWrap = "wrap";
		audioSourceRow.style.gap = "8px";
		audioSection.appendChild(audioSourceRow);

		const audioButton = documentRef.createElement("button");
		audioButton.textContent = "Share Audio";
		audioSourceRow.appendChild(audioButton);

		const microphoneButton = documentRef.createElement("button");
		microphoneButton.textContent = "Use Microphone";
		audioSourceRow.appendChild(microphoneButton);

		const debugAudioButton = documentRef.createElement("button");
		debugAudioButton.textContent = "Debug Audio";
		audioSourceRow.appendChild(debugAudioButton);

		const stopAudioButton = documentRef.createElement("button");
		stopAudioButton.textContent = "Stop Audio";
		stopAudioButton.disabled = true;
		audioSourceRow.appendChild(stopAudioButton);

		const audioPlaylistRow = documentRef.createElement("div");
		audioPlaylistRow.style.display = "flex";
		audioPlaylistRow.style.flexWrap = "wrap";
		audioPlaylistRow.style.gap = "8px";
		audioSection.appendChild(audioPlaylistRow);

		const youtubeAudioButton = documentRef.createElement("button");
		youtubeAudioButton.textContent = "YouTube Playlist";
		audioPlaylistRow.appendChild(youtubeAudioButton);

		const sunoLiveRadioButton = documentRef.createElement("button");
		sunoLiveRadioButton.textContent = "Suno Live Radio";
		audioPlaylistRow.appendChild(sunoLiveRadioButton);

		const audioLabel = documentRef.createElement("div");
		audioLabel.textContent = "Audio: none";
		audioLabel.style.fontSize = "13px";
		audioSection.appendChild(audioLabel);

		const audioHint = documentRef.createElement("div");
		audioHint.textContent = options.audioHintText || "";
		audioHint.style.fontSize = "12px";
		audioHint.style.maxWidth = "360px";
		audioHint.style.color = "#00ff00";
		audioSection.appendChild(audioHint);

		const canvas = documentRef.createElement("canvas");
		applyStyles(canvas, {
			display: "block",
			width: "100vw",
			height: "100vh"
		});
		applyStyles(canvas, options.canvasStyle);
		canvasParentElement.appendChild(canvas);

		return {
			panel: panel,
			canvas: canvas,
			enterButton: enterButton,
			exitButton: exitButton,
			audioButton: audioButton,
			microphoneButton: microphoneButton,
			debugAudioButton: debugAudioButton,
			stopAudioButton: stopAudioButton,
			youtubeAudioButton: youtubeAudioButton,
			sunoLiveRadioButton: sunoLiveRadioButton,
			setStatus: function(text) {
				statusLabel.textContent = "XR: " + text;
			},
			// Keeps XR status text and XR button state aligned through one shell-facing API.
			setXrState: function(args) {
				args = args || {};
				if (args.statusText != null) {
					statusLabel.textContent = "XR: " + args.statusText;
				}
				if (args.enterEnabledBool != null) {
					enterButton.disabled = !args.enterEnabledBool;
				}
				if (args.exitEnabledBool != null) {
					exitButton.disabled = !args.exitEnabledBool;
				}
			},
			setAudioState: function(audioState) {
				audioState = audioState || {};
				audioLabel.textContent = "Audio: " + (audioState.sourceName || "none");
				stopAudioButton.disabled = !audioState.stopEnabledBool;
			},
			syncCanvasToViewport: function(viewport) {
				viewport = viewport || {};
				const width = viewport.width == null ? 0 : viewport.width;
				const height = viewport.height == null ? 0 : viewport.height;
				const pixelRatio = viewport.pixelRatio == null ? 1 : viewport.pixelRatio;
				canvas.width = width * pixelRatio;
				canvas.height = height * pixelRatio;
			},
			requestCanvasPointerLock: function() {
				if (canvas.requestPointerLock) {
					canvas.requestPointerLock();
				}
			},
			isCanvasPointerLocked: function(activeDocumentRef) {
				const pointerDocumentRef = activeDocumentRef || documentRef;
				return pointerDocumentRef.pointerLockElement === canvas;
			}
		};
	};
})();
