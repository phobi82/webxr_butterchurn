// app-shell/contract.js
const normalizeAppShell = function(shell, options) {
	shell = shell || {};
	options = options || {};
	const canvas = shell.canvas || null;
	if (!canvas) {
		throw new Error("App shell requires a canvas.");
	}
	const documentRef = options.documentRef || document;
	return {
		canvas: canvas,
		enterButton: shell.enterButton || null,
		exitButton: shell.exitButton || null,
		audioButton: shell.audioButton || null,
		microphoneButton: shell.microphoneButton || null,
		debugAudioButton: shell.debugAudioButton || null,
		stopAudioButton: shell.stopAudioButton || null,
		youtubeAudioButton: shell.youtubeAudioButton || null,
		youtubeHouseDiscoButton: shell.youtubeHouseDiscoButton || null,
		sunoLiveRadioButton: shell.sunoLiveRadioButton || null,
		setStatus: typeof shell.setStatus === "function" ? shell.setStatus : function() {},
		setXrState: typeof shell.setXrState === "function" ? shell.setXrState : function() {},
		setAudioState: typeof shell.setAudioState === "function" ? shell.setAudioState : function() {},
		syncCanvasToViewport: typeof shell.syncCanvasToViewport === "function" ? shell.syncCanvasToViewport : function(viewport) {
			viewport = viewport || {};
			const width = viewport.width == null ? 0 : viewport.width;
			const height = viewport.height == null ? 0 : viewport.height;
			const pixelRatio = viewport.pixelRatio == null ? 1 : viewport.pixelRatio;
			canvas.width = width * pixelRatio;
			canvas.height = height * pixelRatio;
		},
		requestCanvasPointerLock: typeof shell.requestCanvasPointerLock === "function" ? shell.requestCanvasPointerLock : function() {
			if (canvas.requestPointerLock) {
				canvas.requestPointerLock();
			}
		},
		isCanvasPointerLocked: typeof shell.isCanvasPointerLocked === "function" ? shell.isCanvasPointerLocked : function(activeDocumentRef) {
			const pointerDocumentRef = activeDocumentRef || documentRef;
			return pointerDocumentRef.pointerLockElement === canvas;
		}
	};
};

// app-shell/dom.js
const createDomAppShell = function(options) {
	options = options || {};
	return normalizeAppShell({
		canvas: options.canvas,
		enterButton: options.enterButton,
		exitButton: options.exitButton,
		audioButton: options.audioButton,
		microphoneButton: options.microphoneButton,
		debugAudioButton: options.debugAudioButton,
		stopAudioButton: options.stopAudioButton,
		youtubeAudioButton: options.youtubeAudioButton,
		youtubeHouseDiscoButton: options.youtubeHouseDiscoButton,
		sunoLiveRadioButton: options.sunoLiveRadioButton,
		setStatus: options.setStatus,
		setXrState: options.setXrState,
		setAudioState: options.setAudioState,
		syncCanvasToViewport: options.syncCanvasToViewport,
		requestCanvasPointerLock: options.requestCanvasPointerLock,
		isCanvasPointerLocked: options.isCanvasPointerLocked
	}, {documentRef: options.documentRef || document});
};
