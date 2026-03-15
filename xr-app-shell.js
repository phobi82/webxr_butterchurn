(function() {
	// Owns the browser UI shell so the app entry can focus on composition and runtime wiring.
	window.createXrAppShell = function(options) {
		options = options || {};
		const documentRef = options.documentRef || document;
		const body = documentRef.body;
		const panel = documentRef.createElement("div");
		panel.style.position = "fixed";
		panel.style.left = "12px";
		panel.style.top = "12px";
		panel.style.display = "flex";
		panel.style.flexDirection = "column";
		panel.style.gap = "8px";
		panel.style.padding = "10px";
		panel.style.backgroundColor = "rgba(0, 0, 32, 0.88)";
		panel.style.border = "1px solid #ffff00";
		panel.style.zIndex = "10";
		body.appendChild(panel);

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
		canvas.style.display = "block";
		canvas.style.width = "100vw";
		canvas.style.height = "100vh";
		body.appendChild(canvas);

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
			}
		};
	};
})();
