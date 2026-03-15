(function() {
	// Placeholder for the future world-space mode; kept registered so the UI can still target it safely.
	window.registerXrVisualizerMode("stereoVolume", function() {
		return {
			gl: null,
			source: null,
			skyVertexCount: 0,
			portalVertexCount: 0,
			triangleVertexCount: 0,
			lineVertexCount: 0,
			texturedDraws: [],
			init: function(options) {
				this.gl = options.gl;
				this.source = options.source;
			},
			resetGeometry: function() {
				// Keep the mode alive, but explicitly remove all render output.
				this.skyVertexCount = 0;
				this.portalVertexCount = 0;
				this.triangleVertexCount = 0;
				this.lineVertexCount = 0;
				this.texturedDraws = [];
			},
			update: function() {
				// The old spatial scene was removed; this is a clean placeholder.
				this.resetGeometry();
			},
			drawPreScene: function() {
				// Intentionally empty until a new concept is designed.
			},
			drawWorld: function() {
				// Intentionally empty until a new concept is designed.
			},
			drawPostScene: function() {
				// Intentionally empty until a new concept is designed.
			},
			onPresetChanged: function() {
				this.resetGeometry();
			},
			onAudioChanged: function() {
				this.resetGeometry();
			},
			onSessionStart: function() {
				this.resetGeometry();
			},
			onSessionEnd: function() {
				this.resetGeometry();
			}
		};
	});
})();
