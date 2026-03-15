(function() {
	// Reusable fullscreen textured-mode wrapper for modes that sample the shared Butterchurn canvas directly.
	const glUtils = window.xrVisualizerGlUtils;

	window.createXrVisualizerFullscreenTextureMode = function(spec) {
		spec = spec || {};
		return {
			gl: null,
			source: null,
			programInfo: null,
			positionBuffer: null,
			sourceTexture: null,
			lastUploadedCanvasVersion: -1,
			lastUploadedWidth: 0,
			lastUploadedHeight: 0,
			lastPreparedTimeSeconds: -1,
			lastPreparedWidth: 0,
			lastPreparedHeight: 0,
			init: function(options) {
				this.gl = options.gl;
				this.source = options.source;
				this.programInfo = glUtils.createFullscreenProgramInfo(this.gl, spec.fragmentSource, !!spec.includeAudioUniformsBool, spec.label || "Visualizer mode");
				this.positionBuffer = glUtils.createFullscreenTriangleBuffer(this.gl);
				this.sourceTexture = this.gl.createTexture();
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
			},
			uploadSourceTexture: function(sourceCanvas) {
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
				this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
			},
			update: function() {
			},
			onPresetChanged: function() {
				this.lastUploadedCanvasVersion = -1;
				this.lastPreparedTimeSeconds = -1;
			},
			onAudioChanged: function() {
				this.lastUploadedCanvasVersion = -1;
				this.lastPreparedTimeSeconds = -1;
			},
			prepareSourceFrame: function(width, height, timeSeconds) {
				this.source.ensureCanvasSize(width, height);
				this.source.advanceFrame(timeSeconds);
				if (this.lastPreparedTimeSeconds === timeSeconds && width === this.lastPreparedWidth && height === this.lastPreparedHeight) {
					return this.source.getStateSnapshot();
				}
				this.source.renderCanvas(timeSeconds);
				this.lastPreparedTimeSeconds = timeSeconds;
				this.lastPreparedWidth = width;
				this.lastPreparedHeight = height;
				return this.source.getStateSnapshot();
			},
			drawPreScene: function(sourceState, frameState) {
				const viewport = this.gl.getParameter(this.gl.VIEWPORT);
				const width = viewport[2];
				const height = viewport[3];
				sourceState = this.prepareSourceFrame(width, height, frameState.timeSeconds);
				const sourceCanvas = sourceState.textureSource;
				if (!sourceCanvas) {
					return;
				}
				if (sourceState.canvasRenderVersion !== this.lastUploadedCanvasVersion || width !== this.lastUploadedWidth || height !== this.lastUploadedHeight) {
					this.uploadSourceTexture(sourceCanvas);
					this.lastUploadedCanvasVersion = sourceState.canvasRenderVersion;
					this.lastUploadedWidth = width;
					this.lastUploadedHeight = height;
				}
				const orientationOffset = spec.getOrientationOffset ? spec.getOrientationOffset(sourceState, frameState) : {x: 0, y: 0};
				this.gl.disable(this.gl.DEPTH_TEST);
				this.gl.disable(this.gl.CULL_FACE);
				this.gl.useProgram(this.programInfo.program);
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
				this.gl.enableVertexAttribArray(this.programInfo.positionLoc);
				this.gl.vertexAttribPointer(this.programInfo.positionLoc, 2, this.gl.FLOAT, false, 0, 0);
				this.gl.activeTexture(this.gl.TEXTURE0);
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.uniform1i(this.programInfo.sourceTextureLoc, 0);
				this.gl.uniform2f(this.programInfo.viewportSizeLoc, width, height);
				this.gl.uniform2f(this.programInfo.eyeCenterOffsetLoc, frameState.eyeCenterOffsetX, frameState.eyeCenterOffsetY);
				this.gl.uniform2f(this.programInfo.orientationOffsetLoc, orientationOffset.x, orientationOffset.y);
				if (this.programInfo.audioMetricsLoc) {
					const audioMetrics = sourceState.audioMetrics || {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
					this.gl.uniform4f(this.programInfo.audioMetricsLoc, audioMetrics.level, audioMetrics.peak, audioMetrics.bass, audioMetrics.transient);
				}
				if (this.programInfo.beatPulseLoc) {
					this.gl.uniform1f(this.programInfo.beatPulseLoc, sourceState.audioMetrics ? sourceState.audioMetrics.beatPulse : 0);
				}
				if (spec.applyUniforms) {
					spec.applyUniforms(this.gl, this.programInfo, sourceState, frameState);
				}
				this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
				this.gl.enable(this.gl.DEPTH_TEST);
				this.gl.enable(this.gl.CULL_FACE);
			}
		};
	};
})();
